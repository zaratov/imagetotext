import { Injectable } from //'@angular/core';

@Injectable({ providedIn: 'root' })
export class OcrService {
  private worker: any = null;
  private currentLangs = '';

  private normalizeLangs(l: string | string[] | undefined): string {
    if (!l) return 'eng';
    if (Array.isArray(l)) return l.join('+');
    return l;
  }

  async ensureWorker(langs?: string | string[]) {
    const desired = this.normalizeLangs(langs);
    if (this.worker && this.currentLangs === desired) return this.worker;

    if (this.worker && this.currentLangs !== desired) {
      try {
        await this.worker.terminate();
      } catch (e) {
        // ignore
      }
      this.worker = null;
    }

    // dynamic import to avoid adding tesseract to main bundle unless used
    const Tesseract = await import('tesseract.js');
    this.worker = Tesseract.createWorker({
      logger: (_m: any) => {
        // noop - could emit events
      }
    });
    await this.worker.load();
    await this.worker.loadLanguage(desired);
    await this.worker.initialize(desired);
    this.currentLangs = desired;
    return this.worker;
  }

  async recognizeImage(file: File, langs?: string | string[]): Promise<string> {
    const worker = await this.ensureWorker(langs);
    const result = await worker.recognize(file);
    return result?.data?.text || '';
  }

  async terminate() {
    if (!this.worker) return;
    try {
      await this.worker.terminate();
    } catch (e) {
      // ignore
    }
    this.worker = null;
    this.currentLangs = '';
  }
}
