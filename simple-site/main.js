// Simple client for uploading or taking a photo and sending to local proxy or doing client OCR (Tesseract CDN)
const fileInput = document.getElementById('fileInput');
const cameraInput = document.getElementById('cameraInput');
const btnUpload = document.getElementById('btnUpload');
const btnCamera = document.getElementById('btnCamera');
const preview = document.getElementById('preview');
const btnSubmit = document.getElementById('btnSubmit');
const useProxy = document.getElementById('useProxy');
const proxyUrl = document.getElementById('proxyUrl');
const langSelect = document.getElementById('lang');
const ocrText = document.getElementById('ocrText');
const parsedName = document.getElementById('parsedName');
const parsedYear = document.getElementById('parsedYear');

let selectedFile = null;

btnUpload.addEventListener('click', () => fileInput.click());
btnCamera.addEventListener('click', () => cameraInput.click());
fileInput.addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]); });
cameraInput.addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]); });

function loadFile(file) {
  try {
    selectedFile = file;
    // revoke previous object URL to avoid leaking memory
    if (window.__currentObjectURL) {
      try { URL.revokeObjectURL(window.__currentObjectURL); } catch (e) {}
      window.__currentObjectURL = null;
    }
    const url = URL.createObjectURL(file);
    window.__currentObjectURL = url;
    // only set the preview image src; do not touch document.body background
    preview.src = url;
    // ensure controls and container are visible (in case browser hides them)
    const container = document.querySelector('.container');
    if (container) container.style.display = '';
  ocrText.textContent = '(ready)';
  parsedName.textContent = '—';
  parsedYear.textContent = '—';
  } catch (err) {
    console.error('loadFile error', err);
    alert('Failed to load image: ' + (err && err.message ? err.message : err));
  }
}

// Prevent the browser from navigating away when an image is dropped on the window
function preventAndHandleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length) {
    const f = dt.files[0];
    if (f.type && f.type.startsWith('image/')) loadFile(f);
  }
}
window.addEventListener('dragover', (e) => { e.preventDefault(); });
window.addEventListener('drop', preventAndHandleDrop);

// also prevent accidental navigation on paste of an image URL
window.addEventListener('paste', (e) => {
  const items = (e.clipboardData || window.clipboardData).items || [];
  for (const it of items) {
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      const file = it.getAsFile();
      if (file) loadFile(file);
      e.preventDefault();
      return;
    }
  }
});

// Stronger drag/drop prevention for whole document (some browsers still navigate on drop)
['dragenter','dragover','dragleave','drop'].forEach((name) => {
  document.addEventListener(name, function(e){
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, { passive: false });
});

// ensure the file inputs don't bubble accidental events that could navigate
['fileInput','cameraInput'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', (e) => e.stopPropagation());
});

async function doClientTesseract(file, lang) {
  ocrText.textContent = 'Running Tesseract.js in browser...';
  // lazy load CDN
  if (!window.Tesseract) {
    ocrText.textContent = 'Tesseract.js not loaded.';
    return null;
  }
  const worker = Tesseract.createWorker({ logger: m => { /* optional */ } });
  await worker.load();
  await worker.loadLanguage(lang);
  await worker.initialize(lang);
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();
  return text;
}

async function submitToProxy(file, url) {
  ocrText.textContent = 'Uploading to proxy...';
  const fd = new FormData();
  fd.append('image', file, file.name);
  try {
    const resp = await fetch(url, { method: 'POST', body: fd });
    if (!resp.ok) throw new Error('Bad response: ' + resp.status);
    const json = await resp.json();
    return json;
  } catch (e) {
    throw e;
  }
}

btnSubmit.addEventListener('click', async () => {
  if (!selectedFile) { alert('Choose an image first'); return; }
  const lang = langSelect.value || 'eng';
  try {
    if (useProxy.checked) {
      const url = proxyUrl.value;
      const json = await submitToProxy(selectedFile, url);
      ocrText.textContent = JSON.stringify(json, null, 2);
      parsedName.textContent = json.name || '—';
      parsedYear.textContent = json.year || '—';
    } else {
      // run client OCR with Tesseract CDN
      if (!window.Tesseract) {
        ocrText.textContent = 'Tesseract.js not available in this page. Open test-site/index.html which loads it via CDN.';
        return;
      }
      const text = await doClientTesseract(selectedFile, lang);
      ocrText.textContent = text;
      // best-effort parse simple name/year from text
      const nameMatch = text.match(/[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]+){0,3}/);
      const yearMatch = text.match(/\b(18|19|20)\d{2}\b/);
      parsedName.textContent = nameMatch ? nameMatch[0] : '—';
      parsedYear.textContent = yearMatch ? yearMatch[0] : '—';
    }
  } catch (e) {
    ocrText.textContent = 'Error: ' + (e && e.message ? e.message : String(e));
  }
});

// expose helper for debugging
window.__simpleOcr = { loadFile };
