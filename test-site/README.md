Test site for Photo OCR

How to run

1. Open the folder in a static server. For example, with Python 3:

   ```bash
   # zsh
   cd test-site
   python3 -m http.server 8080
   ```

2. Open http://localhost:8080 in a browser on your desktop or phone. Use the "Take photo" button on a mobile device to open the camera.

Notes
- This site uses Tesseract.js from UNPKG CDN. The first recognition will download language files.
- Use the language selector to switch between `eng`, `deu`, and `eng+deu`.

OpenAI proxy (optional)
- I added a small Express proxy at `server/index.js` that accepts POST `/ocr` with form field `image` and forwards it to OpenAI Responses for vision-based text extraction. This keeps your API key server-side.
- To run it:

   ```bash
   cd server
   npm install
   # set OPENAI_API_KEY in environment or .env file
   npm start
   ```

- The Angular `OcrService` is updated to POST images to `http://localhost:3001/ocr` by default. Adjust `__env.OCR_ENDPOINT` if you host elsewhere.
