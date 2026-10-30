/**
 * MOPA Laser Studio - Client Application
 * Apple Website Aesthetic, Frosted Glass Controls, Native Dark Mode
 * 100% Client-Side Physics Simulation for Static GitHub Pages & Local Server Compatibility
 * Zero Emojis Across Entire UI
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const htmlDoc = document.documentElement;
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Text & Main Inputs
  const textInput = document.getElementById('textInput');
  const liveFontPreview = document.getElementById('liveFontPreview');
  const charCount = document.getElementById('charCount');

  // Font Management
  const fontSelect = document.getElementById('fontSelect');
  const activeFontBadge = document.getElementById('activeFontBadge');
  const fontFamilyLabel = document.getElementById('fontFamilyLabel');
  const fontSizeKbLabel = document.getElementById('fontSizeKbLabel');
  const fontUploadDropzone = document.getElementById('fontDropZone');
  const fontFileInput = document.getElementById('fontFileInput');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  // Color Pickers
  const colorDarkPicker = document.getElementById('colorDarkPicker');
  const colorDarkHex = document.getElementById('colorDarkHex');
  const colorMidPicker = document.getElementById('colorMidPicker');
  const colorMidHex = document.getElementById('colorMidHex');
  const colorLightPicker = document.getElementById('colorLightPicker');
  const colorLightHex = document.getElementById('colorLightHex');

  // Preview Stage
  const stageContainer = document.getElementById('stageContainer');
  const interactiveStage = document.getElementById('interactiveStage');
  const imageWrapper = document.getElementById('imageWrapper');
  const mopaOutputImage = document.getElementById('mopaOutputImage');
  const stageLoading = document.getElementById('stageLoading');
  const stageEmpty = document.getElementById('stageEmpty');
  const zoomLevel = document.getElementById('zoomLevel');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');

  // Canvas Metadata
  const metaResolution = document.getElementById('metaResolution');
  const metaSize = document.getElementById('metaSize');
  const metaSpeed = document.getElementById('metaSpeed');
  const appStatus = document.getElementById('appStatus');

  // Action Buttons
  const copyBtn = document.getElementById('copyImageBtn');
  const downloadBtnLink = document.getElementById('downloadBtnLink');
  const outputFileName = document.getElementById('outputFileName');
  const batchModalBtn = document.getElementById('openBatchModalBtn');

  // Batch Modal
  const batchModal = document.getElementById('batchModal');
  const closeBatchBtn = document.getElementById('closeBatchModalBtn');
  const cancelBatchBtn = document.getElementById('cancelBatchBtn');
  const runBatchBtn = document.getElementById('runBatchBtn');
  const batchTextarea = document.getElementById('batchTextarea');
  const batchProgressArea = document.getElementById('batchProgressArea');
  const batchProgressBar = document.getElementById('batchProgressBar');
  const batchStatusText = document.getElementById('batchStatusText');

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  // Seed Input & Randomize
  const seedInput = document.getElementById('seedInput');
  const randomizeSeedBtn = document.getElementById('randomizeSeedBtn');
  const randomizeSeedHeaderBtn = document.getElementById('randomizeSeedHeaderBtn');

  // Slider & Number Box Definitions
  const sliderControls = [
    { sliderId: 'strokeThicknessInput', valId: 'strokeThicknessVal' },
    { sliderId: 'fontSizeInput', valId: 'fontSizeVal' },
    { sliderId: 'letterSpacingInput', valId: 'letterSpacingVal' },
    { sliderId: 'cropPadInput', valId: 'cropPadVal' },
    { sliderId: 'pitchInput', valId: 'pitchVal' },
    { sliderId: 'sawAngleInput', valId: 'sawAngleVal' },
    { sliderId: 'teethThreshInput', valId: 'teethThreshVal' },
    { sliderId: 'jitterInput', valId: 'jitterVal' },
    { sliderId: 'lipIntensityInput', valId: 'lipIntensityVal' },
    { sliderId: 'trenchIntensityInput', valId: 'trenchIntensityVal' },
    { sliderId: 'slagNoiseInput', valId: 'slagNoiseVal' }
  ];

  // State
  let currentZoom = 1.0;
  let isRendering = false;
  let queuedRender = false;
  let currentImageDataUri = null;
  let loadedCustomFonts = new Set();
  let renderDebounceTimer = null;

  // --- Initialize Application ---
  initApp();

  async function initApp() {
    initTheme();
    setupSliderPairs();
    setupEventListeners();
    updateCharCount();
    updateAllSliderFills();
    await loadFontCatalog('WorkSans-VariableFont_wght.ttf');
  }

  // --- Theme Management (Light / Dark Mode) ---
  function initTheme() {
    const savedTheme = localStorage.getItem('mopa_theme') || 'light';
    setTheme(savedTheme);

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const isDark = htmlDoc.classList.contains('dark-theme');
        setTheme(isDark ? 'light' : 'dark');
      });
    }
  }

  function setTheme(theme) {
    if (theme === 'dark') {
      htmlDoc.classList.remove('light-theme');
      htmlDoc.classList.add('dark-theme');
      localStorage.setItem('mopa_theme', 'dark');
      if (themeToggleBtn) themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
    } else {
      htmlDoc.classList.remove('dark-theme');
      htmlDoc.classList.add('light-theme');
      localStorage.setItem('mopa_theme', 'light');
      if (themeToggleBtn) themeToggleBtn.setAttribute('title', 'Switch to Dark Mode');
    }
  }

  // --- Filename Formatter: First 15 alphanumeric characters ---
  function formatFilename(text) {
    const clean = text.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
    return clean ? `${clean}.png` : '';
  }

  function updateOutputFilename() {
    const val = textInput.value.trim();
    if (val) {
      const fname = formatFilename(val);
      outputFileName.value = fname;
      downloadBtnLink.setAttribute('download', fname);
    } else {
      outputFileName.value = '';
      outputFileName.placeholder = 'output.png';
      downloadBtnLink.setAttribute('download', 'output.png');
    }
  }

  // --- Resolve Font Family Name ---
  function resolveFontFamily(opt) {
    if (!opt) return 'Work Sans';
    if (opt.dataset && opt.dataset.fontFamily) return opt.dataset.fontFamily;
    const val = (opt.value || '').toLowerCase();
    if (val.includes('work') || val.includes('sans')) return 'Work Sans';
    return opt.dataset.name || opt.textContent.trim() || 'Work Sans';
  }

  // --- Active Simulation Settings Collection ---
  function getActiveSimulationSettings() {
    const activeOpt = fontSelect.options[fontSelect.selectedIndex];
    const fontFamily = resolveFontFamily(activeOpt);
    const fontId = fontSelect.value || 'WorkSans-VariableFont_wght.ttf';

    const getVal = (id, def) => {
      const el = document.getElementById(id);
      return el ? (parseFloat(el.value) || def) : def;
    };

    return {
      font_id: fontId,
      font_family: fontFamily,
      font_size: parseInt(getVal('fontSizeInput', 281), 10),
      stroke_thickness: getVal('strokeThicknessInput', 6.5),
      letter_spacing: parseInt(getVal('letterSpacingInput', 20), 10),
      crop_pad: parseInt(getVal('cropPadInput', 4), 10),
      seed: parseInt(seedInput ? seedInput.value : 18780, 10) || 18780,
      pitch: getVal('pitchInput', 13.0),
      saw_angle: getVal('sawAngleInput', 0.45),
      teeth_threshold: getVal('teethThreshInput', 0.25),
      jitter_range: parseInt(getVal('jitterInput', 5), 10),
      outer_lip_intensity: getVal('lipIntensityInput', 0.16),
      outer_lip_dist: 2.5,
      inner_trench_intensity: getVal('trenchIntensityInput', 0.3),
      inner_trench_dist: 6.5,
      slag_noise_weight: getVal('slagNoiseInput', 0.45),
      fine_noise_weight: 0.08,
      burr_shift_x: 5.5,
      burr_shift_y: 1.5,
      burr_weight: 0.9,
      c_dark_hex: colorDarkHex ? colorDarkHex.value : '#4a2c14',
      c_mid_hex: colorMidHex ? colorMidHex.value : '#c99762',
      c_light_hex: colorLightHex ? colorLightHex.value : '#f2d39e'
    };
  }

  // --- Slider & Number Box Synchronization ---
  function setupSliderPairs() {
    sliderControls.forEach(({ sliderId, valId }) => {
      const slider = document.getElementById(sliderId);
      const numBox = document.getElementById(valId);
      if (!slider || !numBox) return;

      slider.addEventListener('input', () => {
        numBox.value = slider.value;
        updateSliderFill(slider);
        if (textInput.value.trim()) {
          debounceRender(40);
        }
      });

      numBox.addEventListener('input', () => {
        slider.value = numBox.value;
        updateSliderFill(slider);
        if (textInput.value.trim()) {
          debounceRender(40);
        }
      });

      numBox.addEventListener('change', () => {
        slider.value = numBox.value;
        updateSliderFill(slider);
        if (textInput.value.trim()) {
          renderEngraving();
        }
      });
    });
  }

  // --- Live Slider Fill Track Calculation ---
  function updateSliderFill(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const val = parseFloat(slider.value) || 0;
    const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    slider.style.setProperty('--slider-fill-pct', `${pct}%`);
  }

  function updateAllSliderFills() {
    sliderControls.forEach(({ sliderId }) => {
      const slider = document.getElementById(sliderId);
      if (slider) updateSliderFill(slider);
    });
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Text Input
    textInput.addEventListener('input', () => {
      updateCharCount();
      liveFontPreview.textContent = textInput.value || 'Work Sans Preview';
      updateOutputFilename();

      if (textInput.value.trim()) {
        debounceRender(60);
      } else {
        clearCanvas();
      }
    });

    // Font Select Change
    fontSelect.addEventListener('change', () => {
      const opt = fontSelect.options[fontSelect.selectedIndex];
      if (opt) {
        updateActiveFontDisplay(opt);
        if (textInput.value.trim()) {
          renderEngraving();
        }
      }
    });

    // Randomize Seed Buttons
    function triggerRandomSeed() {
      const newSeed = Math.floor(Math.random() * 90000) + 10000;
      if (seedInput) seedInput.value = newSeed;
      if (textInput.value.trim()) {
        renderEngraving();
      }
    }

    if (randomizeSeedBtn) randomizeSeedBtn.addEventListener('click', triggerRandomSeed);
    if (randomizeSeedHeaderBtn) randomizeSeedHeaderBtn.addEventListener('click', triggerRandomSeed);
    if (seedInput) {
      seedInput.addEventListener('change', () => {
        if (textInput.value.trim()) renderEngraving();
      });
    }

    // Font Upload Drag & Drop
    if (fontUploadDropzone) {
      ['dragenter', 'dragover'].forEach(name => {
        fontUploadDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          fontUploadDropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        fontUploadDropzone.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          fontUploadDropzone.classList.remove('dragover');
        });
      });

      fontUploadDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
          uploadFontFile(files[0]);
        }
      });
    }

    if (fontFileInput) {
      fontFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          uploadFontFile(e.target.files[0]);
        }
      });
    }

    // Color Pickers Setup
    setupColorPicker(colorDarkPicker, colorDarkHex);
    setupColorPicker(colorMidPicker, colorMidHex);
    setupColorPicker(colorLightPicker, colorLightHex);

    // Surface Preview Switches (.substrate-chip: Grid, Metal, Black, White)
    const substrateChips = document.querySelectorAll('.substrate-chip');
    substrateChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        substrateChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const bg = chip.dataset.bg || 'checkerboard';
        const surfaceClass = 'surface-' + bg;

        if (interactiveStage) {
          interactiveStage.className = 'stage-canvas ' + surfaceClass;
        }
        if (stageContainer) {
          stageContainer.classList.remove('surface-checkerboard', 'surface-metal', 'surface-black', 'surface-white');
          stageContainer.classList.add(surfaceClass);
        }
      });
    });

    // Zoom Controls (+, -, Fit)
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        adjustZoom(0.25);
      });
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        adjustZoom(-0.25);
      });
    }
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fitImageToView();
      });
    }
    if (zoomLevel) {
      zoomLevel.style.cursor = 'pointer';
      zoomLevel.title = 'Click to toggle 100% / 200%';
      zoomLevel.addEventListener('click', () => {
        setZoom(currentZoom === 1.0 ? 2.0 : 1.0);
      });
    }

    // Mouse Wheel Zoom over stage
    const zoomTarget = interactiveStage || stageContainer;
    if (zoomTarget) {
      zoomTarget.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey || (mopaOutputImage && mopaOutputImage.style.display !== 'none')) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.2 : -0.2;
          adjustZoom(delta);
        }
      }, { passive: false });
    }

    // Copy to Clipboard
    if (copyBtn) copyBtn.addEventListener('click', copyImageToClipboard);

    // Batch Generator Modal
    if (batchModalBtn && batchModal) {
      batchModalBtn.addEventListener('click', () => {
        batchModal.classList.remove('hidden');
        if (batchTextarea) batchTextarea.focus();
      });
    }

    if (closeBatchBtn && batchModal) closeBatchBtn.addEventListener('click', () => batchModal.classList.add('hidden'));
    if (cancelBatchBtn && batchModal) cancelBatchBtn.addEventListener('click', () => batchModal.classList.add('hidden'));

    if (batchModal) {
      batchModal.addEventListener('click', (e) => {
        if (e.target === batchModal) {
          batchModal.classList.add('hidden');
        }
      });
    }

    if (runBatchBtn) runBatchBtn.addEventListener('click', runBatchGeneration);
  }

  // --- Color Picker Setup ---
  function setupColorPicker(picker, textInputElem) {
    if (!picker || !textInputElem) return;
    textInputElem.value = picker.value;

    picker.addEventListener('input', () => {
      textInputElem.value = picker.value;
      if (textInput.value.trim()) debounceRender(40);
    });

    picker.addEventListener('change', () => {
      if (textInput.value.trim()) renderEngraving();
    });

    textInputElem.addEventListener('input', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(textInputElem.value)) {
        picker.value = textInputElem.value;
        if (textInput.value.trim()) debounceRender(40);
      }
    });

    textInputElem.addEventListener('change', () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(textInputElem.value)) {
        if (textInput.value.trim()) renderEngraving();
      }
    });
  }

  function updateCharCount() {
    const len = textInput.value.length;
    charCount.textContent = `${len} char${len === 1 ? '' : 's'}`;
  }

  function clearCanvas() {
    currentImageDataUri = null;
    mopaOutputImage.src = '';
    mopaOutputImage.style.display = 'none';
    stageEmpty.style.display = 'block';
    metaResolution.textContent = '—';
    metaSize.textContent = '—';
    metaSpeed.textContent = '—';
    outputFileName.value = '';
    outputFileName.placeholder = 'output.png';
    downloadBtnLink.href = '#';
    downloadBtnLink.setAttribute('download', 'output.png');
    appStatus.querySelector('.status-text').textContent = 'Ready';
    appStatus.querySelector('.status-pip').style.backgroundColor = 'var(--accent-green)';
  }

  function debounceRender(ms = 50) {
    clearTimeout(renderDebounceTimer);
    renderDebounceTimer = setTimeout(() => {
      renderEngraving();
    }, ms);
  }

  // --- IndexedDB Helper for Custom Font Persistence ---
  const FontDB = {
    dbName: 'MopaLaserFonts',
    storeName: 'custom_fonts',
    async getDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(FontDB.dbName, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(FontDB.storeName)) {
            req.result.createObjectStore(FontDB.storeName, { keyPath: 'name' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async saveFont(name, buffer, filename, sizeKb) {
      try {
        const db = await FontDB.getDB();
        const tx = db.transaction(FontDB.storeName, 'readwrite');
        tx.objectStore(FontDB.storeName).put({ name, buffer, filename, sizeKb });
      } catch (e) {
        console.warn('Could not save font to IndexedDB:', e);
      }
    },
    async getAllFonts() {
      try {
        const db = await FontDB.getDB();
        return new Promise((resolve) => {
          const tx = db.transaction(FontDB.storeName, 'readonly');
          const req = tx.objectStore(FontDB.storeName).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        });
      } catch (e) {
        return [];
      }
    }
  };

  // --- Font Management & Catalog ---
  async function loadFontCatalog(selectFontId = 'WorkSans-VariableFont_wght.ttf') {
    const defaultFonts = [
      { id: 'WorkSans-VariableFont_wght.ttf', name: 'Work Sans', fontFamily: 'Work Sans', filename: 'WorkSans-VariableFont_wght.ttf', category: 'bundled', size_kb: 109.0, url: 'fonts/bundled/WorkSans-VariableFont_wght.ttf' }
    ];

    let fontCatalog = [...defaultFonts];

    // Fetch fonts.json if available
    try {
      const resp = await fetch('fonts/fonts.json');
      if (resp.ok) {
        const serverFonts = await resp.json();
        if (Array.isArray(serverFonts) && serverFonts.length > 0) {
          fontCatalog = serverFonts;
        }
      }
    } catch (e) {}

    // Restore any previously uploaded fonts from browser IndexedDB
    try {
      const storedFonts = await FontDB.getAllFonts();
      for (const sf of storedFonts) {
        try {
          const fontFace = new FontFace(sf.name, sf.buffer);
          const loaded = await fontFace.load();
          document.fonts.add(loaded);
          loadedCustomFonts.add(sf.name);
          fontCatalog.push({
            id: sf.filename || sf.name,
            name: sf.name,
            fontFamily: sf.name,
            filename: sf.filename || sf.name,
            category: 'uploaded',
            size_kb: sf.sizeKb || 120.0
          });
        } catch (err) {
          console.warn('Failed restoring font:', sf.name, err);
        }
      }
    } catch (e) {}

    // Render Font Select Options
    fontSelect.innerHTML = '';

    const bundledGroup = document.createElement('optgroup');
    bundledGroup.label = 'Standard Laser Fonts';

    const uploadedGroup = document.createElement('optgroup');
    uploadedGroup.label = 'Uploaded Custom Fonts';

    fontCatalog.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = `${f.name} (${f.size_kb} KB)`;
      opt.dataset.url = f.url || '';
      opt.dataset.name = f.name;
      opt.dataset.fontFamily = f.fontFamily || f.name;
      opt.dataset.size = `${f.size_kb} KB`;
      opt.dataset.category = f.category;

      if (f.category === 'uploaded') {
        uploadedGroup.appendChild(opt);
      } else {
        bundledGroup.appendChild(opt);
      }
    });

    if (bundledGroup.children.length > 0) fontSelect.appendChild(bundledGroup);
    if (uploadedGroup.children.length > 0) fontSelect.appendChild(uploadedGroup);

    if (selectFontId) {
      fontSelect.value = selectFontId;
    }
    if (!fontSelect.value && fontSelect.options.length > 0) {
      fontSelect.selectedIndex = 0;
    }

    const activeOpt = fontSelect.options[fontSelect.selectedIndex];
    if (activeOpt) {
      updateActiveFontDisplay(activeOpt);
    }

    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {}
    }

    if (textInput.value.trim()) {
      renderEngraving();
    } else {
      clearCanvas();
    }
  }

  // --- Custom Font Upload (100% Client-Side + Server Sync) ---
  async function uploadFontFile(file) {
    const validExts = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
      showToast('Please select a .TTF or .OTF font file', 'error');
      return;
    }

    if (uploadProgress) {
      uploadProgress.classList.add('active');
      progressBar.style.width = '30%';
      progressText.textContent = `Reading ${file.name}...`;
    }

    try {
      const buffer = await file.arrayBuffer();
      if (progressBar) progressBar.style.width = '60%';

      const cleanFontName = file.name.replace(/\.[^/.]+$/, '').trim() || 'CustomFont';
      const fontFace = new FontFace(cleanFontName, buffer);
      const loaded = await fontFace.load();
      document.fonts.add(loaded);
      loadedCustomFonts.add(cleanFontName);

      if (progressBar) progressBar.style.width = '85%';
      const sizeKb = Math.round((file.size / 1024) * 10) / 10;
      await FontDB.saveFont(cleanFontName, buffer, file.name, sizeKb);

      // Background sync with local Flask server if running
      const formData = new FormData();
      formData.append('file', file);
      fetch('/api/upload-font', { method: 'POST', body: formData }).catch(() => {});

      if (progressBar) progressBar.style.width = '100%';
      showToast(`Loaded font: ${cleanFontName}`, 'success');

      await loadFontCatalog(file.name);
    } catch (err) {
      console.error('Font loading failed:', err);
      showToast('Failed to parse font file', 'error');
    } finally {
      if (uploadProgress) {
        setTimeout(() => {
          uploadProgress.classList.remove('active');
          if (progressBar) progressBar.style.width = '0%';
          if (fontFileInput) fontFileInput.value = '';
        }, 700);
      }
    }
  }

  async function loadFontFace(name, url) {
    if (loadedCustomFonts.has(name) || !url) return;
    try {
      const font = new FontFace(name, `url("${url}")`);
      const loaded = await font.load();
      document.fonts.add(loaded);
      loadedCustomFonts.add(name);
      liveFontPreview.style.fontFamily = `"${name}", -apple-system, sans-serif`;
    } catch (e) {
      console.warn('FontFace preview load notice:', e);
    }
  }

  function updateActiveFontDisplay(option) {
    const name = option.dataset.name || option.textContent;
    const size = option.dataset.size || '';
    const url = option.dataset.url;
    const fontFamily = resolveFontFamily(option);

    activeFontBadge.textContent = name;
    fontFamilyLabel.textContent = name;
    fontSizeKbLabel.textContent = size;
    liveFontPreview.style.fontFamily = `"${fontFamily}", "Work Sans", sans-serif`;

    if (url) {
      loadFontFace(name, url);
    }
  }

  // --- High-Performance Laser Rendering Engine Client ---
  async function renderEngraving() {
    const textVal = textInput.value.trim();
    if (!textVal) {
      clearCanvas();
      return;
    }

    if (isRendering) {
      queuedRender = true;
      return;
    }
    isRendering = true;

    stageLoading.classList.remove('hidden');
    appStatus.querySelector('.status-text').textContent = 'Pulsing Laser...';
    appStatus.querySelector('.status-pip').style.backgroundColor = 'var(--accent-apple)';

    const settings = getActiveSimulationSettings();
    const payload = {
      text: textVal,
      ...settings
    };

    try {
      // 1. Client-Side MOPA Engine (GitHub Pages Native)
      if (typeof MopaEngine !== 'undefined') {
        const res = await MopaEngine.generate(payload);
        if (res.success && res.imageData) {
          applyRenderResult(res, textVal);
          return;
        }
      }

      // 2. Fallback: Local Flask API
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();

      if (data.success && data.image_data) {
        applyRenderResult({
          imageData: data.image_data,
          width: data.width,
          height: data.height,
          fileSizeKb: data.file_size_kb,
          renderTimeMs: data.render_time_ms
        }, textVal);
      } else {
        throw new Error(data.error || 'Rendering failed');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Connection error to laser engine', 'error');
      appStatus.querySelector('.status-text').textContent = 'Render Failed';
      appStatus.querySelector('.status-pip').style.backgroundColor = '#ff3b30';
    } finally {
      stageLoading.classList.add('hidden');
      isRendering = false;
      if (queuedRender) {
        queuedRender = false;
        renderEngraving();
      }
    }
  }

  function applyRenderResult(res, textVal) {
    currentImageDataUri = res.imageData;
    mopaOutputImage.src = res.imageData;
    mopaOutputImage.style.display = 'block';
    stageEmpty.style.display = 'none';

    // Update metadata
    metaResolution.textContent = `${res.width} × ${res.height} px`;
    metaSize.textContent = `${res.fileSizeKb} KB`;
    metaSpeed.textContent = `${res.renderTimeMs} ms`;

    // Update download link
    const finalFilename = formatFilename(textVal) || 'output.png';
    outputFileName.value = finalFilename;
    downloadBtnLink.href = res.imageData;
    downloadBtnLink.setAttribute('download', finalFilename);

    appStatus.querySelector('.status-text').textContent = 'Engine Ready';
    appStatus.querySelector('.status-pip').style.backgroundColor = 'var(--accent-green)';
  }

  // --- Zoom Controls ---
  function adjustZoom(delta) {
    setZoom(Math.round((currentZoom + delta) * 100) / 100);
  }

  function setZoom(val) {
    currentZoom = Math.max(0.2, Math.min(val, 6.0));
    if (imageWrapper) {
      imageWrapper.style.transform = `scale(${currentZoom})`;
    }
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
    }
  }

  function fitImageToView() {
    if (!mopaOutputImage || !mopaOutputImage.naturalWidth || mopaOutputImage.style.display === 'none') {
      setZoom(1.0);
      return;
    }
    const container = interactiveStage || stageContainer;
    if (!container) {
      setZoom(1.0);
      return;
    }
    const availW = container.clientWidth - 48;
    const availH = container.clientHeight - 48;
    const imgW = mopaOutputImage.naturalWidth;
    const imgH = mopaOutputImage.naturalHeight;
    if (availW > 50 && availH > 50 && imgW > 0 && imgH > 0) {
      const scale = Math.min(1.0, availW / imgW, availH / imgH);
      setZoom(Math.max(0.25, Math.round(scale * 100) / 100));
    } else {
      setZoom(1.0);
    }
  }

  // --- Copy to Clipboard ---
  async function copyImageToClipboard() {
    if (!currentImageDataUri) {
      showToast('No rendered image to copy', 'error');
      return;
    }

    try {
      const res = await fetch(currentImageDataUri);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast('Copied transparent PNG to clipboard', 'success');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      showToast('Clipboard copy failed. Use "Download Transparent PNG" instead', 'error');
    }
  }

  // --- Batch Generation & Direct Multi-Image Download (Client-Side) ---
  async function runBatchGeneration() {
    const rawText = batchTextarea.value.trim();
    if (!rawText) {
      showToast('Please enter at least one serial number', 'error');
      return;
    }

    const items = rawText.split('\n').map(s => s.trim()).filter(Boolean);
    if (items.length === 0) {
      showToast('Please enter at least one serial number', 'error');
      return;
    }

    batchProgressArea.classList.remove('hidden');
    batchStatusText.textContent = `Rendering (0/${items.length})...`;
    if (batchProgressBar) batchProgressBar.style.width = '0%';
    runBatchBtn.disabled = true;

    const settings = getActiveSimulationSettings();
    const generatedImages = [];
    const usedNames = new Set();

    try {
      if (typeof MopaEngine !== 'undefined') {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          batchStatusText.textContent = `Rendering (${i + 1}/${items.length}): ${item.slice(0, 15)}...`;
          if (batchProgressBar) {
            batchProgressBar.style.width = `${Math.round(((i + 1) / items.length) * 100)}%`;
          }

          const res = await MopaEngine.generate({
            text: item,
            ...settings
          });

          if (res.success && res.imageData) {
            let fname = res.filename;
            if (usedNames.has(fname)) {
              fname = fname.replace('.png', `_${i + 1}.png`);
            }
            usedNames.add(fname);

            generatedImages.push({
              imageData: res.imageData,
              filename: fname
            });
          }
        }
      } else {
        const resp = await fetch('/api/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: items,
            ...settings
          })
        });
        const res = await resp.json();
        if (res.success && res.images) {
          generatedImages.push(...res.images.map(img => ({
            imageData: img.image_data,
            filename: img.filename
          })));
        }
      }

      if (generatedImages.length > 0) {
        showToast(`Generated ${generatedImages.length} images. Downloading all...`, 'success');

        for (let i = 0; i < generatedImages.length; i++) {
          const item = generatedImages[i];
          const a = document.createElement('a');
          a.href = item.imageData;
          a.download = item.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          if (i < generatedImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        showToast(`Successfully downloaded all ${generatedImages.length} images!`, 'success');
        batchModal.classList.add('hidden');
      } else {
        showToast('Batch generation produced no output', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error during batch generation', 'error');
    } finally {
      batchProgressArea.classList.add('hidden');
      runBatchBtn.disabled = false;
    }
  }

  // --- Toast Notification Helper ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    const dotColor = type === 'success' ? '#34c759' : '#ff3b30';
    toast.innerHTML = `
      <span class="toast-bullet" style="background-color: ${dotColor}"></span>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }
});
