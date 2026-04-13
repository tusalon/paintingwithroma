console.log('🎨 Painting With Roma - Fullscreen');

// ===== VARIABLES =====
let currentImage = null;
let originalCanvas, guideCanvas;
let workspace, canvasWrapper;

let viewX = 0, viewY = 0;
let viewScale = 1;
let rotation = 0;

let isDragging = false;
let lastTouchX, lastTouchY;
let initialDistance, initialScale, initialRotation, initialAngle;

let settingsPanel, emptyState;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  originalCanvas = document.getElementById('originalCanvas');
  guideCanvas = document.getElementById('guideCanvas');
  workspace = document.getElementById('workspace');
  canvasWrapper = document.getElementById('canvasWrapper');
  settingsPanel = document.getElementById('settingsPanel');
  emptyState = document.getElementById('emptyState');
  
  setupFileInput();
  setupControls();
  setupTouchEvents();
  setupUI();
});

// ===== UI =====
function setupUI() {
  const galleryBtn = document.getElementById('galleryBtn');
  const menuToggle = document.getElementById('menuToggle');
  const closePanel = document.getElementById('closePanel');
  const resetViewBtn = document.getElementById('resetViewBtn');
  const fileInput = document.getElementById('fileInput');
  
  // Abrir galería
  galleryBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });
  
  emptyState.addEventListener('click', (e) => {
    e.preventDefault();
    fileInput.click();
  });
  
  menuToggle.addEventListener('click', () => settingsPanel.classList.add('open'));
  closePanel.addEventListener('click', () => settingsPanel.classList.remove('open'));
  
  resetViewBtn.addEventListener('click', () => {
    if (currentImage) {
      resetView();
      drawGuide();
    }
  });
}

// ===== SUBIDA DE IMAGEN =====
function setupFileInput() {
  const fileInput = document.getElementById('fileInput');
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          currentImage = img;
          setupCanvases(img);
          resetView();
          drawGuide();
          emptyState.style.display = 'none';
        };
        img.src = event.target.result;
      };
      
      reader.readAsDataURL(file);
    }
  });
}

function setupCanvases(img) {
  const containerWidth = workspace.clientWidth;
  const containerHeight = workspace.clientHeight;
  
  const imgRatio = img.width / img.height;
  const containerRatio = containerWidth / containerHeight;
  
  let width, height;
  
  if (imgRatio > containerRatio) {
    width = containerWidth;
    height = width / imgRatio;
  } else {
    height = containerHeight;
    width = height * imgRatio;
  }
  
  originalCanvas.width = width;
  originalCanvas.height = height;
  guideCanvas.width = width;
  guideCanvas.height = height;
  
  originalCanvas.style.width = width + 'px';
  originalCanvas.style.height = height + 'px';
  guideCanvas.style.width = width + 'px';
  guideCanvas.style.height = height + 'px';
  
  canvasWrapper.style.width = width + 'px';
  canvasWrapper.style.height = height + 'px';
  
  const ctx = originalCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  
  // Centrar
  viewX = (containerWidth - width) / 2;
  viewY = (containerHeight - height) / 2;
  updateTransform();
}

function resetView() {
  const containerWidth = workspace.clientWidth;
  const containerHeight = workspace.clientHeight;
  const width = originalCanvas.width;
  const height = originalCanvas.height;
  
  viewX = (containerWidth - width) / 2;
  viewY = (containerHeight - height) / 2;
  viewScale = 1;
  rotation = 0;
  updateTransform();
}

function updateTransform() {
  canvasWrapper.style.transform = `translate(${viewX}px, ${viewY}px) scale(${viewScale}) rotate(${rotation}deg)`;
}

// ===== CONTROLES =====
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
      if (currentImage) drawGuide();
    });
  });
  
  document.getElementById('downloadBtn').addEventListener('click', downloadImage);
}

// ===== DIBUJAR GUÍAS =====
function drawGuide() {
  if (!currentImage) return;
  
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
  
  const centerX = w/2;
  const centerY = h/2;
  const baseRadius = Math.min(w, h) * 0.12 * circleSizeFactor;
  const spacing = baseRadius * 2.2 * spacingFactor;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  
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

// ===== GESTOS TÁCTILES =====
function setupTouchEvents() {
  workspace.addEventListener('touchstart', (e) => {
    if (!currentImage) return;
    e.preventDefault();
    
    const touches = e.touches;
    
    if (touches.length === 1) {
      isDragging = true;
      lastTouchX = touches[0].clientX;
      lastTouchY = touches[0].clientY;
    } else if (touches.length === 2) {
      isDragging = false;
      const t1 = touches[0], t2 = touches[1];
      initialDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      initialScale = viewScale;
      initialAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      initialRotation = rotation;
    }
  }, { passive: false });
  
  workspace.addEventListener('touchmove', (e) => {
    if (!currentImage) return;
    e.preventDefault();
    
    const touches = e.touches;
    
    if (touches.length === 1 && isDragging) {
      viewX += touches[0].clientX - lastTouchX;
      viewY += touches[0].clientY - lastTouchY;
      lastTouchX = touches[0].clientX;
      lastTouchY = touches[0].clientY;
      updateTransform();
    } else if (touches.length === 2) {
      const t1 = touches[0], t2 = touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      viewScale = Math.min(Math.max(initialScale * (dist / initialDistance), 0.5), 4);
      
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      rotation = initialRotation + (angle - initialAngle) * 180 / Math.PI;
      
      updateTransform();
    }
  }, { passive: false });
  
  workspace.addEventListener('touchend', () => {
    isDragging = false;
  });
}

// ===== DESCARGAR =====
function downloadImage() {
  const combined = document.createElement('canvas');
  combined.width = originalCanvas.width;
  combined.height = originalCanvas.height;
  const ctx = combined.getContext('2d');
  ctx.drawImage(originalCanvas, 0, 0);
  ctx.drawImage(guideCanvas, 0, 0);
  
  const link = document.createElement('a');
  link.download = 'painting-with-roma.png';
  link.href = combined.toDataURL();
  link.click();
}