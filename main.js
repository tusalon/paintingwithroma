document.addEventListener('DOMContentLoaded', () => {
  // ===== ELEMENTOS DOM =====
  const welcomeScreen = document.getElementById('welcomeScreen');
  const cropMode = document.getElementById('cropMode');
  const workMode = document.getElementById('workMode');
  const fileInput = document.getElementById('fileInput');
  const cropImage = document.getElementById('cropImage');
  const panel = document.getElementById('settingsPanel');

  // ===== VARIABLES GLOBALES =====
  let originalImage = null;
  let cropX = 0, cropY = 0;
  let isDragging = false;
  let lastTouchX, lastTouchY;
  let guideOffsetX = 0, guideOffsetY = 0;
  let isMovingGuide = false;
  
  // Proporción estándar para uñas Ballerina/Acrílicas
  const NAIL_RATIO = 9/16; // 0.5625

  // ===== INICIALIZACIÓN =====
  document.getElementById('uploadBtn')?.addEventListener('click', () => fileInput.click());

  // ===== CARGA DE IMAGEN =====
  fileInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          originalImage = img;
          cropImage.src = ev.target.result;
          welcomeScreen.style.display = 'none';
          cropMode.style.display = 'flex';
          
          initializeCropMode();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  function initializeCropMode() {
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.6;
    
    let wrapperWidth, wrapperHeight;
    const imgRatio = originalImage.width / originalImage.height;
    
    if (imgRatio > NAIL_RATIO) {
      wrapperHeight = Math.min(maxHeight, maxWidth / NAIL_RATIO);
      wrapperWidth = wrapperHeight * NAIL_RATIO;
    } else {
      wrapperWidth = Math.min(maxWidth, maxHeight * NAIL_RATIO);
      wrapperHeight = wrapperWidth / NAIL_RATIO;
    }
    
    const wrapper = document.getElementById('cropWrapper');
    wrapper.style.width = wrapperWidth + 'px';
    wrapper.style.height = wrapperHeight + 'px';
    
    const frame = document.getElementById('cropFrame');
    const frameWidth = wrapperWidth * 0.8;
    const frameHeight = frameWidth / NAIL_RATIO;
    
    frame.style.width = frameWidth + 'px';
    frame.style.height = frameHeight + 'px';
    frame.style.left = ((wrapperWidth - frameWidth) / 2) + 'px';
    frame.style.top = ((wrapperHeight - frameHeight) / 2) + 'px';
    
    cropX = (window.innerWidth - wrapperWidth) / 2;
    cropY = (window.innerHeight - wrapperHeight) / 2;
    wrapper.style.transform = `translate(${cropX}px, ${cropY}px)`;
    
    // Hacer handles funcionales
    setupCropHandles(frame, wrapper);
  }

  function setupCropHandles(frame, wrapper) {
    const handles = document.querySelectorAll('.handle');
    let isResizing = false;
    let currentHandle = null;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    
    handles.forEach(handle => {
      handle.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        isResizing = true;
        currentHandle = handle;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startWidth = parseFloat(frame.style.width);
        startHeight = parseFloat(frame.style.height);
        startLeft = parseFloat(frame.style.left);
        startTop = parseFloat(frame.style.top);
      });
    });
    
    document.addEventListener('touchmove', (e) => {
      if (!isResizing || !currentHandle) return;
      e.preventDefault();
      
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;
      
      if (currentHandle.classList.contains('br')) {
        newWidth = Math.max(100, startWidth + dx);
        newHeight = newWidth / NAIL_RATIO;
      } else if (currentHandle.classList.contains('bl')) {
        newWidth = Math.max(100, startWidth - dx);
        newHeight = newWidth / NAIL_RATIO;
        newLeft = startLeft + (startWidth - newWidth);
      } else if (currentHandle.classList.contains('tr')) {
        newWidth = Math.max(100, startWidth + dx);
        newHeight = newWidth / NAIL_RATIO;
        newTop = startTop + (startHeight - newHeight);
      } else if (currentHandle.classList.contains('tl')) {
        newWidth = Math.max(100, startWidth - dx);
        newHeight = newWidth / NAIL_RATIO;
        newLeft = startLeft + (startWidth - newWidth);
        newTop = startTop + (startHeight - newHeight);
      }
      
      // Mantener dentro del wrapper
      const wrapperWidth = parseFloat(wrapper.style.width);
      const wrapperHeight = parseFloat(wrapper.style.height);
      newLeft = Math.max(0, Math.min(newLeft, wrapperWidth - newWidth));
      newTop = Math.max(0, Math.min(newTop, wrapperHeight - newHeight));
      
      frame.style.width = newWidth + 'px';
      frame.style.height = newHeight + 'px';
      frame.style.left = newLeft + 'px';
      frame.style.top = newTop + 'px';
    });
    
    document.addEventListener('touchend', () => {
      isResizing = false;
      currentHandle = null;
    });
  }

  // ===== CANCELAR RECORTE =====
  document.getElementById('cancelCrop')?.addEventListener('click', () => {
    cropMode.style.display = 'none';
    welcomeScreen.style.display = 'flex';
  });

  // ===== MOVER IMAGEN EN MODO RECORTE =====
  const workspace = document.querySelector('.crop-workspace');
  workspace.addEventListener('touchstart', (e) => {
    if (e.target.classList.contains('handle')) return;
    isDragging = true;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
  });
  
  workspace.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    cropX += e.touches[0].clientX - lastTouchX;
    cropY += e.touches[0].clientY - lastTouchY;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
    document.getElementById('cropWrapper').style.transform = `translate(${cropX}px, ${cropY}px)`;
  });
  
  workspace.addEventListener('touchend', () => isDragging = false);

  // ===== CONFIRMAR RECORTE =====
  document.getElementById('confirmCrop')?.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    const frame = document.getElementById('cropFrame');
    const frameRect = frame.getBoundingClientRect();
    const imgRect = cropImage.getBoundingClientRect();
    
    const scaleX = originalImage.width / imgRect.width;
    const scaleY = originalImage.height / imgRect.height;
    
    const sx = (frameRect.left - imgRect.left) * scaleX;
    const sy = (frameRect.top - imgRect.top) * scaleY;
    const sWidth = frameRect.width * scaleX;
    const sHeight = frameRect.height * scaleY;
    
    canvas.width = sWidth;
    canvas.height = sHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    
    setupWorkMode(canvas);
  });

  function setupWorkMode(croppedCanvas) {
    const imageCanvas = document.getElementById('imageCanvas');
    const guideCanvas = document.getElementById('guideCanvas');
    const workWorkspace = document.getElementById('workWorkspace');
    
    const containerWidth = workWorkspace.clientWidth;
    const containerHeight = workWorkspace.clientHeight;
    
    let canvasWidth, canvasHeight;
    if (containerWidth / containerHeight > NAIL_RATIO) {
      canvasHeight = containerHeight;
      canvasWidth = canvasHeight * NAIL_RATIO;
    } else {
      canvasWidth = containerWidth;
      canvasHeight = canvasWidth / NAIL_RATIO;
    }
    
    imageCanvas.width = guideCanvas.width = canvasWidth;
    imageCanvas.height = guideCanvas.height = canvasHeight;
    
    imageCanvas.style.width = canvasWidth + 'px';
    imageCanvas.style.height = canvasHeight + 'px';
    guideCanvas.style.width = canvasWidth + 'px';
    guideCanvas.style.height = canvasHeight + 'px';
    
    imageCanvas.style.left = ((containerWidth - canvasWidth) / 2) + 'px';
    guideCanvas.style.left = ((containerWidth - canvasWidth) / 2) + 'px';
    
    const imgCtx = imageCanvas.getContext('2d');
    const scale = Math.min(canvasWidth / croppedCanvas.width, canvasHeight / croppedCanvas.height);
    const x = (canvasWidth - croppedCanvas.width * scale) / 2;
    const y = (canvasHeight - croppedCanvas.height * scale) / 2;
    
    imgCtx.fillStyle = '#000';
    imgCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    imgCtx.drawImage(croppedCanvas, 0, 0, croppedCanvas.width, croppedCanvas.height, x, y, croppedCanvas.width * scale, croppedCanvas.height * scale);
    
    cropMode.style.display = 'none';
    workMode.style.display = 'flex';
    drawProfessionalGuides();
  }

  // ===== NAVEGACIÓN =====
  document.getElementById('backToWelcome')?.addEventListener('click', () => {
    if (confirm("¿Quieres reiniciar y cargar otra imagen?")) {
      location.reload();
    }
  });

  document.getElementById('toggleSettings')?.addEventListener('click', () => {
    panel.classList.toggle('open');
  });
  
  document.getElementById('closeSettings')?.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  // ===== MOVER GUÍAS =====
  document.getElementById('moveGuideBtn')?.addEventListener('click', function() {
    isMovingGuide = !isMovingGuide;
    this.classList.toggle('active');
    this.textContent = isMovingGuide ? '📍 Fijar Posición' : '✋ Mover Guías';
  });

  const guideCanvas = document.getElementById('guideCanvas');
  guideCanvas.addEventListener('touchstart', (e) => {
    if (!isMovingGuide) return;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
  });
  
  guideCanvas.addEventListener('touchmove', (e) => {
    if (!isMovingGuide) return;
    e.preventDefault();
    if (!lastTouchX) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      return;
    }
    guideOffsetX += e.touches[0].clientX - lastTouchX;
    guideOffsetY += e.touches[0].clientY - lastTouchY;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
    drawProfessionalGuides();
  });
  
  guideCanvas.addEventListener('touchend', () => {
    lastTouchX = null;
    lastTouchY = null;
  });

  // ===== RESETEAR POSICIÓN =====
  document.getElementById('resetGuidesBtn')?.addEventListener('click', () => {
    guideOffsetX = 0;
    guideOffsetY = 0;
    drawProfessionalGuides();
  });

  // ===== DIBUJAR GUÍAS PROFESIONALES =====
  function drawProfessionalGuides() {
    const canvas = document.getElementById('guideCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    const color = document.getElementById('lineColor').value;
    const opacity = document.getElementById('opacity').value / 100;
    const lineWidth = parseInt(document.getElementById('lineWidth').value);
    const eyeHeightPercent = parseInt(document.getElementById('eyeHeight').value) / 100;
    const chinHeightPercent = parseInt(document.getElementById('chinHeight').value) / 100;
    
    // Márgenes de seguridad (12% cada lado)
    const marginPercent = 0.12;
    const leftMargin = w * marginPercent;
    const rightMargin = w * (1 - marginPercent);
    
    const offsetX = guideOffsetX;
    const offsetY = guideOffsetY;
    
    // 1. LÍNEA CENTRAL VERTICAL
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.setLineDash([]);
    ctx.globalAlpha = opacity * 0.4;
    ctx.lineWidth = lineWidth * 0.8;
    ctx.moveTo(w/2 + offsetX, 0);
    ctx.lineTo(w/2 + offsetX, h);
    ctx.stroke();
    
    // 2. LÍNEA DE OJOS
    ctx.beginPath();
    ctx.strokeStyle = '#FF69B4';
    ctx.setLineDash([8, 6]);
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;
    const eyeY = h * eyeHeightPercent + offsetY;
    ctx.moveTo(leftMargin + offsetX, eyeY);
    ctx.lineTo(rightMargin + offsetX, eyeY);
    ctx.stroke();
    
    // 3. LÍNEA DE MENTÓN
    ctx.beginPath();
    ctx.strokeStyle = '#FF69B4';
    const chinY = h * chinHeightPercent + offsetY;
    ctx.moveTo(leftMargin + offsetX, chinY);
    ctx.lineTo(rightMargin + offsetX, chinY);
    ctx.stroke();
    
    // 4. MÁRGENES DE SEGURIDAD
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = opacity * 0.5;
    ctx.lineWidth = lineWidth * 0.7;
    ctx.moveTo(leftMargin + offsetX, 0);
    ctx.lineTo(leftMargin + offsetX, h);
    ctx.stroke();
    ctx.moveTo(rightMargin + offsetX, 0);
    ctx.lineTo(rightMargin + offsetX, h);
    ctx.stroke();
    
    // 5. LÍNEAS RADIALES
    const radialLines = parseInt(document.getElementById('radialLines').value);
    if (radialLines > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.setLineDash([2, 4]);
      ctx.globalAlpha = opacity * 0.3;
      ctx.lineWidth = 1;
      
      const centerX = w/2 + offsetX;
      const centerY = h * 0.35 + offsetY;
      
      for (let i = 0; i < radialLines; i++) {
        const angle = (i / radialLines) * Math.PI * 2;
        const radius = Math.max(w, h) * 0.8;
        const x2 = centerX + Math.cos(angle) * radius;
        const y2 = centerY + Math.sin(angle) * radius;
        
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    
    // 6. CÍRCULOS CONCÉNTRICOS
    const circles = parseInt(document.getElementById('circles').value);
    if (circles > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.setLineDash([]);
      ctx.globalAlpha = opacity * 0.4;
      ctx.lineWidth = lineWidth * 0.6;
      
      const centerX = w/2 + offsetX;
      const centerY = h * 0.35 + offsetY;
      const spacing = (h * 0.3) / circles;
      
      for (let i = 1; i <= circles; i++) {
        ctx.moveTo(centerX + i * spacing, centerY);
        ctx.ellipse(centerX, centerY, i * spacing, i * spacing * 0.75, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    
    // 7. ETIQUETAS
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#FF69B4';
    ctx.globalAlpha = opacity;
    ctx.textAlign = 'center';
    ctx.fillText('👁️ OJOS', w/2 + offsetX, eyeY - 8);
    ctx.fillText('💋 MENTÓN', w/2 + offsetX, chinY - 8);
    
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity * 0.6;
    ctx.font = '10px -apple-system';
    ctx.fillText('Zona Segura', leftMargin - 35 + offsetX, h/2);
    ctx.fillText('Zona Segura', rightMargin + 35 + offsetX, h/2);
    
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // ===== CONECTAR CONTROLES =====
  ['circles', 'radialLines', 'opacity', 'lineColor', 'lineWidth', 'eyeHeight', 'chinHeight'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
      const valueEl = document.getElementById(id + 'Value');
      if (valueEl) valueEl.textContent = e.target.value;
      drawProfessionalGuides();
    });
  });

  // ===== DESCARGAR =====
  document.getElementById('downloadBtn').addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    const imgCanvas = document.getElementById('imageCanvas');
    const guideCanvas = document.getElementById('guideCanvas');
    
    canvas.width = imgCanvas.width;
    canvas.height = imgCanvas.height;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgCanvas, 0, 0);
    ctx.drawImage(guideCanvas, 0, 0);
    
    const link = document.createElement('a');
    link.download = `uña-guia-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
});