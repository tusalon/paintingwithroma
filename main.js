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
  let guideOffsetX = 0, guideOffsetY = 0;
  let isMovingGuide = false;
  let lastTouchX, lastTouchY;
  
  // Variables para el modo recorte
  let cropImageScale = 1;
  let cropImageX = 0, cropImageY = 0;
  let frameX = 0, frameY = 0;
  let frameWidth = 0, frameHeight = 0;
  let isDraggingImage = false;
  let isDraggingFrame = false;
  let isResizing = false;
  let currentHandle = null;
  let dragStartX, dragStartY;
  let frameStartX, frameStartY;
  
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
          
          // Esperar a que la imagen se renderice
          setTimeout(() => {
            initializeCropMode();
          }, 50);
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
    
    // Calcular tamaño para mostrar imagen completa
    const imgRatio = originalImage.width / originalImage.height;
    let displayWidth, displayHeight;
    
    if (workspaceWidth / workspaceHeight > imgRatio) {
      displayHeight = workspaceHeight * 0.9;
      displayWidth = displayHeight * imgRatio;
    } else {
      displayWidth = workspaceWidth * 0.9;
      displayHeight = displayWidth / imgRatio;
    }
    
    cropImageScale = displayWidth / originalImage.width;
    
    // Posicionar wrapper en el centro
    wrapper.style.width = displayWidth + 'px';
    wrapper.style.height = displayHeight + 'px';
    
    cropImageX = (workspaceWidth - displayWidth) / 2;
    cropImageY = (workspaceHeight - displayHeight) / 2;
    
    wrapper.style.transform = `translate(${cropImageX}px, ${cropImageY}px)`;
    
    // Crear marco de recorte 9:16
    const frame = document.getElementById('cropFrame');
    frameWidth = displayWidth * 0.7;
    frameHeight = frameWidth / NAIL_RATIO;
    
    // Asegurar que el marco no sea más grande que la imagen
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
    
    // Configurar eventos táctiles
    setupCropEvents(wrapper, frame, workspace);
  }

  function setupCropEvents(wrapper, frame, workspace) {
    const handles = document.querySelectorAll('.handle');
    
    // Limpiar eventos anteriores
    workspace.removeEventListener('touchstart', handleTouchStart);
    workspace.removeEventListener('touchmove', handleTouchMove);
    workspace.removeEventListener('touchend', handleTouchEnd);
    
    // Mover imagen
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      const target = e.target;
      
      if (target.classList.contains('handle')) {
        // Redimensionar marco
        isResizing = true;
        currentHandle = target;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        frameStartX = frameX;
        frameStartY = frameY;
        const startWidth = frameWidth;
        const startHeight = frameHeight;
        
        const handleMove = (moveEvent) => {
          if (!isResizing) return;
          moveEvent.preventDefault();
          
          const moveTouch = moveEvent.touches[0];
          const dx = moveTouch.clientX - dragStartX;
          const dy = moveTouch.clientY - dragStartY;
          
          let newWidth = startWidth;
          let newHeight = startHeight;
          let newX = frameStartX;
          let newY = frameStartY;
          
          if (currentHandle.classList.contains('br')) {
            newWidth = Math.max(80, startWidth + dx);
            newHeight = newWidth / NAIL_RATIO;
          } else if (currentHandle.classList.contains('bl')) {
            newWidth = Math.max(80, startWidth - dx);
            newHeight = newWidth / NAIL_RATIO;
            newX = frameStartX + (startWidth - newWidth);
          } else if (currentHandle.classList.contains('tr')) {
            newWidth = Math.max(80, startWidth + dx);
            newHeight = newWidth / NAIL_RATIO;
            newY = frameStartY + (startHeight - newHeight);
          } else if (currentHandle.classList.contains('tl')) {
            newWidth = Math.max(80, startWidth - dx);
            newHeight = newWidth / NAIL_RATIO;
            newX = frameStartX + (startWidth - newWidth);
            newY = frameStartY + (startHeight - newHeight);
          }
          
          // Mantener dentro de la imagen
          const wrapperWidth = parseFloat(wrapper.style.width);
          const wrapperHeight = parseFloat(wrapper.style.height);
          
          newX = Math.max(0, Math.min(newX, wrapperWidth - newWidth));
          newY = Math.max(0, Math.min(newY, wrapperHeight - newHeight));
          
          frameWidth = newWidth;
          frameHeight = newHeight;
          frameX = newX;
          frameY = newY;
          
          frame.style.width = newWidth + 'px';
          frame.style.height = newHeight + 'px';
          frame.style.left = newX + 'px';
          frame.style.top = newY + 'px';
        };
        
        const handleEnd = () => {
          isResizing = false;
          currentHandle = null;
          workspace.removeEventListener('touchmove', handleMove);
          workspace.removeEventListener('touchend', handleEnd);
        };
        
        workspace.addEventListener('touchmove', handleMove, { passive: false });
        workspace.addEventListener('touchend', handleEnd);
        
      } else if (target === frame || frame.contains(target)) {
        // Mover marco
        isDraggingFrame = true;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        frameStartX = frameX;
        frameStartY = frameY;
        
        const frameMove = (moveEvent) => {
          if (!isDraggingFrame) return;
          moveEvent.preventDefault();
          
          const moveTouch = moveEvent.touches[0];
          const dx = moveTouch.clientX - dragStartX;
          const dy = moveTouch.clientY - dragStartY;
          
          let newX = frameStartX + dx;
          let newY = frameStartY + dy;
          
          // Mantener dentro de la imagen
          const wrapperWidth = parseFloat(wrapper.style.width);
          const wrapperHeight = parseFloat(wrapper.style.height);
          
          newX = Math.max(0, Math.min(newX, wrapperWidth - frameWidth));
          newY = Math.max(0, Math.min(newY, wrapperHeight - frameHeight));
          
          frameX = newX;
          frameY = newY;
          
          frame.style.left = newX + 'px';
          frame.style.top = newY + 'px';
        };
        
        const frameEnd = () => {
          isDraggingFrame = false;
          workspace.removeEventListener('touchmove', frameMove);
          workspace.removeEventListener('touchend', frameEnd);
        };
        
        workspace.addEventListener('touchmove', frameMove, { passive: false });
        workspace.addEventListener('touchend', frameEnd);
        
      } else {
        // Mover imagen
        isDraggingImage = true;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        const startX = cropImageX;
        const startY = cropImageY;
        
        const imageMove = (moveEvent) => {
          if (!isDraggingImage) return;
          moveEvent.preventDefault();
          
          const moveTouch = moveEvent.touches[0];
          const dx = moveTouch.clientX - dragStartX;
          const dy = moveTouch.clientY - dragStartY;
          
          cropImageX = startX + dx;
          cropImageY = startY + dy;
          
          wrapper.style.transform = `translate(${cropImageX}px, ${cropImageY}px)`;
        };
        
        const imageEnd = () => {
          isDraggingImage = false;
          workspace.removeEventListener('touchmove', imageMove);
          workspace.removeEventListener('touchend', imageEnd);
        };
        
        workspace.addEventListener('touchmove', imageMove, { passive: false });
        workspace.addEventListener('touchend', imageEnd);
      }
    };
    
    workspace.addEventListener('touchstart', handleTouchStart, { passive: false });
  }

  // ===== CANCELAR RECORTE =====
  document.getElementById('cancelCrop')?.addEventListener('click', () => {
    cropMode.style.display = 'none';
    welcomeScreen.style.display = 'flex';
  });

  // ===== CONFIRMAR RECORTE =====
  document.getElementById('confirmCrop')?.addEventListener('click', () => {
    const frame = document.getElementById('cropFrame');
    const wrapper = document.getElementById('cropWrapper');
    
    // Obtener coordenadas relativas
    const frameRect = frame.getBoundingClientRect();
    const imgRect = cropImage.getBoundingClientRect();
    
    // Calcular la escala real de la imagen original vs mostrada
    const displayWidth = parseFloat(wrapper.style.width);
    const scaleRatio = originalImage.width / displayWidth;
    
    // Calcular área de recorte en la imagen original
    const sx = (frameX) * scaleRatio;
    const sy = (frameY) * scaleRatio;
    const sWidth = frameWidth * scaleRatio;
    const sHeight = frameHeight * scaleRatio;
    
    // Crear canvas con el recorte
    const canvas = document.createElement('canvas');
    canvas.width = sWidth;
    canvas.height = sHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImage, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
    
    console.log('Recorte creado:', canvas.width, 'x', canvas.height);
    
    setupWorkMode(canvas);
  });

  function setupWorkMode(croppedCanvas) {
    const imageCanvas = document.getElementById('imageCanvas');
    const guideCanvas = document.getElementById('guideCanvas');
    const workWorkspace = document.getElementById('workWorkspace');
    
    // Forzar un reflow para obtener dimensiones correctas
    workMode.style.display = 'flex';
    
    setTimeout(() => {
      const containerWidth = workWorkspace.clientWidth;
      const containerHeight = workWorkspace.clientHeight;
      
      console.log('Container:', containerWidth, 'x', containerHeight);
      
      let canvasWidth, canvasHeight;
      if (containerWidth / containerHeight > NAIL_RATIO) {
        canvasHeight = containerHeight;
        canvasWidth = canvasHeight * NAIL_RATIO;
      } else {
        canvasWidth = containerWidth;
        canvasHeight = canvasWidth / NAIL_RATIO;
      }
      
      console.log('Canvas:', canvasWidth, 'x', canvasHeight);
      
      imageCanvas.width = guideCanvas.width = canvasWidth;
      imageCanvas.height = guideCanvas.height = canvasHeight;
      
      imageCanvas.style.width = canvasWidth + 'px';
      imageCanvas.style.height = canvasHeight + 'px';
      guideCanvas.style.width = canvasWidth + 'px';
      guideCanvas.style.height = canvasHeight + 'px';
      
      imageCanvas.style.left = ((containerWidth - canvasWidth) / 2) + 'px';
      guideCanvas.style.left = ((containerWidth - canvasWidth) / 2) + 'px';
      imageCanvas.style.top = '0px';
      guideCanvas.style.top = '0px';
      
      const imgCtx = imageCanvas.getContext('2d');
      
      // Fondo negro
      imgCtx.fillStyle = '#000';
      imgCtx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // Dibujar imagen recortada centrada
      const scale = Math.min(canvasWidth / croppedCanvas.width, canvasHeight / croppedCanvas.height);
      const x = (canvasWidth - croppedCanvas.width * scale) / 2;
      const y = (canvasHeight - croppedCanvas.height * scale) / 2;
      
      console.log('Dibujando imagen en:', x, y, scale);
      
      imgCtx.drawImage(
        croppedCanvas, 
        0, 0, croppedCanvas.width, croppedCanvas.height,
        x, y, croppedCanvas.width * scale, croppedCanvas.height * scale
      );
      
      cropMode.style.display = 'none';
      
      // Resetear offset de guías
      guideOffsetX = 0;
      guideOffsetY = 0;
      
      drawProfessionalGuides();
      
      console.log('Modo trabajo activado');
    }, 100);
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
    const touch = e.touches[0];
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
    e.preventDefault();
  });
  
  guideCanvas.addEventListener('touchmove', (e) => {
    if (!isMovingGuide) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    if (!lastTouchX) {
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      return;
    }
    
    guideOffsetX += touch.clientX - lastTouchX;
    guideOffsetY += touch.clientY - lastTouchY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
    
    drawProfessionalGuides();
  });
  
  guideCanvas.addEventListener('touchend', (e) => {
    lastTouchX = null;
    lastTouchY = null;
    e.preventDefault();
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
    
    if (w === 0 || h === 0) {
      console.log('Canvas no tiene dimensiones');
      return;
    }
    
    ctx.clearRect(0, 0, w, h);
    
    const color = document.getElementById('lineColor')?.value || '#ffffff';
    const opacity = parseInt(document.getElementById('opacity')?.value || '50') / 100;
    const lineWidth = parseInt(document.getElementById('lineWidth')?.value || '2');
    const eyeHeightPercent = parseInt(document.getElementById('eyeHeight')?.value || '30') / 100;
    const chinHeightPercent = parseInt(document.getElementById('chinHeight')?.value || '75') / 100;
    
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
    const radialLines = parseInt(document.getElementById('radialLines')?.value || '0');
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
    const circles = parseInt(document.getElementById('circles')?.value || '0');
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
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('input', (e) => {
        const valueEl = document.getElementById(id + 'Value');
        if (valueEl) valueEl.textContent = e.target.value;
        drawProfessionalGuides();
      });
    }
  });

  // ===== DESCARGAR =====
  document.getElementById('downloadBtn')?.addEventListener('click', () => {
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
    link.download = `una-guia-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
});