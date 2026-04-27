(() => {
  'use strict';

  const NAIL_RATIO = 9 / 16;
  const MIN_FRAME_WIDTH = 80;
  const $ = (id) => document.getElementById(id);

  const state = {
    originalImage: null,
    croppedCanvas: null,
    cropEventsReady: false,
    drawRequested: false,
    crop: {
      frameX: 0,
      frameY: 0,
      frameWidth: 0,
      frameHeight: 0,
      wrapperWidth: 0,
      wrapperHeight: 0,
      activeAction: null,
      activeHandle: null,
      dragStartX: 0,
      dragStartY: 0,
      frameStartX: 0,
      frameStartY: 0,
      oppositeX: 0,
      oppositeY: 0
    },
    guide: {
      offsetX: 0,
      offsetY: 0,
      moving: false,
      dragging: false,
      lastX: 0,
      lastY: 0,
      circleCount: 3
    }
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    $('uploadBtn').addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', handleFileSelection);
    $('cancelCrop').addEventListener('click', showWelcome);
    $('confirmCrop').addEventListener('click', confirmCrop);
    $('backToWelcome').addEventListener('click', () => {
      if (window.confirm('\u00bfReiniciar y seleccionar otra imagen?')) window.location.reload();
    });

    $('toggleSettings').addEventListener('click', () => setSettingsOpen(!$('settingsPanel').classList.contains('open')));
    $('closeSettings').addEventListener('click', () => setSettingsOpen(false));
    $('lineColor').addEventListener('input', requestGuideDraw);
    $('moveGuideBtn').addEventListener('click', toggleMoveMode);
    $('resetGuidesBtn').addEventListener('click', resetGuides);
    $('downloadBtn').addEventListener('click', downloadComposite);

    bindRange('circleSlider', 'circleCount', (value) => {
      state.guide.circleCount = Number(value);
      requestGuideDraw();
      return value;
    });
    bindRange('lineWidth', 'lineWidthValue', (value) => {
      requestGuideDraw();
      return value;
    });
    bindRange('opacity', 'opacityValue', (value) => {
      requestGuideDraw();
      return `${value}%`;
    });

    bindGuidePointerEvents();
    window.addEventListener('resize', debounce(handleResize, 120));
    registerServiceWorker();
  }

  function bindRange(inputId, outputId, onValue) {
    const input = $(inputId);
    const output = $(outputId);
    input.addEventListener('input', () => {
      const displayValue = onValue(input.value);
      output.value = displayValue;
      output.textContent = displayValue;
    });
  }

  function handleFileSelection(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.alert('Selecciona un archivo de imagen v\u00e1lido.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => loadImage(String(reader.result));
    reader.onerror = () => window.alert('No se pudo leer la imagen. Intenta con otro archivo.');
    reader.readAsDataURL(file);
  }

  function loadImage(src) {
    const image = new Image();
    image.onload = () => {
      state.originalImage = image;
      $('cropImage').src = src;
      showCropMode();
      requestAnimationFrame(initializeCropMode);
    };
    image.onerror = () => window.alert('No se pudo cargar la imagen. Intenta con otro archivo.');
    image.src = src;
  }

  function showWelcome() {
    $('cropMode').hidden = true;
    $('workMode').hidden = true;
    $('welcomeScreen').hidden = false;
    $('fileInput').value = '';
  }

  function showCropMode() {
    $('welcomeScreen').hidden = true;
    $('workMode').hidden = true;
    $('cropMode').hidden = false;
  }

  function showWorkMode() {
    $('cropMode').hidden = true;
    $('welcomeScreen').hidden = true;
    $('workMode').hidden = false;
  }

  function initializeCropMode() {
    if (!state.originalImage) return;

    const wrapper = $('cropWrapper');
    const workspace = document.querySelector('.crop-workspace');
    const crop = state.crop;
    const workspaceWidth = workspace.clientWidth;
    const workspaceHeight = workspace.clientHeight;
    const imageRatio = state.originalImage.width / state.originalImage.height;

    if (workspaceWidth / workspaceHeight > imageRatio) {
      crop.wrapperHeight = workspaceHeight * 0.9;
      crop.wrapperWidth = crop.wrapperHeight * imageRatio;
    } else {
      crop.wrapperWidth = workspaceWidth * 0.9;
      crop.wrapperHeight = crop.wrapperWidth / imageRatio;
    }

    wrapper.style.width = `${crop.wrapperWidth}px`;
    wrapper.style.height = `${crop.wrapperHeight}px`;
    wrapper.style.transform = `translate(${(workspaceWidth - crop.wrapperWidth) / 2}px, ${(workspaceHeight - crop.wrapperHeight) / 2}px)`;

    crop.frameWidth = Math.min(crop.wrapperWidth * 0.72, crop.wrapperHeight * 0.82 * NAIL_RATIO);
    crop.frameHeight = crop.frameWidth / NAIL_RATIO;
    crop.frameX = (crop.wrapperWidth - crop.frameWidth) / 2;
    crop.frameY = (crop.wrapperHeight - crop.frameHeight) / 2;

    renderCropFrame();
    bindCropPointerEvents();
  }

  function bindCropPointerEvents() {
    if (state.cropEventsReady) return;
    state.cropEventsReady = true;

    const frame = $('cropFrame');
    frame.addEventListener('pointerdown', startFrameMove);
    frame.querySelectorAll('.handle').forEach((handle) => {
      handle.addEventListener('pointerdown', startHandleResize);
    });

    window.addEventListener('pointermove', updateCropInteraction, { passive: false });
    window.addEventListener('pointerup', endCropInteraction);
    window.addEventListener('pointercancel', endCropInteraction);
  }

  function startFrameMove(event) {
    if (event.target.classList.contains('handle')) return;
    event.preventDefault();

    const crop = state.crop;
    crop.activeAction = 'move-frame';
    crop.dragStartX = event.clientX;
    crop.dragStartY = event.clientY;
    crop.frameStartX = crop.frameX;
    crop.frameStartY = crop.frameY;
    $('cropFrame').setPointerCapture?.(event.pointerId);
  }

  function startHandleResize(event) {
    event.preventDefault();
    event.stopPropagation();

    const crop = state.crop;
    const right = crop.frameX + crop.frameWidth;
    const bottom = crop.frameY + crop.frameHeight;
    crop.activeAction = 'resize-frame';
    crop.activeHandle = event.currentTarget.dataset.handle;
    crop.oppositeX = crop.activeHandle.includes('l') ? right : crop.frameX;
    crop.oppositeY = crop.activeHandle.includes('t') ? bottom : crop.frameY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function updateCropInteraction(event) {
    const crop = state.crop;
    if (!crop.activeAction) return;
    event.preventDefault();

    if (crop.activeAction === 'move-frame') {
      crop.frameX = clamp(crop.frameStartX + event.clientX - crop.dragStartX, 0, crop.wrapperWidth - crop.frameWidth);
      crop.frameY = clamp(crop.frameStartY + event.clientY - crop.dragStartY, 0, crop.wrapperHeight - crop.frameHeight);
    } else {
      resizeFrameFromPointer(event.clientX, event.clientY);
    }

    renderCropFrame();
  }

  function resizeFrameFromPointer(clientX, clientY) {
    const crop = state.crop;
    const rect = $('cropWrapper').getBoundingClientRect();
    const localX = clamp(clientX - rect.left, 0, crop.wrapperWidth);
    const localY = clamp(clientY - rect.top, 0, crop.wrapperHeight);
    const maxWidth = crop.activeHandle.includes('l') ? crop.oppositeX : crop.wrapperWidth - crop.oppositeX;
    const maxHeight = crop.activeHandle.includes('t') ? crop.oppositeY : crop.wrapperHeight - crop.oppositeY;
    const pointerWidth = Math.abs(localX - crop.oppositeX);
    const pointerHeight = Math.abs(localY - crop.oppositeY) * NAIL_RATIO;
    const width = clamp(Math.max(pointerWidth, pointerHeight), MIN_FRAME_WIDTH, Math.min(maxWidth, maxHeight * NAIL_RATIO));
    const height = width / NAIL_RATIO;

    crop.frameX = crop.activeHandle.includes('l') ? crop.oppositeX - width : crop.oppositeX;
    crop.frameY = crop.activeHandle.includes('t') ? crop.oppositeY - height : crop.oppositeY;
    crop.frameWidth = width;
    crop.frameHeight = height;
  }

  function endCropInteraction() {
    state.crop.activeAction = null;
    state.crop.activeHandle = null;
  }

  function renderCropFrame() {
    const frame = $('cropFrame');
    const crop = state.crop;
    frame.style.left = `${crop.frameX}px`;
    frame.style.top = `${crop.frameY}px`;
    frame.style.width = `${crop.frameWidth}px`;
    frame.style.height = `${crop.frameHeight}px`;
  }

  function confirmCrop() {
    if (!state.originalImage) return;

    const crop = state.crop;
    const scaleRatio = state.originalImage.width / crop.wrapperWidth;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(crop.frameWidth * scaleRatio);
    canvas.height = Math.round(crop.frameHeight * scaleRatio);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      state.originalImage,
      Math.round(crop.frameX * scaleRatio),
      Math.round(crop.frameY * scaleRatio),
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    state.croppedCanvas = canvas;
    setupWorkMode();
  }

  function setupWorkMode() {
    showWorkMode();
    setSettingsOpen(false);
    requestAnimationFrame(drawImageCanvas);
  }

  function drawImageCanvas() {
    const sourceCanvas = state.croppedCanvas;
    if (!sourceCanvas) return;

    const imageCanvas = $('imageCanvas');
    const guideCanvas = $('guideCanvas');
    const workspace = $('workWorkspace');
    const containerW = workspace.clientWidth;
    const containerH = workspace.clientHeight;
    let canvasW;
    let canvasH;

    if (containerW / containerH > NAIL_RATIO) {
      canvasH = containerH;
      canvasW = canvasH * NAIL_RATIO;
    } else {
      canvasW = containerW;
      canvasH = canvasW / NAIL_RATIO;
    }

    [imageCanvas, guideCanvas].forEach((canvas) => {
      canvas.width = Math.round(canvasW);
      canvas.height = Math.round(canvasH);
      canvas.style.width = `${canvasW}px`;
      canvas.style.height = `${canvasH}px`;
      canvas.style.left = `${(containerW - canvasW) / 2}px`;
      canvas.style.top = `${(containerH - canvasH) / 2}px`;
    });

    const ctx = imageCanvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, imageCanvas.width, imageCanvas.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, imageCanvas.width, imageCanvas.height);
    requestGuideDraw();
  }

  function bindGuidePointerEvents() {
    const canvas = $('guideCanvas');

    canvas.addEventListener('pointerdown', (event) => {
      if (!state.guide.moving) return;
      event.preventDefault();
      state.guide.dragging = true;
      state.guide.lastX = event.clientX;
      state.guide.lastY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!state.guide.moving || !state.guide.dragging) return;
      event.preventDefault();
      state.guide.offsetX += event.clientX - state.guide.lastX;
      state.guide.offsetY += event.clientY - state.guide.lastY;
      state.guide.lastX = event.clientX;
      state.guide.lastY = event.clientY;
      requestGuideDraw();
    });

    window.addEventListener('pointerup', () => {
      state.guide.dragging = false;
    });
  }

  function toggleMoveMode() {
    const button = $('moveGuideBtn');
    state.guide.moving = !state.guide.moving;
    button.classList.toggle('active', state.guide.moving);
    button.setAttribute('aria-pressed', String(state.guide.moving));
    button.textContent = state.guide.moving ? 'Fijar gu\u00edas' : 'Mover gu\u00edas';
  }

  function resetGuides() {
    state.guide.offsetX = 0;
    state.guide.offsetY = 0;
    requestGuideDraw();
  }

  function requestGuideDraw() {
    if (state.drawRequested) return;
    state.drawRequested = true;
    requestAnimationFrame(() => {
      drawGuides();
      state.drawRequested = false;
    });
  }

  function drawGuides() {
    const canvas = $('guideCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    const color = $('lineColor').value;
    const opacity = Number($('opacity').value) / 100;
    const lineWidth = Number($('lineWidth').value);
    const centerX = w / 2 + state.guide.offsetX;
    const centerY = h / 2 + state.guide.offsetY;
    const spacing = (h * 0.8) / (state.guide.circleCount + 1);
    const radius = spacing * 0.45;
    const startY = centerY - ((state.guide.circleCount - 1) * spacing) / 2;
    const centers = [];

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([6, 6]);

    [centerX, centerX - radius, centerX + radius].forEach((x) => drawLine(ctx, x, 0, x, h));

    for (let i = 0; i < state.guide.circleCount; i += 1) {
      const y = startY + i * spacing;
      centers.push({ x: centerX, y });
      ctx.beginPath();
      ctx.arc(centerX, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1, lineWidth * 0.8);
    ctx.globalAlpha = opacity * 0.9;
    centers.forEach((center) => drawLine(ctx, centerX - radius, center.y, centerX + radius, center.y));

    for (let i = 0; i < centers.length - 1; i += 1) {
      const current = centers[i];
      const next = centers[i + 1];
      drawPolyline(ctx, [[centerX - radius, current.y], [centerX, next.y], [centerX + radius, current.y]]);
      drawPolyline(ctx, [[centerX - radius, next.y], [centerX, current.y], [centerX + radius, next.y]]);
    }

    ctx.restore();
  }

  function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawPolyline(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.stroke();
  }

  function downloadComposite() {
    const imageCanvas = $('imageCanvas');
    const guideCanvas = $('guideCanvas');
    if (!imageCanvas.width || !guideCanvas.width) return;

    const canvas = document.createElement('canvas');
    canvas.width = imageCanvas.width;
    canvas.height = imageCanvas.height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageCanvas, 0, 0);
    ctx.drawImage(guideCanvas, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) {
        window.alert('No se pudo preparar la descarga.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `guia-ballerina-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  function setSettingsOpen(isOpen) {
    const panel = $('settingsPanel');
    panel.classList.toggle('open', isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
    $('toggleSettings').setAttribute('aria-expanded', String(isOpen));
  }

  function handleResize() {
    if (!$('cropMode').hidden) initializeCropMode();
    if (!$('workMode').hidden) drawImageCanvas();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', () => {
      const swUrl = new URL('sw.js', window.location.href);
      navigator.serviceWorker.register(swUrl, { scope: './' }).catch((error) => {
        console.warn('No se pudo registrar el service worker:', error);
      });
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function debounce(callback, delay) {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  }
})();
