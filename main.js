document.addEventListener('DOMContentLoaded', () => {
  setupUI();
  setupFileInput();
  setupCropEvents();
  setupWorkEvents();
  setupControls();
});

// Variables Globales
let originalImage = null;
let fixedImage = null;
let cropScale = 1;
let cropX = 0, cropY = 0;
let isDragging = false;
let lastTouchX, lastTouchY;
let guideOffsetX = 0, guideOffsetY = 0;
let isMovingGuide = false;

function setupUI() {
  const welcomeScreen = document.getElementById('welcomeScreen');
  const cropMode = document.getElementById('cropMode');
  const workMode = document.getElementById('workMode');
  const panel = document.getElementById('settingsPanel');

  // Botón Principal de Subida
  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });

  // Botón Cancelar Recorte
  document.getElementById('cancelCrop').addEventListener('click', () => {
    cropMode.style.display = 'none';
    welcomeScreen.style.display = 'flex';
  });

  // Botón Confirmar Recorte
  document.getElementById('confirmCrop').addEventListener('click', applyCrop);

  // Navegación en Modo Trabajo
  document.getElementById('backToWelcome').addEventListener('click', () => {
    if(confirm("¿Quieres volver? Se perderá el diseño actual.")) {
      workMode.style.display = 'none';
      welcomeScreen.style.display = 'flex';
    }
  });

  document.getElementById('toggleSettings').addEventListener('click', () => {
    panel.classList.toggle('open');
  });

  document.getElementById('closeSettings').addEventListener('click', () => {
    panel.classList.remove('open');
  });

  document.getElementById('moveGuideBtn').addEventListener('click', function() {
    isMovingGuide = !isMovingGuide;
    this.classList.toggle('active');
    this.textContent = isMovingGuide ? '📍 Fijar Guías' : '✋ Mover Guías';
  });

  document.getElementById('downloadBtn').addEventListener('click', downloadImage);
}

function setupFileInput() {
  const fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          originalImage = img;
          startCropMode(img);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  });
}

function startCropMode(img) {
  const cropImage = document.getElementById('cropImage');
  const cropWrapper = document.getElementById('cropWrapper');
  const cropFrame = document.getElementById('cropFrame');
  
  cropImage.src = img.src;
  
  const containerW = window.innerWidth;
  const containerH = window.innerHeight - 80;
  
  const imgRatio = img.width / img.height;
  let w, h;
  
  if (imgRatio > 1) {
    w = containerW * 0.9;
    h = w / imgRatio;
  } else {
    h = containerH * 0.7;
    w = h * imgRatio;
  }
  
  cropWrapper.style.width = w + 'px';
  cropWrapper.style.height = h + 'px';
  cropImage.style.width = '100%';
  
  cropFrame.style.width = w + 'px';
  cropFrame.style.height = h + 'px';
  
  cropX = (containerW - w) / 2;
  cropY = (containerH - h) / 2;
  cropScale = 1;
  
  updateCropTransform();
  
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('cropMode').style.display = 'flex';
}

function updateCropTransform() {
  const cropWrapper = document.getElementById('cropWrapper');
  cropWrapper.style.transform = `translate(${cropX}px, ${cropY}px) scale(${cropScale})`;
}

function setupCropEvents() {
  const workspace = document.querySelector('.crop-workspace');
  
  workspace.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  });
  
  workspace.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
      cropX += e.touches[0].clientX - lastTouchX;
      cropY += e.touches[0].clientY - lastTouchY;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      updateCropTransform();
    }
  });
  
  workspace.addEventListener('touchend', () => isDragging = false);
}

function applyCrop() {
  const canvas = document.createElement('canvas');
  const frameRect = document.getElementById('cropFrame').getBoundingClientRect();
  const imgRect = document.getElementById('cropImage').getBoundingClientRect();
  
  const scale = originalImage.width / imgRect.width;
  
  const srcX = (frameRect.left - imgRect.left) * scale;
  const srcY = (frameRect.top - imgRect.top) * scale;
  const srcW = frameRect.width * scale;
  const srcH = frameRect.height * scale;
  
  canvas.width = srcW;
  canvas.height = srcH;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(originalImage, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
  
  fixedImage = canvas;
  
  const imageCanvas = document.getElementById('imageCanvas');
  const guideCanvas = document.getElementById('guideCanvas');
  const workspace = document.getElementById('workWorkspace');
  
  imageCanvas.width = guideCanvas.width = workspace.clientWidth;
  imageCanvas.height = guideCanvas.height = workspace.clientHeight;
  
  const imgCtx = imageCanvas.getContext('2d');
  const hRatio = imageCanvas.width / canvas.width;
  const vRatio = imageCanvas.height / canvas.height;
  const ratio = Math.min(hRatio, vRatio);
  
  const centerShiftX = (imageCanvas.width - canvas.width * ratio) / 2;
  const centerShiftY = (imageCanvas.height - canvas.height * ratio) / 2;
  
  imgCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 
                  centerShiftX, centerShiftY, canvas.width * ratio, canvas.height * ratio);
  
  document.getElementById('cropMode').style.display = 'none';
  document.getElementById('workMode').style.display = 'flex';
  drawGuides();
}

function setupWorkEvents() {
  const guideCanvas = document.getElementById('guideCanvas');
  guideCanvas.addEventListener('touchstart', (e) => {
    if (!isMovingGuide) return;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
  });
  
  guideCanvas.addEventListener('touchmove', (e) => {
    if (!isMovingGuide) return;
    guideOffsetX += e.touches[0].clientX - lastTouchX;
    guideOffsetY += e.touches[0].clientY - lastTouchY;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
    drawGuides();
  });
}

function drawGuides() {
  const canvas = document.getElementById('guideCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.clearRect(0, 0, w, h);
  
  // Obtener valores de los inputs
  const circles = parseInt(document.getElementById('circles').value);
  const opacity = document.getElementById('opacity').value / 100;
  const color = document.getElementById('lineColor').value;
  const spacingFactor = document.getElementById('spacing').value / 100;
  const sizeFactor = document.getElementById('circleSize').value / 100;
  const radialLines = parseInt(document.getElementById('radialLines').value);
  const lineWidth = parseInt(document.getElementById('lineWidth').value);

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = opacity;
  
  const centerX = w/2 + guideOffsetX;
  const centerY = h/2 + guideOffsetY;
  const baseRadius = Math.min(w, h) * 0.1 * sizeFactor;
  const spacing = baseRadius * 2.5 * spacingFactor;
  
  const startY = centerY - ((circles - 1) * spacing) / 2;
  
  for (let i = 0; i < circles; i++) {
    const y = startY + i * spacing;
    
    // Círculo principal
    ctx.beginPath();
    ctx.arc(centerX, y, baseRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Radial Lines
    if (radialLines > 0) {
      for (let j = 0; j < radialLines; j++) {
        const angle = (j / radialLines) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(centerX, y);
        ctx.lineTo(centerX + Math.cos(angle) * baseRadius, y + Math.sin(angle) * baseRadius);
        ctx.stroke();
      }
    }
  }
}

function setupControls() {
  const ids = ['circles', 'spacing', 'circleSize', 'radialLines', 'opacity', 'lineColor', 'lineWidth'];
  ids.forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
      const valSpan = document.getElementById(id + 'Value');
      if (valSpan) valSpan.textContent = e.target.value + (['opacity', 'spacing', 'circleSize'].includes(id) ? '%' : '');
      drawGuides();
    });
  });
}

function downloadImage() {
  const imageCanvas = document.getElementById('imageCanvas');
  const guideCanvas = document.getElementById('guideCanvas');
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imageCanvas.width;
  tempCanvas.height = imageCanvas.height;
  const ctx = tempCanvas.getContext('2d');
  
  ctx.drawImage(imageCanvas, 0, 0);
  ctx.drawImage(guideCanvas, 0, 0);
  
  const link = document.createElement('a');
  link.download = 'mi-diseño-roma.png';
  link.href = tempCanvas.toDataURL();
  link.click();
}