import { Component, ElementRef, OnDestroy, ViewChild } from //'@angular/core';
import { OcrService } from '../services/ocr.service';

interface ParseResult {
  name?: string;
  year?: string;
  raw: string;
}

@Component({
  selector: 'app-photo-ocr',
  templateUrl: './photo-ocr.component.html',
  styleUrls: ['./photo-ocr.component.scss'],
})
export class PhotoOcrComponent implements OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;

  imageUrl: string | null = null;
  processing = false;
  ocrText = '';
  parsed: ParseResult | null = null;
  // default language(s) for OCR - allow 'eng', 'deu', or 'eng+deu'
  langs = 'eng';

  constructor(private ocr: OcrService) {}

  ngOnDestroy(): void {
    this.ocr.terminate();
  }

  openFilePicker() {
    this.fileInput.nativeElement.click();
  }

  openCameraPicker() {
    // on mobile browsers this will open the camera when capture attribute is present
    this.cameraInput.nativeElement.click();
  }

  async onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    await this.processFile(file);
    input.value = '';
  }

  private async processFile(file: File) {
    this.imageUrl = await this.readFileAsDataUrl(file);
    this.processing = true;
    this.ocrText = '';
    this.parsed = null;
    try {
  const text = await this.ocr.recognizeImage(file, this.langs);
      this.ocrText = text;
      this.parsed = this.extractNameAndYear(text);
    } catch (err) {
      this.ocrText = 'OCR failed: ' + String(err);
    } finally {
      this.processing = false;
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onerror = rej;
      reader.onload = () => res(String(reader.result));
      reader.readAsDataURL(file);
    });
  }

  private extractNameAndYear(text: string): ParseResult {
    const raw = text.trim();
    // Find a 4-digit year between 1800 and 2099
    const yearMatch = raw.match(/\b(18|19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : undefined;

    // Heuristic: take the first non-empty line with letters for the name
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let name: string | undefined;
    if (lines.length > 0) {
      // prefer lines that contain letters and not mostly numbers
      name = lines.find(l => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(l) && !/^\d+$/.test(l));
      if (!name) name = lines[0];
    }

    return { name, year, raw };
  }
}
