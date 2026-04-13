console.log('🎨 Painting With Roma - Crop + Guías');

// ===== ELEMENTOS =====
const cropMode = document.getElementById('cropMode');
const workMode = document.getElementById('workMode');
const cropImage = document.getElementById('cropImage');
const cropWrapper = document.getElementById('cropWrapper');
const cropFrame = document.getElementById('cropFrame');
const imageCanvas = document.getElementById('imageCanvas');
const guideCanvas = document.getElementById('guideCanvas');
const workWorkspace = document.getElementById('workWorkspace');
const settingsPanel = document.getElementById('settingsPanel');
const fileInput = document.getElementById('fileInput');

// ===== VARIABLES =====
let originalImage = null;
let fixedImage = null;
let cropScale = 1;
let cropX = 0, cropY = 0;
let frameX = 0, frameY = 0, frameW = 0, frameH = 0;
let isDragging = false;
let isResizing = false;
let activeHandle = null;
let lastTouchX, lastTouchY;
let initialDistance, initialScale;
let guideOffsetX = 0, guideOffsetY = 0;
let guideScale = 1;
let guideRotation = 0;
let isMovingGuide = false;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  setupFileInput();
  setupCropEvents();
  setupWorkEvents();
  setupControls();
  setupUI();
});

// ===== UI GENERAL =====
function setupUI() {
  document.getElementById('menuToggle').addEventListener('click', () => {
    settingsPanel.classList.add('open');
  });
  
  document.getElementById('closePanel').addEventListener('click', () => {
    settingsPanel.classList.remove('open');
  });
  
  document.getElementById('newImageBtn').addEventListener('click', () => {
    fileInput.click();
  });
  
  document.getElementById('cancelCrop').addEventListener('click', () => {
    cropMode.style.display = 'none';
    workMode.style.display = 'none';
  });
  
  document.getElementById('confirmCrop').addEventListener('click', applyCrop);
  
  document.getElementById('resetGuideBtn').addEventListener('click', () => {
    guideOffsetX = 0;
    guideOffsetY = 0;
    guideScale = 1;
    guideRotation = 0;
    drawGuides();
  });
  
  document.getElementById('moveGuideBtn').addEventListener('click', toggleGuideMove);
  
  document.getElementById('downloadBtn').addEventListener('click', downloadImage);
}

// ===== SUBIR IMAGEN =====
function setupFileInput() {
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          originalImage = img;
          startCropMode(img);
        };
        img.src = event.target.result;
      };
      
      reader.readAsDataURL(file);
    }
  });
}

function startCropMode(img) {
  cropImage.src = img.src;
  
  const containerW = cropMode.clientWidth;
  const containerH = cropMode.clientHeight - 60;
  
  const imgRatio = img.width / img.height;
  let w, h;
  
  if (imgRatio > 1) {
    w = Math.min(containerW, img.width);
    h = w / imgRatio;
  } else {
    h = Math.min(containerH, img.height);
    w = h * imgRatio;
  }
  
  cropScale = 1;
  cropImage.style.width = w + 'px';
  cropImage.style.height = h + 'px';
  cropWrapper.style.width = w + 'px';
  cropWrapper.style.height = h + 'px';
  cropFrame.style.width = w + 'px';
  cropFrame.style.height = h + 'px';
  
  cropX = (containerW - w) / 2;
  cropY = (containerH - h) / 2 + 30;
  updateCropTransform();
  
  frameW = w;
  frameH = h;
  
  cropMode.style.display = 'flex';
  workMode.style.display = 'none';
}

function updateCropTransform() {
  cropWrapper.style.transform = `translate(${cropX}px, ${cropY}px) scale(${cropScale})`;
}

// ===== EVENTOS DE RECORTE =====
function setupCropEvents() {
  const workspace = cropMode.querySelector('.crop-workspace');
  
  workspace.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touches = e.touches;
    const target = e.target;
    
    if (target.classList.contains('handle')) {
      isResizing = true;
      activeHandle = target.dataset.handle;
    } else if (touches.length === 2) {
      const t1 = touches[0], t2 = touches[1];
      initialDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      initialScale = cropScale;
    } else if (touches.length === 1) {
      isDragging = true;
      lastTouchX = touches[0].clientX;
      lastTouchY = touches[0].clientY;
    }
  });
  
  workspace.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touches = e.touches;
    
    if (isResizing && activeHandle) {
      // Lógica de resize simplificada
    } else if (touches.length === 2) {
      const dist = Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);
      cropScale = Math.min(Math.max(initialScale * (dist / initialDistance), 0.5), 3);
      updateCropTransform();
    } else if (touches.length === 1 && isDragging) {
      cropX += touches[0].clientX - lastTouchX;
      cropY += touches[0].clientY - lastTouchY;
      lastTouchX = touches[0].clientX;
      lastTouchY = touches[0].clientY;
      updateCropTransform();
    }
  });
  
  workspace.addEventListener('touchend', () => {
    isDragging = false;
    isResizing = false;
    activeHandle = null;
  });
}

function applyCrop() {
  const canvas = document.createElement('canvas');
  const wrapperRect = cropWrapper.getBoundingClientRect();
  const frameRect = cropFrame.getBoundingClientRect();
  const imgRect = cropImage.getBoundingClientRect();
  
  const scaleX = originalImage.width / imgRect.width;
  const scaleY = originalImage.height / imgRect.height;
  
  const srcX = (frameRect.left - imgRect.left) * scaleX;
  const srcY = (frameRect.top - imgRect.top) * scaleY;
  const srcW = frameRect.width * scaleX;
  const srcH = frameRect.height * scaleY;
  
  canvas.width = srcW;
  canvas.height = srcH;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(originalImage, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
  
  fixedImage = canvas;
  
  imageCanvas.width = workWorkspace.clientWidth;
  imageCanvas.height = workWorkspace.clientHeight;
  guideCanvas.width = workWorkspace.clientWidth;
  guideCanvas.height = workWorkspace.clientHeight;
  
  const imgCtx = imageCanvas.getContext('2d');
  imgCtx.drawImage(canvas, 0, 0, imageCanvas.width, imageCanvas.height);
  
  cropMode.style.display = 'none';
  workMode.style.display = 'flex';
  
  guideOffsetX = 0;
  guideOffsetY = 0;
  guideScale = 1;
  guideRotation = 0;
  
  drawGuides();
}

// ===== MODO TRABAJO =====
function setupWorkEvents() {
  guideCanvas.addEventListener('touchstart', (e) => {
    if (!isMovingGuide) return;
    e.preventDefault();
    const touch = e.touches[0];
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
  });
  
  guideCanvas.addEventListener('touchmove', (e) => {
    if (!isMovingGuide) return;
    e.preventDefault();
    const touch = e.touches[0];
    guideOffsetX += touch.clientX - lastTouchX;
    guideOffsetY += touch.clientY - lastTouchY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
    drawGuides();
  });
}

function toggleGuideMove() {
  isMovingGuide = !isMovingGuide;
  const btn = document.getElementById('moveGuideBtn');
  
  if (isMovingGuide) {
    workWorkspace.classList.add('guide-moving');
    btn.classList.add('active');
    btn.textContent = '📍';
  } else {
    workWorkspace.classList.remove('guide-moving');
    btn.classList.remove('active');
    btn.textContent = '✋';
  }
}

// ===== DIBUJAR GUÍAS =====
function drawGuides() {
  if (!fixedImage) return;
  
  const ctx = guideCanvas.getContext('2d');
  const w = guideCanvas.width;
  const h = guideCanvas.height;
  
  ctx.clearRect(0, 0, w, h);
  
  const opacity = document.getElementById('opacity').value / 100;
  const color = document.getElementById('lineColor').value;
  const lineWidth = parseInt(document.getElementById('lineWidth').value);
  const circles = parseInt(document.getElementById('circles').value);
  const radialLines = parseInt(document.getElementById('radialLines').value);
  const spacingFactor = parseInt(document.getElementById('spacing').value) / 100;
  const circleSizeFactor = parseInt(document.getElementById('circleSize').value) / 100;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = opacity;
  
  const centerX = w/2 + guideOffsetX;
  const centerY = h/2 + guideOffsetY;
  const baseRadius = Math.min(w, h) * 0.12 * circleSizeFactor * guideScale;
  const spacing = baseRadius * 2.2 * spacingFactor;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(guideRotation * Math.PI / 180);
  
  // Cuadrícula
  ctx.lineWidth = lineWidth * 0.5;
  ctx.globalAlpha = opacity * 0.3;
  ctx.beginPath();
  const gridSize = Math.max(w, h) * 0.8;
  for (let i = -4; i <= 4; i++) {
    const p = i * gridSize / 4;
    ctx.moveTo(p, -gridSize); ctx.lineTo(p, gridSize);
    ctx.moveTo(-gridSize, p); ctx.lineTo(gridSize, p);
  }
  ctx.stroke();
  
  // Diagonales
  ctx.beginPath();
  ctx.moveTo(-gridSize, -gridSize); ctx.lineTo(gridSize, gridSize);
  ctx.moveTo(gridSize, -gridSize); ctx.lineTo(-gridSize, gridSize);
  ctx.stroke();
  
  // Línea central
  ctx.lineWidth = lineWidth * 1.2;
  ctx.globalAlpha = opacity * 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -h/2); ctx.lineTo(0, h/2);
  ctx.stroke();
  
  // Círculos
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = opacity;
  const startY = -((circles - 1) * spacing) / 2;
  
  for (let i = 0; i < circles; i++) {
    const y = startY + i * spacing;
    
    ctx.beginPath();
    ctx.arc(0, y, baseRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.lineWidth = lineWidth * 0.7;
    ctx.beginPath();
    ctx.arc(0, y, baseRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, y, lineWidth * 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    if (radialLines > 0) {
      ctx.lineWidth = lineWidth * 0.5;
      ctx.beginPath();
      for (let j = 0; j < radialLines; j++) {
        const angle = (j / radialLines) * Math.PI * 2;
        ctx.moveTo(0, y);
        ctx.lineTo(Math.cos(angle) * baseRadius, y + Math.sin(angle) * baseRadius);
      }
      ctx.stroke();
    }
    
    ctx.lineWidth = lineWidth * 0.8;
    ctx.beginPath();
    ctx.moveTo(-baseRadius * 1.5, y);
    ctx.lineTo(baseRadius * 1.5, y);
    ctx.stroke();
    
    ctx.lineWidth = lineWidth;
  }
  
  ctx.restore();
}

// ===== CONTROLES DE GUÍA =====
function setupControls() {
  const controls = ['circles', 'spacing', 'circleSize', 'radialLines', 'opacity', 'lineColor', 'lineWidth'];
  
  controls.forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
      const valueEl = document.getElementById(id + 'Value');
      if (valueEl) {
        let suffix = '';
        if (['spacing', 'circleSize', 'opacity'].includes(id)) suffix = '%';
        valueEl.textContent = this.value + suffix;
      }
      drawGuides();
    });
  });
}

// ===== DESCARGAR =====
function downloadImage() {
  const combined = document.createElement('canvas');
  combined.width = imageCanvas.width;
  combined.height = imageCanvas.height;
  const ctx = combined.getContext('2d');
  ctx.drawImage(imageCanvas, 0, 0);
  ctx.drawImage(guideCanvas, 0, 0);
  
  const link = document.createElement('a');
  link.download = 'painting-with-roma.png';
  link.href = combined.toDataURL();
  link.click();
}