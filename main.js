document.addEventListener('DOMContentLoaded', () => {
  // Elementos DOM
  const welcomeScreen = document.getElementById('welcomeScreen');
  const cropMode = document.getElementById('cropMode');
  const workMode = document.getElementById('workMode');
  const fileInput = document.getElementById('fileInput');
  const cropImage = document.getElementById('cropImage');
  const panel = document.getElementById('settingsPanel');

  // Variables globales
  let originalImage = null;
  let guideOffsetX = 0, guideOffsetY = 0;
  let isMovingGuide = false;
  let lastTouchX, lastTouchY;
  let circleCount = 3;
  
  // Variables recorte
  let cropImageX = 0, cropImageY = 0;
  let frameX = 0, frameY = 0;
  let frameWidth = 0, frameHeight = 0;
  let isDraggingImage = false, isDraggingFrame = false;
  let dragStartX, dragStartY, frameStartX, frameStartY, imageStartX, imageStartY;
  
  const NAIL_RATIO = 9/16;

  // Inicialización
  document.getElementById('uploadBtn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          originalImage = img;
          cropImage.src = ev.target.result;
          welcomeScreen.style.display = 'none';
          cropMode.style.display = 'flex';
          setTimeout(() => initializeCropMode(), 50);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  function initializeCropMode() {
    const wrapper = document.getElementById('cropWrapper');
    const workspace = document.querySelector('.crop-workspace');
    const workspaceWidth = workspace.clientWidth;
    const workspaceHeight = workspace.clientHeight;
    
    const imgRatio = originalImage.width / originalImage.height;
    let displayWidth, displayHeight;
    
    if (workspaceWidth / workspaceHeight > imgRatio) {
      displayHeight = workspaceHeight * 0.9;
      displayWidth = displayHeight * imgRatio;
    } else {
      displayWidth = workspaceWidth * 0.9;
      displayHeight = displayWidth / imgRatio;
    }
    
    wrapper.style.width = displayWidth + 'px';
    wrapper.style.height = displayHeight + 'px';
    
    cropImageX = (workspaceWidth - displayWidth) / 2;
    cropImageY = (workspaceHeight - displayHeight) / 2;
    wrapper.style.transform = `translate(${cropImageX}px, ${cropImageY}px)`;
    
    const frame = document.getElementById('cropFrame');
    frameWidth = displayWidth * 0.75;
    frameHeight = frameWidth / NAIL_RATIO;
    
    if (frameHeight > displayHeight) {
      frameHeight = displayHeight * 0.8;
      frameWidth = frameHeight * NAIL_RATIO;
    }
    
    frameX = (displayWidth - frameWidth) / 2;
    frameY = (displayHeight - frameHeight) / 2;
    
    frame.style.width = frameWidth + 'px';
    frame.style.height = frameHeight + 'px';
    frame.style.left = frameX + 'px';
    frame.style.top = frameY + 'px';
    
    setupCropEvents(wrapper, frame);
  }

  function setupCropEvents(wrapper, frame) {
    // Mover marco
    frame.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      const touch = e.touches[0];
      isDraggingFrame = true;
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      frameStartX = frameX;
      frameStartY = frameY;
    });
    
    frame.addEventListener('touchmove', (e) => {
      if (!isDraggingFrame) return;
      e.preventDefault();
      const touch = e.touches[0];
      let newX = frameStartX + touch.clientX - dragStartX;
      let newY = frameStartY + touch.clientY - dragStartY;
      const w = parseFloat(wrapper.style.width);
      const h = parseFloat(wrapper.style.height);
      newX = Math.max(0, Math.min(newX, w - frameWidth));
      newY = Math.max(0, Math.min(newY, h - frameHeight));
      frameX = newX; frameY = newY;
      frame.style.left = newX + 'px';
      frame.style.top = newY + 'px';
    });
    
    frame.addEventListener('touchend', () => isDraggingFrame = false);

    // Mover imagen
    wrapper.addEventListener('touchstart', (e) => {
      if (e.target === frame || frame.contains(e.target)) return;
      const touch = e.touches[0];
      isDraggingImage = true;
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      imageStartX = cropImageX;
      imageStartY = cropImageY;
    });
    
    wrapper.addEventListener('touchmove', (e) => {
      if (!isDraggingImage) return;
      e.preventDefault();
      const touch = e.touches[0];
      cropImageX = imageStartX + touch.clientX - dragStartX;
      cropImageY = imageStartY + touch.clientY - dragStartY;
      wrapper.style.transform = `translate(${cropImageX}px, ${cropImageY}px)`;
    });
    
    wrapper.addEventListener('touchend', () => isDraggingImage = false);
  }

  // Cancelar / Confirmar recorte
  document.getElementById('cancelCrop').addEventListener('click', () => {
    cropMode.style.display = 'none';
    welcomeScreen.style.display = 'flex';
  });

  document.getElementById('confirmCrop').addEventListener('click', () => {
    const wrapper = document.getElementById('cropWrapper');
    const displayWidth = parseFloat(wrapper.style.width);
    const scaleRatio = originalImage.width / displayWidth;
    
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth * scaleRatio;
    canvas.height = frameHeight * scaleRatio;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, 
      frameX * scaleRatio, frameY * scaleRatio, 
      canvas.width, canvas.height, 
      0, 0, canvas.width, canvas.height);
    
    setupWorkMode(canvas);
  });

  function setupWorkMode(croppedCanvas) {
    const imageCanvas = document.getElementById('imageCanvas');
    const guideCanvas = document.getElementById('guideCanvas');
    const workWorkspace = document.getElementById('workWorkspace');
    
    workMode.style.display = 'flex';
    
    setTimeout(() => {
      const containerW = workWorkspace.clientWidth;
      const containerH = workWorkspace.clientHeight;
      
      let canvasW, canvasH;
      if (containerW / containerH > NAIL_RATIO) {
        canvasH = containerH;
        canvasW = canvasH * NAIL_RATIO;
      } else {
        canvasW = containerW;
        canvasH = canvasW / NAIL_RATIO;
      }
      
      imageCanvas.width = guideCanvas.width = canvasW;
      imageCanvas.height = guideCanvas.height = canvasH;
      
      imageCanvas.style.width = canvasW + 'px';
      imageCanvas.style.height = canvasH + 'px';
      guideCanvas.style.width = canvasW + 'px';
      guideCanvas.style.height = canvasH + 'px';
      
      imageCanvas.style.left = ((containerW - canvasW) / 2) + 'px';
      guideCanvas.style.left = ((containerW - canvasW) / 2) + 'px';
      
      const imgCtx = imageCanvas.getContext('2d');
      imgCtx.fillStyle = '#000';
      imgCtx.fillRect(0, 0, canvasW, canvasH);
      
      const scale = Math.min(canvasW / croppedCanvas.width, canvasH / croppedCanvas.height);
      const x = (canvasW - croppedCanvas.width * scale) / 2;
      const y = (canvasH - croppedCanvas.height * scale) / 2;
      
      imgCtx.drawImage(croppedCanvas, 0, 0, croppedCanvas.width, croppedCanvas.height,
        x, y, croppedCanvas.width * scale, croppedCanvas.height * scale);
      
      cropMode.style.display = 'none';
      drawGuides();
    }, 100);
  }

  // Navegación
  document.getElementById('backToWelcome').addEventListener('click', () => {
    if (confirm('¿Reiniciar?')) location.reload();
  });

  document.getElementById('toggleSettings').addEventListener('click', () => {
    panel.classList.toggle('open');
  });
  
  document.getElementById('closeSettings').addEventListener('click', () => {
    panel.classList.remove('open');
  });

  // Controles de círculos
  document.getElementById('decreaseCircles').addEventListener('click', () => {
    if (circleCount > 2) {
      circleCount--;
      document.getElementById('circleCount').textContent = circleCount;
      drawGuides();
    }
  });
  
  document.getElementById('increaseCircles').addEventListener('click', () => {
    if (circleCount < 4) {
      circleCount++;
      document.getElementById('circleCount').textContent = circleCount;
      drawGuides();
    }
  });

  // Mover guías
  const guideCanvas = document.getElementById('guideCanvas');
  
  document.getElementById('moveGuideBtn').addEventListener('click', function() {
    isMovingGuide = !isMovingGuide;
    this.classList.toggle('active');
    this.textContent = isMovingGuide ? '📍 Fijar' : '✋ Mover Guías';
  });

  guideCanvas.addEventListener('touchstart', (e) => {
    if (!isMovingGuide) return;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
  });
  
  guideCanvas.addEventListener('touchmove', (e) => {
    if (!isMovingGuide) return;
    e.preventDefault();
    guideOffsetX += e.touches[0].clientX - lastTouchX;
    guideOffsetY += e.touches[0].clientY - lastTouchY;
    lastTouchX = e.touches[0].clientX;
    lastTouchY = e.touches[0].clientY;
    drawGuides();
  });

  document.getElementById('resetGuidesBtn').addEventListener('click', () => {
    guideOffsetX = 0;
    guideOffsetY = 0;
    drawGuides();
  });

  // Controles de estilo
  ['lineWidth', 'opacity', 'lineColor'].forEach(id => {
    document.getElementById(id).addEventListener('input', (e) => {
      const val = document.getElementById(id + 'Value');
      if (val) val.textContent = e.target.value;
      drawGuides();
    });
  });

  // Dibujar guías
  function drawGuides() {
    const canvas = document.getElementById('guideCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return;
    
    ctx.clearRect(0, 0, w, h);
    
    const color = document.getElementById('lineColor').value;
    const opacity = document.getElementById('opacity').value / 100;
    const lineWidth = parseInt(document.getElementById('lineWidth').value);
    
    const offsetX = guideOffsetX;
    const offsetY = guideOffsetY;
    
    // Calcular tamaño de círculos
    const circleRadius = (h * 0.7) / (circleCount * 1.8);
    const spacing = circleRadius * 2.1;
    const startY = h/2 - (spacing * (circleCount - 1)) / 2;
    const centerX = w/2 + offsetX;
    
    // Bordes de seguridad
    const safeMargin = circleRadius * 1.4;
    const leftSafe = centerX - safeMargin;
    const rightSafe = centerX + safeMargin;
    
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    
    // Línea central vertical
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, h);
    ctx.stroke();
    
    // Bordes de seguridad
    ctx.beginPath();
    ctx.moveTo(leftSafe, 0);
    ctx.lineTo(leftSafe, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightSafe, 0);
    ctx.lineTo(rightSafe, h);
    ctx.stroke();
    
    // Círculos
    ctx.setLineDash([6, 6]);
    for (let i = 0; i < circleCount; i++) {
      const circleY = startY + offsetY + i * spacing;
      ctx.beginPath();
      ctx.ellipse(centerX, circleY, circleRadius, circleRadius, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Diámetros dentro de cada círculo
    ctx.setLineDash([]);
    ctx.lineWidth = lineWidth * 0.8;
    ctx.globalAlpha = opacity * 0.8;
    
    for (let i = 0; i < circleCount; i++) {
      const circleY = startY + offsetY + i * spacing;
      
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(centerX - circleRadius, circleY);
      ctx.lineTo(centerX + circleRadius, circleY);
      ctx.stroke();
      
      // Diagonales que rebotan
      // Diagonal 1 (izquierda)
      ctx.beginPath();
      ctx.moveTo(centerX, circleY);
      ctx.lineTo(leftSafe, circleY - circleRadius);
      ctx.stroke();
      
      // Rebote de Diagonal 1
      if (i > 0) {
        const prevY = startY + offsetY + (i-1) * spacing;
        ctx.beginPath();
        ctx.moveTo(leftSafe, circleY - circleRadius);
        ctx.lineTo(centerX, prevY);
        ctx.stroke();
      }
      
      // Diagonal 2 (derecha)
      ctx.beginPath();
      ctx.moveTo(centerX, circleY);
      ctx.lineTo(rightSafe, circleY - circleRadius);
      ctx.stroke();
      
      // Rebote de Diagonal 2
      if (i > 0) {
        const prevY = startY + offsetY + (i-1) * spacing;
        ctx.beginPath();
        ctx.moveTo(rightSafe, circleY - circleRadius);
        ctx.lineTo(centerX, prevY);
        ctx.stroke();
      }
      
      // Diagonales inferiores
      ctx.beginPath();
      ctx.moveTo(centerX, circleY);
      ctx.lineTo(leftSafe, circleY + circleRadius);
      ctx.stroke();
      
      if (i < circleCount - 1) {
        const nextY = startY + offsetY + (i+1) * spacing;
        ctx.beginPath();
        ctx.moveTo(leftSafe, circleY + circleRadius);
        ctx.lineTo(centerX, nextY);
        ctx.stroke();
      }
      
      ctx.beginPath();
      ctx.moveTo(centerX, circleY);
      ctx.lineTo(rightSafe, circleY + circleRadius);
      ctx.stroke();
      
      if (i < circleCount - 1) {
        const nextY = startY + offsetY + (i+1) * spacing;
        ctx.beginPath();
        ctx.moveTo(rightSafe, circleY + circleRadius);
        ctx.lineTo(centerX, nextY);
        ctx.stroke();
      }
    }
    
    ctx.globalAlpha = 1;
  }

  // Descargar
  document.getElementById('downloadBtn').addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    const imgC = document.getElementById('imageCanvas');
    const guideC = document.getElementById('guideCanvas');
    canvas.width = imgC.width;
    canvas.height = imgC.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgC, 0, 0);
    ctx.drawImage(guideC, 0, 0);
    const a = document.createElement('a');
    a.download = `guia-${Date.now()}.png`;
    a.href = canvas.toDataURL();
    a.click();
  });
});