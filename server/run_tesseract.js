const path = require('path');
const file = process.argv[2];
if (!file) {
  console.error('Usage: node run_tesseract.js /path/to/image.jpg');
  process.exit(2);
}
(async () => {
  try {
  const tesseract = require('tesseract.js');
  const { createWorker } = tesseract;
  let corePath;
  try {
  const resolvedWasm = require.resolve('tesseract.js-core/tesseract-core.wasm');
  const resolvedJs = resolvedWasm.replace(/\.wasm$/, '.js');
  // corePath should be a file:// URL so the WASM loader can parse it; workerPath must be a regular file path so Node can require it
  corePath = resolvedWasm && resolvedWasm.startsWith('file://') ? resolvedWasm : `file://${resolvedWasm}`;
  workerPath = resolvedJs; // leave as plain absolute path for requiring
    console.log('Resolved tesseract core JS path:', workerPath);
  } catch (e) {
    corePath = undefined;
    workerPath = undefined;
  }
  console.log('Running tesseract on', file, 'corePath:', corePath, 'workerPath:', workerPath);
  const worker = createWorker(corePath || workerPath ? { corePath, workerPath } : {});
  console.log('Calling worker.load()');
  await Promise.race([
    worker.load(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('worker.load() timed out')), 15000))
  ]);
  console.log('Calling worker.loadLanguage(eng)');
  await Promise.race([
    worker.loadLanguage('eng'),
    new Promise((_, rej) => setTimeout(() => rej(new Error('worker.loadLanguage timed out')), 15000))
  ]);
  console.log('Calling worker.initialize(eng)');
  await Promise.race([
    worker.initialize('eng'),
    new Promise((_, rej) => setTimeout(() => rej(new Error('worker.initialize timed out')), 15000))
  ]);
  console.log('Calling worker.recognize(...)');
  const { data: { text } } = await Promise.race([
    worker.recognize(file),
    new Promise((_, rej) => setTimeout(() => rej(new Error('worker.recognize timed out')), 300000))
  ]);
  console.log('Terminating worker');
  await worker.terminate();
  console.log('\n--- OCR RESULT START ---\n');
  console.log(text);
  console.log('\n--- OCR RESULT END ---\n');
  } catch (err) {
    console.error('Tesseract error:', err && err.message ? err.message : err);
    process.exit(3);
  }
})();
