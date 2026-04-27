(() => {
  'use strict';

  const NAIL_RATIO = 9 / 16;
  const MIN_FRAME_WIDTH = 80;
  const GUIDE_SCALE_MIN = 0.25;
  const GUIDE_SCALE_MAX = 2.5;
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
      rotation: 0,
      scale: 1,
      circleCount: 3,
      pointers: new Map(),
      pinchStartDistance: 0,
      pinchStartAngle: 0,
      pinchStartScale: 1,
      pinchStartRotation: 0,
      pinchStartCenterX: 0,
      pinchStartCenterY: 0,
      pinchStartOffsetX: 0,
      pinchStartOffsetY: 0
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
    document.querySelectorAll('input[name="guideMode"]').forEach((input) => {
      input.addEventListener('change', requestGuideDraw);
    });
    $('fitGuidesBtn').addEventListener('click', fitGuidesToFrame);
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
    bindRange('guideRotation', 'guideRotationValue', (value) => {
      state.guide.rotation = Number(value);
      requestGuideDraw();
      return `${value}\u00b0`;
    });
    bindRange('guideScale', 'guideScaleValue', (value) => {
      state.guide.scale = Number(value) / 100;
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
    fitGuidesToFrame();
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
    const workspace = $('workWorkspace');

    workspace.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      state.guide.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      state.guide.dragging = true;
      state.guide.lastX = event.clientX;
      state.guide.lastY = event.clientY;
      workspace.setPointerCapture?.(event.pointerId);
      if (state.guide.pointers.size === 2) startPinchGesture();
    });

    workspace.addEventListener('pointermove', (event) => {
      if (!state.guide.dragging || !state.guide.pointers.has(event.pointerId)) return;
      event.preventDefault();
      state.guide.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (state.guide.pointers.size >= 2) {
        updatePinchGesture();
      } else {
        state.guide.offsetX += event.clientX - state.guide.lastX;
        state.guide.offsetY += event.clientY - state.guide.lastY;
        state.guide.lastX = event.clientX;
        state.guide.lastY = event.clientY;
      }

      requestGuideDraw();
    });

    window.addEventListener('pointerup', endGuidePointer);
    window.addEventListener('pointercancel', endGuidePointer);
  }

  function startPinchGesture() {
    const [first, second] = [...state.guide.pointers.values()];
    const center = getGestureCenter(first, second);
    state.guide.pinchStartDistance = getGestureDistance(first, second);
    state.guide.pinchStartAngle = getGestureAngle(first, second);
    state.guide.pinchStartScale = state.guide.scale;
    state.guide.pinchStartRotation = state.guide.rotation;
    state.guide.pinchStartCenterX = center.x;
    state.guide.pinchStartCenterY = center.y;
    state.guide.pinchStartOffsetX = state.guide.offsetX;
    state.guide.pinchStartOffsetY = state.guide.offsetY;
  }

  function updatePinchGesture() {
    const [first, second] = [...state.guide.pointers.values()];
    const distance = getGestureDistance(first, second);
    const angle = getGestureAngle(first, second);
    const center = getGestureCenter(first, second);
    const nextScale = state.guide.pinchStartScale * (distance / state.guide.pinchStartDistance);

    state.guide.scale = clamp(nextScale, GUIDE_SCALE_MIN, GUIDE_SCALE_MAX);
    state.guide.rotation = clamp(
      state.guide.pinchStartRotation + angle - state.guide.pinchStartAngle,
      Number($('guideRotation').min),
      Number($('guideRotation').max)
    );
    state.guide.offsetX = state.guide.pinchStartOffsetX + center.x - state.guide.pinchStartCenterX;
    state.guide.offsetY = state.guide.pinchStartOffsetY + center.y - state.guide.pinchStartCenterY;
    syncGuideTransformControls();
  }

  function endGuidePointer(event) {
    state.guide.pointers.delete(event.pointerId);

    if (state.guide.pointers.size === 0) {
      state.guide.dragging = false;
      return;
    }

    const remaining = [...state.guide.pointers.values()][0];
    state.guide.lastX = remaining.x;
    state.guide.lastY = remaining.y;
    if (state.guide.pointers.size === 2) startPinchGesture();
  }

  function toggleMoveMode() {
    const button = $('moveGuideBtn');
    state.guide.moving = !state.guide.moving;
    button.classList.toggle('active', state.guide.moving);
    button.setAttribute('aria-pressed', String(state.guide.moving));
    button.textContent = state.guide.moving ? 'Fijar gu\u00edas' : 'Mover gu\u00edas';
    $('workWorkspace').classList.toggle('moving-guides', state.guide.moving);
    if (state.guide.moving) setSettingsOpen(false);
  }

  function resetGuides() {
    fitGuidesToFrame();
  }

  function fitGuidesToFrame() {
    state.guide.offsetX = 0;
    state.guide.offsetY = 0;
    state.guide.scale = 1;
    state.guide.rotation = 0;
    syncGuideTransformControls();
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
    if (getGuideMode() === 'structure') {
      drawStructureGuides(ctx, w, h);
      return;
    }
    drawBallerinaGuides(ctx, w, h);
  }

  function drawBallerinaGuides(ctx, w, h) {
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

  function drawStructureGuides(ctx, w, h) {
    const opacity = Number($('opacity').value) / 100;
    const lineWidth = Number($('lineWidth').value);
    const centerX = w / 2 + state.guide.offsetX;
    const centerY = h / 2 + state.guide.offsetY;
    const baseHeight = Math.min(h, w / NAIL_RATIO);
    const guideHeight = baseHeight * state.guide.scale;
    const guideWidth = guideHeight * NAIL_RATIO;
    const insetX = guideWidth * 0.045;
    const insetY = guideHeight * 0.04;
    const topY = -guideHeight / 2 + insetY;
    const bottomY = guideHeight / 2 - insetY;
    const leftX = -guideWidth / 2 + insetX;
    const rightX = guideWidth / 2 - insetX;
    const innerHeight = bottomY - topY;
    const innerWidth = rightX - leftX;
    const frame = {
      topLeft: [leftX, topY],
      topRight: [rightX, topY],
      bottomRight: [rightX, bottomY],
      bottomLeft: [leftX, bottomY]
    };
    const centers = [
      { x: 0, y: topY + innerHeight * 0.18, r: innerWidth * 0.19 },
      { x: 0, y: topY + innerHeight * 0.51, r: innerWidth * 0.22 },
      { x: 0, y: topY + innerHeight * 0.82, r: innerWidth * 0.19 }
    ];
    const sideLeftTop = [leftX, topY + innerHeight * 0.25];
    const sideRightTop = [rightX, topY + innerHeight * 0.25];
    const sideLeftMid = [leftX, topY + innerHeight * 0.50];
    const sideRightMid = [rightX, topY + innerHeight * 0.50];
    const sideLeftBottom = [leftX, topY + innerHeight * 0.76];
    const sideRightBottom = [rightX, topY + innerHeight * 0.76];

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((state.guide.rotation * Math.PI) / 180);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;

    ctx.strokeStyle = '#ff1495';
    ctx.lineWidth = Math.max(1.4, lineWidth * 1.05);
    ctx.setLineDash([]);
    drawPolyline(ctx, [frame.topLeft, frame.topRight, frame.bottomRight, frame.bottomLeft, frame.topLeft]);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(frame.topLeft[0], frame.topLeft[1]);
    ctx.lineTo(frame.topRight[0], frame.topRight[1]);
    ctx.lineTo(frame.bottomRight[0], frame.bottomRight[1]);
    ctx.lineTo(frame.bottomLeft[0], frame.bottomLeft[1]);
    ctx.closePath();
    ctx.clip();

    ctx.strokeStyle = '#0b68ff';
    ctx.fillStyle = '#0b68ff';
    ctx.lineWidth = Math.max(1.1, lineWidth * 0.85);

    drawLine(ctx, 0, topY, 0, bottomY);
    drawLine(ctx, leftX, centers[1].y, rightX, centers[1].y);

    centers.forEach((center) => {
      drawCircle(ctx, center.x, center.y, center.r);
      drawCircle(ctx, center.x, center.y, center.r * 0.52);
      drawLine(ctx, center.x - center.r, center.y, center.x + center.r, center.y);
      drawLine(ctx, center.x, center.y - center.r, center.x, center.y + center.r);
    });

    drawLine(ctx, frame.topLeft[0], frame.topLeft[1], centers[0].x, centers[0].y);
    drawLine(ctx, frame.topRight[0], frame.topRight[1], centers[0].x, centers[0].y);
    drawLine(ctx, frame.topLeft[0], frame.topLeft[1], centers[1].x, centers[1].y);
    drawLine(ctx, frame.topRight[0], frame.topRight[1], centers[1].x, centers[1].y);

    drawLine(ctx, frame.bottomLeft[0], frame.bottomLeft[1], centers[2].x, centers[2].y);
    drawLine(ctx, frame.bottomRight[0], frame.bottomRight[1], centers[2].x, centers[2].y);
    drawLine(ctx, frame.bottomLeft[0], frame.bottomLeft[1], centers[1].x, centers[1].y);
    drawLine(ctx, frame.bottomRight[0], frame.bottomRight[1], centers[1].x, centers[1].y);

    drawLine(ctx, sideLeftTop[0], sideLeftTop[1], centers[1].x, centers[1].y);
    drawLine(ctx, sideRightTop[0], sideRightTop[1], centers[1].x, centers[1].y);
    drawLine(ctx, sideLeftMid[0], sideLeftMid[1], centers[0].x, centers[0].y);
    drawLine(ctx, sideRightMid[0], sideRightMid[1], centers[0].x, centers[0].y);
    drawLine(ctx, sideLeftMid[0], sideLeftMid[1], centers[2].x, centers[2].y);
    drawLine(ctx, sideRightMid[0], sideRightMid[1], centers[2].x, centers[2].y);
    drawLine(ctx, sideLeftBottom[0], sideLeftBottom[1], centers[1].x, centers[1].y);
    drawLine(ctx, sideRightBottom[0], sideRightBottom[1], centers[1].x, centers[1].y);

    drawLine(ctx, frame.topLeft[0], frame.topLeft[1], frame.bottomRight[0], frame.bottomRight[1]);
    drawLine(ctx, frame.topRight[0], frame.topRight[1], frame.bottomLeft[0], frame.bottomLeft[1]);
    drawPathThrough(ctx, centers.map((center) => [center.x, center.y]));

    drawSmoothPath(ctx, [
      frame.topLeft,
      [leftX + innerWidth * 0.24, topY + innerHeight * 0.24],
      [leftX + innerWidth * 0.06, topY + innerHeight * 0.52],
      [leftX + innerWidth * 0.26, topY + innerHeight * 0.78],
      frame.bottomLeft
    ]);
    drawSmoothPath(ctx, [
      frame.topRight,
      [rightX - innerWidth * 0.24, topY + innerHeight * 0.24],
      [rightX - innerWidth * 0.06, topY + innerHeight * 0.52],
      [rightX - innerWidth * 0.26, topY + innerHeight * 0.78],
      frame.bottomRight
    ]);

    drawArc(ctx, centers[0].x, centers[0].y, centers[0].r * 1.56, Math.PI * 0.95, Math.PI * 2.08);
    drawArc(ctx, centers[1].x, centers[1].y, centers[1].r * 1.72, Math.PI * 1.06, Math.PI * 1.95);
    drawArc(ctx, centers[2].x, centers[2].y, centers[2].r * 1.55, Math.PI * 0.95, Math.PI * 2.05);

    drawRadialFan(ctx, centers[0], [
      frame.topLeft,
      [leftX + innerWidth * 0.24, topY],
      [rightX - innerWidth * 0.24, topY],
      frame.topRight,
      sideLeftTop,
      sideRightTop
    ]);
    drawRadialFan(ctx, centers[1], [
      sideLeftTop,
      sideRightTop,
      sideLeftMid,
      sideRightMid,
      sideLeftBottom,
      sideRightBottom,
      [leftX + innerWidth * 0.22, bottomY],
      [rightX - innerWidth * 0.22, bottomY]
    ]);
    drawRadialFan(ctx, centers[2], [
      frame.bottomLeft,
      [leftX + innerWidth * 0.28, bottomY],
      [rightX - innerWidth * 0.28, bottomY],
      frame.bottomRight,
      sideLeftBottom,
      sideRightBottom
    ]);

    ctx.globalAlpha = Math.min(1, opacity + 0.16);
    centers.forEach((center) => drawDot(ctx, center.x, center.y, lineWidth * 1.45));
    [frame.topLeft, frame.topRight, frame.bottomRight, frame.bottomLeft].forEach((anchor) => {
      drawDot(ctx, anchor[0], anchor[1], lineWidth * 0.8);
    });

    ctx.restore();
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

  function drawCircle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawArc(ctx, x, y, radius, startAngle, endAngle) {
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();
  }

  function drawRadialFan(ctx, center, points) {
    points.forEach(([x, y]) => drawLine(ctx, center.x, center.y, x, y));
  }

  function drawPathThrough(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.stroke();
  }

  function drawSmoothPath(ctx, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length - 1; i += 1) {
      const [x, y] = points[i];
      const [nextX, nextY] = points[i + 1];
      ctx.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
    }

    const last = points[points.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }

  function drawDot(ctx, x, y, lineWidth) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2.2, lineWidth * 1.7), 0, Math.PI * 2);
    ctx.fill();
  }

  function getGuideMode() {
    return document.querySelector('input[name="guideMode"]:checked')?.value || 'ballerina';
  }

  function syncGuideTransformControls() {
    const scaleInput = $('guideScale');
    const scaleOutput = $('guideScaleValue');
    const rotationInput = $('guideRotation');
    const rotationOutput = $('guideRotationValue');
    const scalePercent = Math.round(state.guide.scale * 100);
    const rotationDegrees = Math.round(state.guide.rotation);

    scaleInput.value = String(clamp(scalePercent, Number(scaleInput.min), Number(scaleInput.max)));
    scaleOutput.value = `${scaleInput.value}%`;
    scaleOutput.textContent = scaleOutput.value;
    rotationInput.value = String(clamp(rotationDegrees, Number(rotationInput.min), Number(rotationInput.max)));
    rotationOutput.value = `${rotationInput.value}\u00b0`;
    rotationOutput.textContent = rotationOutput.value;
  }

  function getGestureDistance(first, second) {
    return Math.hypot(second.x - first.x, second.y - first.y) || 1;
  }

  function getGestureAngle(first, second) {
    return (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI;
  }

  function getGestureCenter(first, second) {
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2
    };
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
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
