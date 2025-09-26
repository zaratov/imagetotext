Photo OCR component

Files added:
- `photo-ocr.component.ts` - main UI and glue
- `photo-ocr.component.html` - template
- `photo-ocr.component.scss` - styles
- `photo-ocr.module.ts` - Angular module to import
- `../services/ocr.service.ts` - wrapper service around Tesseract.js

Integration:
1. Install Tesseract.js (peer dependency used by the service):

   npm install tesseract.js

2. Import `PhotoOcrModule` into your app module or feature module, then add `<app-photo-ocr></app-photo-ocr>` where you want the UI.

Notes and assumptions:
- This component uses the browser file input with `capture="environment"` to open the camera on mobile devices. Behavior depends on browser support.
- OCR uses the English language (`eng`) by default. If the stolperstein text is in another language, you can change the language in `OcrService` and ensure the appropriate traineddata is available.
- The component now exposes a language selector. Supported example values:
   - `eng` — English
   - `deu` — German
   - `eng+deu` — English and German combined

- Note: The component template uses `[(ngModel)]` for the selector. Make sure the module where you declare or import `PhotoOcrModule` also imports `FormsModule` from `@angular/forms` so `ngModel` works.
- Parsing name/year is best-effort heuristic; you'll likely refine parsing once you have sample images.
