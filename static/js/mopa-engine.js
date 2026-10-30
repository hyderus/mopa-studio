/**
 * MOPA Laser Studio - High-Performance Client-Side Physics Simulation Engine
 * 100% Client-Side Web Technology: Canvas, TypedArrays & Exact Euclidean Distance Transform
 * Enables Zero-Server Hosting on GitHub Pages.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MopaEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Seeded PRNG & Box-Muller Normal Distribution ---
  function createRNG(seed) {
    let s = (seed >>> 0) || 18780;
    return function () {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalRandom(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // --- Exact Euclidean Distance Transform (Felzenszwalb & Huttenlocher Linear Time) ---
  function edt1d(f, d, v, z, n) {
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const dx = q - v[k];
      d[q] = dx * dx + f[v[k]];
    }
  }

  function edt2d(sources, w, h) {
    const INF = 1e9;
    const maxDim = Math.max(w, h);
    const f = new Float32Array(maxDim);
    const d = new Float32Array(maxDim);
    const v = new Int32Array(maxDim);
    const z = new Float32Array(maxDim + 1);
    const distSq = new Float32Array(w * h);

    // Column-wise pass
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        f[y] = sources[y * w + x] ? 0 : INF;
      }
      edt1d(f, d, v, z, h);
      for (let y = 0; y < h; y++) {
        distSq[y * w + x] = d[y];
      }
    }

    // Row-wise pass
    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        f[x] = distSq[rowOffset + x];
      }
      edt1d(f, d, v, z, w);
      for (let x = 0; x < w; x++) {
        distSq[rowOffset + x] = d[x];
      }
    }

    const dist = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      dist[i] = Math.sqrt(distSq[i]);
    }
    return dist;
  }

  // --- Separable 1D Gaussian Blur ---
  function gaussianBlur1D(src, dst, w, h, isHorizontal, sigma, radius) {
    const kSize = radius * 2 + 1;
    const kernel = new Float32Array(kSize);
    let kSum = 0;
    const twoSigSq = 2 * sigma * sigma;
    for (let i = -radius; i <= radius; i++) {
      const val = Math.exp(-(i * i) / twoSigSq);
      kernel[i + radius] = val;
      kSum += val;
    }
    for (let i = 0; i < kSize; i++) kernel[i] /= kSum;

    if (isHorizontal) {
      for (let y = 0; y < h; y++) {
        const rowOffset = y * w;
        for (let x = 0; x < w; x++) {
          let acc = 0;
          for (let k = -radius; k <= radius; k++) {
            let nx = x + k;
            if (nx < 0) nx = 0;
            else if (nx >= w) nx = w - 1;
            acc += src[rowOffset + nx] * kernel[k + radius];
          }
          dst[rowOffset + x] = acc;
        }
      }
    } else {
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          let acc = 0;
          for (let k = -radius; k <= radius; k++) {
            let ny = y + k;
            if (ny < 0) ny = 0;
            else if (ny >= h) ny = h - 1;
            acc += src[ny * w + x] * kernel[k + radius];
          }
          dst[y * w + x] = acc;
        }
      }
    }
  }

  function gaussianBlur2D(src, w, h, sigma, radius) {
    const temp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    gaussianBlur1D(src, temp, w, h, true, sigma, radius);
    gaussianBlur1D(temp, out, w, h, false, sigma, radius);
    return out;
  }

  // --- Color Parsing ---
  function hexToRgb(hex, defaultRgb) {
    try {
      let clean = hex.replace('#', '').trim();
      if (clean.length === 6) {
        return [
          parseInt(clean.substring(0, 2), 16),
          parseInt(clean.substring(2, 4), 16),
          parseInt(clean.substring(4, 6), 16)
        ];
      }
    } catch (e) {}
    return defaultRgb;
  }

  // --- Core Simulation Function ---
  async function generate(params) {
    const t0 = performance.now();

    const text = (params.text || '').toString().trim();
    if (!text) {
      return {
        success: false,
        error: 'No text provided'
      };
    }

    let rawFont = (params.font_family || params.font_id || 'Work Sans').toString();
    let fontFamily = 'Work Sans';
    if (!rawFont.toLowerCase().includes('work') && !rawFont.toLowerCase().includes('sans')) {
      fontFamily = rawFont.replace(/\.[^/.]+$/, '').trim() || 'Work Sans';
    }

    const fontSize = parseInt(params.font_size, 10) || 281;
    const strokeThickness = parseFloat(params.stroke_thickness) || 6.5;
    const letterSpacing = parseInt(params.letter_spacing, 10) || 20;
    const cropPad = parseInt(params.crop_pad, 10) || 4;

    const seed = parseInt(params.seed, 10) || 18780;
    const pitch = parseFloat(params.pitch) || 13.0;
    const teethThreshold = parseFloat(params.teeth_threshold) || 0.25;
    const sawAngle = parseFloat(params.saw_angle) || 0.45;
    const burrShiftX = parseFloat(params.burr_shift_x) || 5.5;
    const burrShiftY = parseFloat(params.burr_shift_y) || 1.5;
    const burrWeight = parseFloat(params.burr_weight) || 0.9;
    const jitterRange = parseInt(params.jitter_range, 10) || 5;
    const outerLipIntensity = parseFloat(params.outer_lip_intensity) || 0.16;
    const outerLipDist = parseFloat(params.outer_lip_dist) || 2.5;
    const innerTrenchIntensity = parseFloat(params.inner_trench_intensity) || 0.3;
    const innerTrenchDist = parseFloat(params.inner_trench_dist) || 6.5;
    const slagNoiseWeight = parseFloat(params.slag_noise_weight) || 0.45;
    const fineNoiseWeight = parseFloat(params.fine_noise_weight) || 0.08;

    const cDark = hexToRgb(params.c_dark_hex || '#4a2c14', [74, 44, 20]);
    const cMid = hexToRgb(params.c_mid_hex || '#c99762', [201, 151, 98]);
    const cLight = hexToRgb(params.c_light_hex || '#f2d39e', [242, 211, 158]);

    // Force font load into browser layout engine
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      try {
        await document.fonts.load(`bold ${fontSize}px "${fontFamily}"`);
        await document.fonts.load(`bold ${fontSize}px "Work Sans"`);
        await document.fonts.ready;
      } catch (e) {}
    }

    // 1. Render Base Text Mask on Offscreen Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Font string: support variable/bold weight
    const fontSpec = `bold ${fontSize}px "${fontFamily}", "Work Sans", sans-serif`;
    ctx.font = fontSpec;

    // Measure character dimensions and track spacing
    const charList = Array.from(text);
    let totalTextWidth = 0;
    const charMetrics = [];

    for (let i = 0; i < charList.length; i++) {
      const ch = charList[i];
      const m = ctx.measureText(ch);
      const cw = m.width;
      charMetrics.push({ ch, cw, metrics: m });
      totalTextWidth += cw + (i < charList.length - 1 ? letterSpacing : 0);
    }

    // Estimate height
    const sampleM = ctx.measureText(text);
    const ascent = Math.ceil(sampleM.actualBoundingBoxAscent || fontSize * 0.85);
    const descent = Math.ceil(sampleM.actualBoundingBoxDescent || fontSize * 0.25);
    const textHeight = ascent + descent;

    const pad = 40 + Math.max(0, Math.floor(Math.abs(strokeThickness) * 2.5));
    const w = Math.ceil(totalTextWidth + pad * 2);
    const h = Math.ceil(textHeight + pad * 2);

    canvas.width = w;
    canvas.height = h;

    ctx.font = fontSpec;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'alphabetic';

    let currentX = pad;
    const baselineY = pad + ascent;

    for (let i = 0; i < charMetrics.length; i++) {
      const item = charMetrics[i];
      ctx.fillText(item.ch, currentX, baselineY);
      currentX += item.cw + letterSpacing;
    }

    const rawData = ctx.getImageData(0, 0, w, h).data;
    const baseMask = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      baseMask[i] = rawData[i * 4 + 3] / 255.0;
    }

    // 2. Sub-Pixel Stroke Weight (Thicker / Thinner via Signed Distance Transform)
    if (Math.abs(strokeThickness) > 0.05) {
      const sourcesOut = new Uint8Array(w * h);
      const sourcesIn = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) {
        if (baseMask[i] > 0.4) {
          sourcesIn[i] = 1;
        } else {
          sourcesOut[i] = 1;
        }
      }
      const distIn = edt2d(sourcesOut, w, h);
      const distOut = edt2d(sourcesIn, w, h);
      for (let i = 0; i < w * h; i++) {
        const signedDist = distIn[i] - distOut[i];
        let v = signedDist + strokeThickness + 0.5;
        if (v < 0) v = 0;
        else if (v > 1) v = 1;
        baseMask[i] = v;
      }
    }

    // 3. Sawtooth Burr Pattern
    const burrLayer = new Float32Array(w * h);
    const invPitch = 1.0 / pitch;

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      const srcY = y - burrShiftY;
      const y0 = Math.floor(srcY);
      const dy = srcY - y0;

      for (let x = 0; x < w; x++) {
        let phase = ((y + x * sawAngle) % pitch + pitch) % pitch * invPitch;
        if (phase > teethThreshold) {
          const srcX = x - burrShiftX;
          const x0 = Math.floor(srcX);
          const dx = srcX - x0;

          if (x0 >= 0 && x0 + 1 < w && y0 >= 0 && y0 + 1 < h) {
            const i00 = y0 * w + x0;
            const v = (1 - dx) * (1 - dy) * baseMask[i00] +
                      dx * (1 - dy) * baseMask[i00 + 1] +
                      (1 - dx) * dy * baseMask[i00 + w] +
                      dx * dy * baseMask[i00 + w + 1];
            burrLayer[rowOffset + x] = v;
          } else if (x0 >= 0 && x0 < w && y0 >= 0 && y0 < h) {
            burrLayer[rowOffset + x] = baseMask[y0 * w + x0];
          }
        }
      }
    }

    // 4. Scan-Line Edge Jitter
    const rng = createRNG(seed);
    const span = jitterRange * 2 + 1;
    const jitteredMask = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      const j = Math.floor(rng() * span) - jitterRange;

      for (let x = 0; x < w; x++) {
        let sx = x - j;
        if (sx < 0) sx = (sx % w + w) % w;
        else if (sx >= w) sx = sx % w;
        jitteredMask[rowOffset + x] = baseMask[rowOffset + sx];
      }
    }

    // 5. Combined Burrs & Solid Mask Formation
    const combined = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      combined[i] = Math.max(jitteredMask[i], burrLayer[i] * burrWeight);
    }

    const combinedBlur = gaussianBlur2D(combined, w, h, 1.0, 2);
    const solidMaskSources = new Uint8Array(w * h);
    const solidMask = new Uint8Array(w * h);

    for (let i = 0; i < w * h; i++) {
      if (combinedBlur[i] > 0.38) {
        solidMask[i] = 255;
        solidMaskSources[i] = 0;
      } else {
        solidMask[i] = 0;
        solidMaskSources[i] = 1;
      }
    }

    // 6. Laser Trench Distance Transform
    const dist = edt2d(solidMaskSources, w, h);

    // 7. Raised Melt Lip & Inner Trench Grooves
    const outerLip = new Float32Array(w * h);
    const innerTrench = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
      const d = dist[i];
      const dl = d - outerLipDist;
      outerLip[i] = Math.exp(-(dl * dl) / 3.0) * outerLipIntensity;

      const dt = d - innerTrenchDist;
      innerTrench[i] = -Math.exp(-(dt * dt) / 5.0) * innerTrenchIntensity;
    }

    // 8. Slag Texture & Fine Optical Micro-Noise
    const cw = Math.max(1, Math.floor(w / 7));
    const ch = Math.max(1, Math.floor(h / 4));
    const coarse = new Float32Array(cw * ch);
    for (let i = 0; i < cw * ch; i++) coarse[i] = normalRandom(rng);

    const slag = new Float32Array(w * h);
    let minS = Infinity, maxS = -Infinity;

    for (let y = 0; y < h; y++) {
      const sy = (y / Math.max(1, h - 1)) * (ch - 1);
      const y0 = Math.floor(sy);
      const y1 = Math.min(ch - 1, y0 + 1);
      const dy = sy - y0;

      for (let x = 0; x < w; x++) {
        const sx = (x / Math.max(1, w - 1)) * (cw - 1);
        const x0 = Math.floor(sx);
        const x1 = Math.min(cw - 1, x0 + 1);
        const dx = sx - x0;

        const v = (1 - dx) * (1 - dy) * coarse[y0 * cw + x0] +
                  dx * (1 - dy) * coarse[y0 * cw + x1] +
                  (1 - dx) * dy * coarse[y1 * cw + x0] +
                  dx * dy * coarse[y1 * cw + x1];
        slag[y * w + x] = v;
        if (v < minS) minS = v;
        if (v > maxS) maxS = v;
      }
    }

    const sDiff = maxS - minS + 1e-6;
    for (let i = 0; i < w * h; i++) {
      slag[i] = (slag[i] - minS) / sDiff;
    }

    const fineNoiseRaw = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) fineNoiseRaw[i] = normalRandom(rng);
    const fineNoise = gaussianBlur2D(fineNoiseRaw, w, h, 0.8, 1);

    // 9. Height Map & Oxidation Dual-Branch Colors
    const solidMaskFloat = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) solidMaskFloat[i] = solidMask[i];
    const alphaBlur = gaussianBlur2D(solidMaskFloat, w, h, 0.6, 1);

    const rgba = new Uint8ClampedArray(w * h * 4);

    for (let i = 0; i < w * h; i++) {
      let hm = 0.58 + (slag[i] - 0.5) * slagNoiseWeight + fineNoise[i] * fineNoiseWeight + outerLip[i] + innerTrench[i];
      if (hm < 0) hm = 0;
      else if (hm > 1) hm = 1;

      let r, g, b;
      if (hm < 0.5) {
        const t = hm * 2.0;
        r = cDark[0] + (cMid[0] - cDark[0]) * t;
        g = cDark[1] + (cMid[1] - cDark[1]) * t;
        b = cDark[2] + (cMid[2] - cDark[2]) * t;
      } else {
        const t = (hm - 0.5) * 2.0;
        r = cMid[0] + (cLight[0] - cMid[0]) * t;
        g = cMid[1] + (cLight[1] - cMid[1]) * t;
        b = cMid[2] + (cLight[2] - cMid[2]) * t;
      }

      let edge = dist[i] / 2.0;
      if (edge < 0.35) edge = 0.35;
      else if (edge > 1.0) edge = 1.0;

      r *= edge;
      g *= edge;
      b *= edge;

      const idx = i * 4;
      rgba[idx] = Math.min(255, Math.max(0, Math.round(r)));
      rgba[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      rgba[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      rgba[idx + 3] = Math.min(255, Math.max(0, Math.round(alphaBlur[i])));
    }

    // 10. Tight Bounding Box Auto-Crop
    let minX = w, maxX = 0, minY = h, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (rgba[(y * w + x) * 4 + 3] > 0) {
          hasPixels = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixels) {
      minX = 0; maxX = Math.min(10, w - 1);
      minY = 0; maxY = Math.min(10, h - 1);
    }

    minX = Math.max(0, minX - cropPad);
    minY = Math.max(0, minY - cropPad);
    maxX = Math.min(w - 1, maxX + cropPad);
    maxY = Math.min(h - 1, maxY + cropPad);

    const cropW = Math.max(1, maxX - minX + 1);
    const cropH = Math.max(1, maxY - minY + 1);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = cropW;
    outCanvas.height = cropH;
    const outCtx = outCanvas.getContext('2d');

    const fullImgData = new ImageData(rgba, w, h);
    ctx.putImageData(fullImgData, 0, 0);

    outCtx.drawImage(
      canvas,
      minX, minY, cropW, cropH,
      0, 0, cropW, cropH
    );

    const dataUrl = outCanvas.toDataURL('image/png');
    const elapsedMs = Math.round((performance.now() - t0) * 10) / 10;
    const approxKb = Math.round((dataUrl.length * 0.75) / 102.4) / 10;

    // Filename: First 15 alphanumeric characters
    const clean15 = text.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15) || 'output';
    const filename = `${clean15}.png`;

    return {
      success: true,
      imageData: dataUrl,
      filename: filename,
      width: cropW,
      height: cropH,
      fileSizeKb: approxKb,
      renderTimeMs: elapsedMs,
      canvas: outCanvas
    };
  }

  return {
    generate: generate,
    edt2d: edt2d,
    gaussianBlur2D: gaussianBlur2D
  };
});
