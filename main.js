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
  let imageStartX, imageStartY;
  
  // Proporción estándar para uñas Ballerina/Acrílicas
  const NAIL_RATIO = 9/16;

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
    
    wrapper.style.width = displayWidth + 'px';
    wrapper.style.height = displayHeight + 'px';
    
    cropImageX = (workspaceWidth - displayWidth) / 2;
    cropImageY = (workspaceHeight - displayHeight) / 2;
    
    wrapper.style.transform = `translate(${cropImageX}px, ${cropImageY}px)`;
    
    // Crear marco de recorte 9:16
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
    
    setupCropEvents(wrapper, frame, workspace);
  }

  function setupCropEvents(wrapper, frame, workspace) {
    const handles = document.querySelectorAll('.handle');
    
    // ===== EVENTOS PARA MOVER EL MARCO (TOUCH) =====
    frame.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      const touch = e.touches[0];
      isDraggingFrame = true;
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      frameStartX = frameX;
      frameStartY = frameY;
    }, { passive: false });
    
    frame.addEventListener('touchmove', (e) => {
      if (!isDraggingFrame) return;
      e.preventDefault();
      e.stopPropagation();
      
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartX;
      const dy = touch.clientY - dragStartY;
      
      let newX = frameStartX + dx;
      let newY = frameStartY + dy;
      
      const wrapperWidth = parseFloat(wrapper.style.width);
      const wrapperHeight = parseFloat(wrapper.style.height);
      
      newX = Math.max(0, Math.min(newX, wrapperWidth - frameWidth));
      newY = Math.max(0, Math.min(newY, wrapperHeight - frameHeight));
      
      frameX = newX;
      frameY = newY;
      
      frame.style.left = newX + 'px';
      frame.style.top = newY + 'px';
    }, { passive: false });
    
    frame.addEventListener('touchend', (e) => {
      isDraggingFrame = false;
    });

    // ===== EVENTOS PARA REDIMENSIONAR (HANDLES) =====
    handles.forEach(handle => {
      handle.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        const touch = e.touches[0];
        isResizing = true;
        currentHandle = handle;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        frameStartX = frameX;
        frameStartY = frameY;
        const startWidth = frameWidth;
        const startHeight = frameHeight;
        
        const handleMove = (moveEvent) => {
          if (!isResizing) return;
          moveEvent.preventDefault();
          moveEvent.stopPropagation();
          
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
          document.removeEventListener('touchmove', handleMove);
          document.removeEventListener('touchend', handleEnd);
        };
        
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);
      });
    });

    // ===== EVENTOS PARA MOVER LA IMAGEN =====
    wrapper.addEventListener('touchstart', (e) => {
      if (e.target === frame || frame.contains(e.target)) return;
      if (e.target.classList.contains('handle')) return;
      
      const touch = e.touches[0];
      isDraggingImage = true;
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      imageStartX = cropImageX;
      imageStartY = cropImageY;
    }, { passive: false });
    
    wrapper.addEventListener('touchmove', (e) => {
      if (!isDraggingImage) return;
      e.preventDefault();
      
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartX;
      const dy = touch.clientY - dragStartY;
      
      cropImageX = imageStartX + dx;
      cropImageY = imageStartY + dy;
      
      wrapper.style.transform = `translate(${cropImageX}px, ${cropImageY}px)`;
    }, { passive: false });
    
    wrapper.addEventListener('touchend', () => {
      isDraggingImage = false;
    });
  }

  // ===== CANCELAR RECORTE =====
  document.getElementById('cancelCrop')?.addEventListener('click', () => {
    cropMode.style.display = 'none';
    welcomeScreen.style.display = 'flex';
  });

  // ===== CONFIRMAR RECORTE =====
  document.getElementById('confirmCrop')?.addEventListener('click', () => {
    const wrapper = document.getElementById('cropWrapper');
    
    const displayWidth = parseFloat(wrapper.style.width);
    const scaleRatio = originalImage.width / displayWidth;
    
    const sx = frameX * scaleRatio;
    const sy = frameY * scaleRatio;
    const sWidth = frameWidth * scaleRatio;
    const sHeight = frameHeight * scaleRatio;
    
    const canvas = document.createElement('canvas');
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
    
    workMode.style.display = 'flex';
    
    setTimeout(() => {
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
      imgCtx.fillStyle = '#000';
      imgCtx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      const scale = Math.min(canvasWidth / croppedCanvas.width, canvasHeight / croppedCanvas.height);
      const x = (canvasWidth - croppedCanvas.width * scale) / 2;
      const y = (canvasHeight - croppedCanvas.height * scale) / 2;
      
      imgCtx.drawImage(
        croppedCanvas, 
        0, 0, croppedCanvas.width, croppedCanvas.height,
        x, y, croppedCanvas.width * scale, croppedCanvas.height * scale
      );
      
      cropMode.style.display = 'none';
      
      guideOffsetX = 0;
      guideOffsetY = 0;
      
      drawCocolorcaStyleGuides();
    }, 100);
  }

  // ===== NAVEGACIÓN =====
  document.getElementById('backToWelcome')?.addEventListener('click', () => {
    if (confirm("¿Reiniciar?")) location.reload();
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
    this.textContent = isMovingGuide ? '📍 Fijar' : '✋ Mover Guías';
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
    
    drawCocolorcaStyleGuides();
  });
  
  guideCanvas.addEventListener('touchend', () => {
    lastTouchX = null;
    lastTouchY = null;
  });

  // ===== RESETEAR POSICIÓN =====
  document.getElementById('resetGuidesBtn')?.addEventListener('click', () => {
    guideOffsetX = 0;
    guideOffsetY = 0;
    drawCocolorcaStyleGuides();
  });

  // ===== GUÍAS ESTILO @cocolorca_nails =====
  function drawCocolorcaStyleGuides() {
    const canvas = document.getElementById('guideCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    if (w === 0 || h === 0) return;
    
    ctx.clearRect(0, 0, w, h);
    
    const color = document.getElementById('lineColor')?.value || '#ffffff';
    const opacity = parseInt(document.getElementById('opacity')?.value || '60') / 100;
    const lineWidth = parseInt(document.getElementById('lineWidth')?.value || '2');
    const eyeHeightPercent = parseInt(document.getElementById('eyeHeight')?.value || '32') / 100;
    const chinHeightPercent = parseInt(document.getElementById('chinHeight')?.value || '72') / 100;
    
    const offsetX = guideOffsetX;
    const offsetY = guideOffsetY;
    
    // Margen curvo (simula la forma de la uña)
    const marginCurve = 0.15;
    const leftMargin = w * marginCurve;
    const rightMargin = w * (1 - marginCurve);
    
    // ===== 1. LÍNEA CENTRAL VERTICAL (PUNTEADA) =====
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 5]);
    ctx.globalAlpha = opacity * 0.7;
    ctx.lineWidth = lineWidth;
    ctx.moveTo(w/2 + offsetX, 0);
    ctx.lineTo(w/2 + offsetX, h);
    ctx.stroke();
    
    // ===== 2. LÍNEA DE OJOS (PUNTEADA) =====
    const eyeY = h * eyeHeightPercent + offsetY;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.setLineDash([8, 6]);
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;
    ctx.moveTo(leftMargin + offsetX, eyeY);
    ctx.lineTo(rightMargin + offsetX, eyeY);
    ctx.stroke();
    
    // ===== 3. LÍNEA DE MENTÓN (PUNTEADA) =====
    const chinY = h * chinHeightPercent + offsetY;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.setLineDash([8, 6]);
    ctx.moveTo(leftMargin + offsetX, chinY);
    ctx.lineTo(rightMargin + offsetX, chinY);
    ctx.stroke();
    
    // ===== 4. ÓVALO CENTRAL (Proporción del rostro) =====
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = opacity * 0.5;
    ctx.lineWidth = lineWidth * 0.8;
    
    const ovalCenterX = w/2 + offsetX;
    const ovalCenterY = (eyeY + chinY) / 2;
    const ovalRadiusX = (rightMargin - leftMargin) * 0.4;
    const ovalRadiusY = (chinY - eyeY) * 0.6;
    
    ctx.ellipse(ovalCenterX, ovalCenterY, ovalRadiusX, ovalRadiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    // ===== 5. CURVAS LATERALES (Forma de la uña) =====
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.setLineDash([]);
    ctx.globalAlpha = opacity * 0.4;
    ctx.lineWidth = lineWidth * 0.6;
    
    // Curva izquierda
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(leftMargin + offsetX, h/2, 0, h);
    ctx.stroke();
    
    // Curva derecha
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.quadraticCurveTo(rightMargin + offsetX, h/2, w, h);
    ctx.stroke();
    
    // ===== 6. CÍRCULOS DE PROPORCIÓN =====
    const circles = parseInt(document.getElementById('circles')?.value || '3');
    if (circles > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.setLineDash([3, 5]);
      ctx.globalAlpha = opacity * 0.35;
      ctx.lineWidth = 1;
      
      const spacing = (h * 0.2) / circles;
      
      for (let i = 1; i <= circles; i++) {
        ctx.moveTo(ovalCenterX + i * spacing, ovalCenterY);
        ctx.ellipse(ovalCenterX, ovalCenterY, i * spacing, i * spacing * 0.7, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    
    // ===== 7. LÍNEAS RADIALES =====
    const radialLines = parseInt(document.getElementById('radialLines')?.value || '6');
    if (radialLines > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.setLineDash([2, 6]);
      ctx.globalAlpha = opacity * 0.25;
      ctx.lineWidth = 0.8;
      
      for (let i = 0; i < radialLines; i++) {
        const angle = (i / radialLines) * Math.PI * 2;
        const radius = ovalRadiusX * 1.8;
        const x2 = ovalCenterX + Math.cos(angle) * radius;
        const y2 = ovalCenterY + Math.sin(angle) * radius * 0.7;
        
        ctx.moveTo(ovalCenterX, ovalCenterY);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    
    // ===== 8. ETIQUETAS (Estilo sutil) =====
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity * 0.8;
    ctx.textAlign = 'center';
    ctx.setLineDash([]);
    
    ctx.fillText('👁', w/2 + offsetX - 15, eyeY - 5);
    ctx.fillText('👁', w/2 + offsetX + 15, eyeY - 5);
    ctx.fillText('💋', w/2 + offsetX, chinY + 15);
    
    // Reset
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
        drawCocolorcaStyleGuides();
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
    link.download = `cocolorca-guia-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
});