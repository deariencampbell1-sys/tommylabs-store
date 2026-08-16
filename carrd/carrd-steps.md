# Putting Tommy Labs on Carrd.co

Carrd is a visual one-page site builder - it does NOT accept HTML file uploads.
Here's the honest, fastest way to get your site on Carrd:

## Option A - Easiest (skip Carrd, live in 30 seconds)
1. Go to https://app.netlify.com/drop
2. Drag the whole unzipped TommyLabs-Site folder onto the page
3. Done - free URL, all 4 product 3D models work, everything works.
   (Neocities or GitHub Pages work too - it's a normal website folder.)

## Option B - Build it inside Carrd (the way Carrd works)
1. Create an account at carrd.co, start a "Blank" one-page site.
2. Rebuild the sections with Carrd's own elements:
   - Hero: Text + Image (upload your photos from img/)
   - Products: Image + Button elements, upload the 4 product photos
   - Custom Orders: a Button or Form (forms need Pro)
3. Paste the whole file carrd/carrd-style.css into:
   Site Settings -> Advanced CSS (or the Custom Code area)
4. 3D models (needs Pro - "Widgets + Embeds"):
   - Host the models/ folder publicly first (Netlify Drop the models folder,
     or GitHub, or any CDN) so every .glb has a real URL
   - Paste carrd/carrd-embed-snippet.txt into a Widget element
   - Replace YOUR-HOST with your hosted URL
5. Publish. Free = yourname.carrd.co. Pro ($19/yr) = your own domain + forms + embeds.

## Local preview (before you publish)
- Windows: double-click Start-Tommy-Labs.bat
- Or run:  python -m http.server 8123  inside this folder, then open
  http://localhost:8123/index.html
