console.log('🎨 Painting With Roma - Guías de Trazado Profesional');

// ===== VARIABLES GLOBALES =====
let currentImage = null;
let originalCanvas, guideCanvas;

// Transformaciones
let offsetX = 0, offsetY = 0;
let scale = 1, rotation = 0;

// Touch tracking
let isDragging = false;
let lastTouchX, lastTouchY;
let initialDistance, initialScale, initialRotation, initialAngle;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  originalCanvas = document.getElementById('originalCanvas');
  guideCanvas = document.getElementById('guideCanvas');
  
  setupFileInput();
  setupControls();
  setupTouchEvents();
});

// ===== SUBIDA DE IMAGEN (SIEMPRE GALERÍA) =====
function setupFileInput() {
  const fileInput = document.getElementById('fileInput');
  fileInput.removeAttribute('capture');
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          currentImage = img;
          setupCanvases(img);
          resetTransform();
          drawGuide();
          showCanvas();
        };
        img.src = event.target.result;
      };
      
      reader.readAsDataURL(file);
    }
  });
}

function setupCanvases(img) {
  const container = document.querySelector('.canvas-9x16-wrapper');
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  
  let width, height;
  const imgRatio = img.width / img.height;
  const targetRatio = 9 / 16;
  
  if (imgRatio > targetRatio) {
    height = containerHeight;
    width = height * imgRatio;
  } else {
    width = containerWidth;
    height = width / imgRatio;
  }
  
  originalCanvas.width = width;
  originalCanvas.height = height;
  guideCanvas.width = width;
  guideCanvas.height = height;
  
  const ctx = originalCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
}

function showCanvas() {
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('canvasSection').style.display = 'block';
  document.getElementById('controls').style.display = 'flex';
}

function resetTransform() {
  offsetX = 0; offsetY = 0;
  scale = 1; rotation = 0;
}

// ===== CONTROLES UI =====
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
  
  document.getElementById('resetBtn').addEventListener('click', () => {
    resetTransform();
    if (currentImage) drawGuide();
  });
  
  document.getElementById('downloadBtn').addEventListener('click', downloadImage);
}

// ===== DIBUJAR GUÍAS =====
function drawGuide() {
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
  
  const centerX = w/2 + offsetX;
  const centerY = h/2 + offsetY;
  const baseRadius = Math.min(w, h) * 0.12 * circleSizeFactor;
  const spacing = baseRadius * 2.2 * spacingFactor;
  
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.scale(scale, scale);
  
  // Cuadrícula de fondo
  ctx.lineWidth = lineWidth * 0.5 / scale;
  ctx.globalAlpha = opacity * 0.3;
  ctx.beginPath();
  const gridSize = Math.max(w, h) * 0.8 / scale;
  for (let i = -4; i <= 4; i++) {
    const p = i * gridSize / 4;
    ctx.moveTo(p, -gridSize);
    ctx.lineTo(p, gridSize);
    ctx.moveTo(-gridSize, p);
    ctx.lineTo(gridSize, p);
  }
  ctx.stroke();
  
  // Diagonales
  ctx.beginPath();
  ctx.moveTo(-gridSize, -gridSize);
  ctx.lineTo(gridSize, gridSize);
  ctx.moveTo(gridSize, -gridSize);
  ctx.lineTo(-gridSize, gridSize);
  ctx.stroke();
  
  // Línea central
  ctx.lineWidth = lineWidth * 1.2 / scale;
  ctx.globalAlpha = opacity * 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -h/2);
  ctx.lineTo(0, h/2);
  ctx.stroke();
  
  // Círculos en columna
  ctx.lineWidth = lineWidth / scale;
  ctx.globalAlpha = opacity;
  const startY = -((circles - 1) * spacing) / 2;
  
  for (let i = 0; i < circles; i++) {
    const y = startY + i * spacing;
    
    // Círculo principal
    ctx.beginPath();
    ctx.arc(0, y, baseRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Círculo interior
    ctx.lineWidth = lineWidth * 0.7 / scale;
    ctx.beginPath();
    ctx.arc(0, y, baseRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    
    // Punto central
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, y, lineWidth * 1.5 / scale, 0, Math.PI * 2);
    ctx.fill();
    
    // Líneas radiales
    if (radialLines > 0) {
      ctx.lineWidth = lineWidth * 0.5 / scale;
      ctx.beginPath();
      for (let j = 0; j < radialLines; j++) {
        const angle = (j / radialLines) * Math.PI * 2;
        ctx.moveTo(0, y);
        ctx.lineTo(Math.cos(angle) * baseRadius, y + Math.sin(angle) * baseRadius);
      }
      ctx.stroke();
    }
    
    // Línea horizontal
    ctx.lineWidth = lineWidth * 0.8 / scale;
    ctx.beginPath();
    ctx.moveTo(-baseRadius * 1.5, y);
    ctx.lineTo(baseRadius * 1.5, y);
    ctx.stroke();
    
    ctx.lineWidth = lineWidth / scale;
  }
  
  ctx.restore();
}

// ===== GESTOS TÁCTILES =====
function setupTouchEvents() {
  guideCanvas.addEventListener('touchstart', (e) => {
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
      initialScale = scale;
      initialAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      initialRotation = rotation;
    }
  }, { passive: false });
  
  guideCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!currentImage) return;
    const touches = e.touches;
    
    if (touches.length === 1 && isDragging) {
      offsetX += (touches[0].clientX - lastTouchX) / scale;
      offsetY += (touches[0].clientY - lastTouchY) / scale;
      lastTouchX = touches[0].clientX;
      lastTouchY = touches[0].clientY;
      drawGuide();
    } else if (touches.length === 2) {
      const t1 = touches[0], t2 = touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      scale = Math.min(Math.max(initialScale * (dist / initialDistance), 0.5), 3);
      
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
      rotation = initialRotation + (angle - initialAngle) * 180 / Math.PI;
      
      drawGuide();
    }
  }, { passive: false });
  
  guideCanvas.addEventListener('touchend', () => {
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