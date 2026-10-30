# MOPA Laser Engraver Studio Web App

A high-fidelity web application inspired by Apple website aesthetics that transforms numbers, serials, and custom text into authentic **MOPA (Master Oscillator Power Amplifier) pulsed fiber laser markings** with micro-melt trenches, angled scan-line burrs, oxidation colors, and 32-bit transparent PNG export.

Designed to be hosted **100% statically on GitHub Pages with zero server backend**, while also remaining fully compatible with local Python / Flask execution.

---

## Deploy to GitHub Pages (2 Minutes)

Because this app runs entirely in the client's browser (HTML5 Canvas, TypedArrays, and sub-pixel Euclidean Distance Transforms), you can host it for free forever on GitHub Pages:

### Step 1: Initialize Git and Commit
In your terminal / PowerShell inside the project directory:
```bash
git init
git add .
git commit -m "Initial commit of MOPA Laser Studio"
```

### Step 2: Push to GitHub
Create a new public repository on GitHub (e.g. `mopa`), then push your code:
```bash
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub.
2. Click **Settings** > **Pages** (in the left sidebar).
3. Under **Branch**, select `main` and `/ (root)`.
4. Click **Save**.

Your application will be live in ~60 seconds at:
```
https://<your-username>.github.io/<your-repo-name>/
```

---

## Local Development (Optional Python Server)

If you also wish to run the app locally with Python:

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start local server
python app.py
```
Open **`http://127.0.0.1:5000`** in your browser.

---

## Core Capabilities

- **Zero-Server Client-Side Physics**:
  - Exact Euclidean Distance Transform ($O(N)$ Felzenszwalb-Huttenlocher algorithm) runs in < 25ms right in the user's browser.
  - Sub-pixel stroke weighting (dilation and erosion) for continuous thickness control (-8px to +15px).
  - Galvo scan-line teeth frequency, saw angles, edge burrs, row jitter, molten metal lips, and central ablation trench.
  - Dual-branch oxidation color mapping with anti-halo edge darkening.
- **Custom Font Loading**:
  - Drag and drop any `.TTF` or `.OTF` font file. Loaded via the browser's native `FontFace` API and persisted in browser `IndexedDB` across sessions.
  - Bundled with `Work Sans` variable font as the default standard.
- **Batch Serial Number Generator**:
  - Input up to 50 serial numbers at once; each image is rendered and downloaded directly as an individual `.png` file named after its first 15 characters (e.g. `354487204948849.png`).
- **Apple Website Aesthetic**:
  - Frosted capsule buttons with chromatic blur glow.
  - Native-style sliders with live progress fill tracks.
  - Full Dark Mode / Light Mode support with state persistence.
  - Zero emojis across the entire UI.
