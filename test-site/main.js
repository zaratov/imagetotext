const btnUpload = document.getElementById('btnUpload');
const btnCamera = document.getElementById('btnCamera');
const fileInput = document.getElementById('fileInput');
const cameraInput = document.getElementById('cameraInput');
const preview = document.getElementById('preview');
const ocrTextEl = document.getElementById('ocrText');
const parsedNameEl = document.getElementById('parsedName');
const parsedYearEl = document.getElementById('parsedYear');
const progressEl = document.getElementById('progress');
const langSelect = document.getElementById('lang');
const preprocCheckbox = document.getElementById('preproc');
const thresholdCheckbox = document.getElementById('threshold');
const advancedCheckbox = document.getElementById('advanced');
const selectRegionBtn = document.getElementById('selectRegion');
const clearRegionBtn = document.getElementById('clearRegion');
const multiOcrBtn = document.getElementById('multiOcr');
const overlay = document.getElementById('overlay');
const previewWrap = document.getElementById('previewWrap');

let selection = null; // {x,y,w,h} in image pixels
let selecting = false;
let startSel = null;

selectRegionBtn.addEventListener('click', () => {
  if (!preview.querySelector('img')) return alert('Load an image first');
  selecting = true;
  overlay.style.display = 'block';
});
clearRegionBtn.addEventListener('click', () => {
  selection = null;
  drawOverlay();
});
multiOcrBtn.addEventListener('click', () => {
  const imgEl = preview.querySelector('img');
  if (!imgEl) return alert('Load an image first');
  runMultiPass(imgEl).catch(e => console.error(e));
});

overlay.addEventListener('mousedown', startSelection);
overlay.addEventListener('mousemove', moveSelection);
overlay.addEventListener('mouseup', endSelection);
overlay.addEventListener('mouseleave', () => { if (selecting) endSelection(); });

function startSelection(e) {
  if (!selecting) return;
  const rect = overlay.getBoundingClientRect();
  startSel = { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function moveSelection(e) {
  if (!selecting || !startSel) return;
  const rect = overlay.getBoundingClientRect();
  const cur = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  const x = Math.min(startSel.x, cur.x);
  const y = Math.min(startSel.y, cur.y);
  const w = Math.abs(startSel.x - cur.x);
  const h = Math.abs(startSel.y - cur.y);
  drawOverlay({ x, y, w, h });
}

function endSelection(e) {
  if (!selecting) return;
  selecting = false;
  const rect = overlay.getBoundingClientRect();
  const imgEl = preview.querySelector('img');
  if (!imgEl) return;
  const imgRect = imgEl.getBoundingClientRect();
  // the overlay and image should align inside previewWrap; map overlay coords to image natural pixels
  const ov = overlay.getBoundingClientRect();
  const sel = overlay._lastSel;
  if (!sel) return;
  // compute scale from displayed img to natural size
  const scaleX = imgEl.naturalWidth / imgRect.width;
  const scaleY = imgEl.naturalHeight / imgRect.height;
  const x = Math.round((sel.x - (imgRect.left - ov.left)) * scaleX);
  const y = Math.round((sel.y - (imgRect.top - ov.top)) * scaleY);
  const w = Math.round(sel.w * scaleX);
  const h = Math.round(sel.h * scaleY);
  selection = { x: Math.max(0, x), y: Math.max(0, y), w: Math.max(1, w), h: Math.max(1, h) };
  drawOverlay();
}

function drawOverlay(sel) {
  const c = overlay; const ctx = c.getContext('2d');
  const imgEl = preview.querySelector('img');
  if (!imgEl) { c.style.display = 'none'; return; }
  // size overlay to image display size
  const imgRect = imgEl.getBoundingClientRect();
  const wrapRect = previewWrap.getBoundingClientRect();
  c.width = imgRect.width; c.height = imgRect.height;
  c.style.left = (imgRect.left - wrapRect.left) + 'px';
  c.style.top = (imgRect.top - wrapRect.top) + 'px';
  c.style.position = 'absolute';
  c.style.display = 'block';
  ctx.clearRect(0, 0, c.width, c.height);
  const s = sel || selection;
  if (s) {
    ctx.strokeStyle = 'lime'; ctx.lineWidth = 2; ctx.strokeRect(s.x, s.y, s.w, s.h);
  }
  overlay._lastSel = sel || selection;
}

btnUpload.addEventListener('click', () => fileInput.click());
btnCamera.addEventListener('click', () => cameraInput.click());

fileInput.addEventListener('change', ev => handleFile(ev.target.files[0]));
cameraInput.addEventListener('change', ev => handleFile(ev.target.files[0]));

function handleFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${url}" alt="preview">`;
  ocrTextEl.textContent = 'Processing...';
  parsedNameEl.textContent = '—';
  parsedYearEl.textContent = '—';
  const wantPre = preprocCheckbox.checked;
  const wantAdvanced = advancedCheckbox && advancedCheckbox.checked;
  recognize(file, langSelect.value, wantPre, thresholdCheckbox.checked, wantAdvanced).catch(err => {
    ocrTextEl.textContent = 'Error: ' + String(err);
  });
}

async function recognize(file, langs) {
  const wantPre = arguments.length >= 3 ? arguments[2] : false;
  const wantThresh = arguments.length >= 4 ? arguments[3] : false;
  const wantAdvanced = arguments.length >= 5 ? arguments[4] : false;

  progressEl.textContent = 'Preparing image...';
  let inputFile = file;
  if (wantPre) {
    try {
      const processed = await preprocessImage(file, wantThresh, wantAdvanced);
      inputFile = processed;
      progressEl.textContent = 'Image preprocessed';
    } catch (e) {
      console.warn('preprocess failed', e);
    }
  }

  progressEl.textContent = 'Loading tesseract worker...';
  const { Tesseract } = window;
  const worker = Tesseract.createWorker({
    logger: m => {
      progressEl.textContent = JSON.stringify(m);
    }
  });
  await worker.load();
  await worker.loadLanguage(langs);
  await worker.initialize(langs);

  progressEl.textContent = 'Recognizing...';
  const { data } = await worker.recognize(inputFile);
  ocrTextEl.textContent = data.text || '';
  const parsed = extractNameAndYear(data.text || '');
  parsedNameEl.textContent = parsed.name || '—';
  parsedYearEl.textContent = parsed.year || '—';

  await worker.terminate();
  progressEl.textContent = 'Done';
}

async function runMultiPass(imgEl) {
  progressEl.textContent = 'Running multi-pass OCR...';
  // crop to selection if present
  let cropFile = null;
  if (selection) {
    cropFile = await cropToSelection(imgEl, selection);
  }
  const baseFile = cropFile || await fetchImageAsFile(imgEl);
  const passes = [];
  // try combinations: adv preprocess + threshold, languages
  const langChoices = ['deu_frak', 'deu', 'eng+deu'];
  for (const lang of langChoices) {
    // two variants: with and without threshold/preproc
    passes.push({ file: baseFile, lang, pre: true, thresh: true, adv: true });
    passes.push({ file: baseFile, lang, pre: true, thresh: false, adv: true });
    passes.push({ file: baseFile, lang, pre: true, thresh: true, adv: false });
  }

  let best = { score: -Infinity, text: '', parsed: null };
  for (const p of passes) {
    progressEl.textContent = `OCR pass ${p.lang} pre=${p.pre} thresh=${p.thresh} adv=${p.adv}`;
    try {
      const processed = p.pre ? await preprocessImage(p.file, p.thresh, p.adv) : p.file;
      const res = await ocrRecognizeWithConfidence(processed, p.lang);
      const avgConf = averageConfidence(res);
      const parsed = extractNameAndYear(res.text || '');
      // scoring - prefer higher confidence and presence of a year
      let score = avgConf + (parsed.year ? 20 : 0) + ((parsed.name && parsed.name.length>3) ? 5 : 0);
      if (score > best.score) {
        best = { score, text: res.text, parsed, res };
      }
    } catch (e) {
      console.warn('pass failed', e);
    }
  }

  ocrTextEl.textContent = best.text || '(no result)';
  parsedNameEl.textContent = (best.parsed && best.parsed.name) || '—';
  parsedYearEl.textContent = (best.parsed && best.parsed.year) || '—';
  progressEl.textContent = 'Multi-pass done';
}

function fetchImageAsFile(imgEl) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(b => {
      if (!b) return reject(new Error('no blob'));
      resolve(new File([b], 'crop.png', { type: b.type }));
    }, 'image/png');
  });
}

function cropToSelection(imgEl, sel) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = sel.w; canvas.height = sel.h;
    const ctx = canvas.getContext('2d');
    // draw from natural image using sel coords
    ctx.drawImage(imgEl, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
    canvas.toBlob(b => {
      if (!b) return reject(new Error('no blob'));
      resolve(new File([b], 'crop.png', { type: b.type }));
    }, 'image/png');
  });
}

async function ocrRecognizeWithConfidence(file, lang) {
  const { Tesseract } = window;
  const worker = Tesseract.createWorker();
  await worker.load();
  await worker.loadLanguage(lang);
  await worker.initialize(lang);
  const res = await worker.recognize(file);
  await worker.terminate();
  return { text: res.data.text, words: res.data.words || [] };
}

function averageConfidence(res) {
  if (!res.words || res.words.length === 0) return 0;
  let sum = 0; let count = 0;
  for (const w of res.words) { if (w.confidence != null) { sum += w.confidence; count++; } }
  return count ? (sum / count) : 0;
}

function extractNameAndYear(text) {
  const raw = (text || '').trim();
  const yearMatch = raw.match(/\b(18|19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : undefined;
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let name;
  if (lines.length > 0) {
    name = lines.find(l => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(l) && !/^\d+$/.test(l));
    if (!name) name = lines[0];
  }
  return { name, year, raw };
}

function preprocessImage(file, applyThreshold, advanced) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        // start with original canvas
        let canvas = document.createElement('canvas');
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        // upscale if advanced option enabled (2x or enough to reach ~1200px width)
        if (advanced) {
          const target = 1200;
          const scale = Math.max(1, target / Math.max(width, 1));
          const factor = scale > 1 ? Math.ceil(scale) : 2; // at least 2x
          width = Math.round(width * factor);
          height = Math.round(height * factor);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        // draw with smoothing disabled for crisp upscaling
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // convert to grayscale array
        const gray = new Uint8ClampedArray((data.length / 4));
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
          gray[j] = lum;
        }

        // simple contrast stretch
        let min = 255, max = 0;
        for (let i = 0; i < gray.length; i++) {
          const v = gray[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const range = Math.max(1, max - min);
        for (let i = 0; i < gray.length; i++) {
          gray[i] = Math.round((gray[i] - min) * 255 / range);
        }

        // median denoise if advanced
        if (advanced) {
          const denoised = medianFilter(gray, canvas.width, canvas.height);
          for (let i = 0; i < gray.length; i++) gray[i] = denoised[i];
        }

        // threshold: use Otsu to compute if applyThreshold
        if (applyThreshold) {
          const thresh = otsuThreshold(gray);
          for (let i = 0; i < gray.length; i++) {
            const v = gray[i] < thresh ? 0 : 255;
            gray[i] = v;
          }
        }

        // write back into imageData
        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
          const v = gray[j];
          data[i] = data[i + 1] = data[i + 2] = v;
          data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Could not create blob'));
          const newFile = new File([blob], file.name.replace(/(\.[^.]+)?$/, '-preprocessed$1'), { type: blob.type });
          resolve(newFile);
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => reject(e);
    img.src = URL.createObjectURL(file);
  });
}

function medianFilter(gray, w, h) {
  const out = new Uint8ClampedArray(gray.length);
  const get = (x, y) => {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x >= w) x = w - 1;
    if (y >= h) y = h - 1;
    return gray[y * w + x];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const vals = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          vals.push(get(x + dx, y + dy));
        }
      }
      vals.sort((a, b) => a - b);
      out[y * w + x] = vals[4]; // median of 9
    }
  }
  return out;
}

function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  const total = gray.length;
  for (let i = 0; i < total; i++) hist[gray[i]]++;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }
  return threshold;
}
