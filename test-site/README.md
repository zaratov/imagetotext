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
