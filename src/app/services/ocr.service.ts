import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OcrService {
  // POST the image to a server-side proxy which calls OpenAI Vision/Responses
  private endpoint = (window as any).__env && (window as any).__env.OCR_ENDPOINT ? (window as any).__env.OCR_ENDPOINT : 'http://localhost:3001/ocr';

  async recognizeImage(file: File, _langs?: string | string[]): Promise<string> {
    const fd = new FormData();
    fd.append('image', file, file.name || 'image.jpg');
    const res = await fetch(this.endpoint, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('OCR server error: ' + res.statusText);
    const json = await res.json();
    return json.text || '';
  }

  async terminate() {
    // no-op for server-based OCR
    return;
  }
}
