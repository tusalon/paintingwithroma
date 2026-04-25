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
  let isDraggingHandle = false;
  let activeHandle = null;
  let dragStartX, dragStartY, frameStartX, frameStartY, imageStartX, imageStartY;
  let handleOppositeX, handleOppositeY;
  let workspaceWidth, workspaceHeight;
  
  const NAIL_RATIO = 9/16;
  const MIN_FRAME_WIDTH = 80;

  // === RAF para drawGuides ===
  let isDrawing = false;

  function requestDraw() {
    if (isDrawing) return;
    isDrawing = true;
    
    requestAnimationFrame(() => {
      drawGuides();
      isDrawing = false;
    });
  }

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
    workspaceWidth = workspace.clientWidth;
    workspaceHeight = workspace.clientHeight;
    
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

  function clampImagePosition() {
    const wrapper = document.getElementById('cropWrapper');
    const displayWidth = parseFloat(wrapper.style.width);
    const displayHeight = parseFloat(wrapper.style.height);
    
    const minX = workspaceWidth - frameX - frameWidth;
    const maxX = -frameX;
    const minY = workspaceHeight - frameY - frameHeight;
    const maxY = -frameY;
    
    if (maxX >= minX) {
      cropImageX = Math.max(minX, Math.min(maxX, cropImageX));
    } else {
      cropImageX = (minX + maxX) / 2;
    }
    
    if (maxY >= minY) {
      cropImageY = Math.max(minY, Math.min(maxY, cropImageY));
    } else {
      cropImageY = (minY + maxY) / 2;
    }
    
    wrapper.style.transform = `translate(${cropImageX}px, ${cropImageY}px)`;
  }

  function updateFrameFromHandle(clientX, clientY) {
    const wrapper = document.getElementById('cropWrapper');
    const frame = document.getElementById('cropFrame');
    const displayWidth = parseFloat(wrapper.style.width);
    const displayHeight = parseFloat(wrapper.style.height);
    
    const wrapperRect = wrapper.getBoundingClientRect();
    const localX = clientX - wrapperRect.left;
    const localY = clientY - wrapperRect.top;
    
    let newWidth, newHeight, newX, newY;
    
    switch (activeHandle) {
      case 'tl':
        newWidth = handleOppositeX - localX;
        newHeight = handleOppositeY - localY;
        newHeight = newWidth / NAIL_RATIO;
        if (newHeight > handleOppositeY) {
          newHeight = handleOppositeY;
          newWidth = newHeight * NAIL_RATIO;
        }
        newX = handleOppositeX - newWidth;
        newY = handleOppositeY - newHeight;
        break;
      case 'tr':
        newWidth = localX - handleOppositeX;
        newHeight = handleOppositeY - localY;
        newHeight = newWidth / NAIL_RATIO;
        if (newHeight > handleOppositeY) {
          newHeight = handleOppositeY;
          newWidth = newHeight * NAIL_RATIO;
        }
        newX = handleOppositeX;
        newY = handleOppositeY - newHeight;
        break;
      case 'bl':
        newWidth = handleOppositeX - localX;
        newHeight = localY - handleOppositeY;
        newHeight = newWidth / NAIL_RATIO;
        if (newHeight > displayHeight - handleOppositeY) {
          newHeight = displayHeight - handleOppositeY;
          newWidth = newHeight * NAIL_RATIO;
        }
        newX = handleOppositeX - newWidth;
        newY = handleOppositeY;
        break;
      case 'br':
        newWidth = localX - handleOppositeX;
        newHeight = localY - handleOppositeY;
        newHeight = newWidth / NAIL_RATIO;
        if (newHeight > displayHeight - handleOppositeY) {
          newHeight = displayHeight - handleOppositeY;
          newWidth = newHeight * NAIL_RATIO;
        }
        newX = handleOppositeX;
        newY = handleOppositeY;
        break;
    }
    
    if (newWidth < MIN_FRAME_WIDTH) {
      newWidth = MIN_FRAME_WIDTH;
      newHeight = newWidth / NAIL_RATIO;
      switch (activeHandle) {
        case 'tl':
          newX = handleOppositeX - newWidth;
          newY = handleOppositeY - newHeight;
          break;
        case 'tr':
          newX = handleOppositeX;
          newY = handleOppositeY - newHeight;
          break;
        case 'bl':
          newX = handleOppositeX - newWidth;
          newY = handleOppositeY;
          break;
        case 'br':
          newX = handleOppositeX;
          newY = handleOppositeY;
          break;
      }
    }
    
    if (newX < 0) {
      newWidth = newWidth + newX;
      newX = 0;
      newHeight = newWidth / NAIL_RATIO;
    }
    if (newY < 0) {
      newHeight = newHeight + newY;
      newY = 0;
      newWidth = newHeight * NAIL_RATIO;
    }
    if (newX + newWidth > displayWidth) {
      newWidth = displayWidth - newX;
      newHeight = newWidth / NAIL_RATIO;
    }
    if (newY + newHeight > displayHeight) {
      newHeight = displayHeight - newY;
      newWidth = newHeight * NAIL_RATIO;
    }
    
    frameWidth = newWidth;
    frameHeight = newHeight;
    frameX = newX;
    frameY = newY;
    
    frame.style.width = frameWidth + 'px';
    frame.style.height = frameHeight + 'px';
    frame.style.left = frameX + 'px';
    frame.style.top = frameY + 'px';
  }

  function setupCropEvents(wrapper, frame) {
    const handles = frame.querySelectorAll('.handle');
    
    handles.forEach(handle => {
      handle.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        e.preventDefault();
        isDraggingHandle = true;
        activeHandle = handle.classList[1];
        const touch = e.touches[0];
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        
        const frameLeft = frameX;
        const frameTop = frameY;
        switch (activeHandle) {
          case 'tl':
            handleOppositeX = frameLeft + frameWidth;
            handleOppositeY = frameTop + frameHeight;
            break;
          case 'tr':
            handleOppositeX = frameLeft;
            handleOppositeY = frameTop + frameHeight;
            break;
          case 'bl':
            handleOppositeX = frameLeft + frameWidth;
            handleOppositeY = frameTop;
            break;
          case 'br':
            handleOppositeX = frameLeft;
            handleOppositeY = frameTop;
            break;
        }
      });
    });
    
    document.addEventListener('touchmove', (e) => {
      if (!isDraggingHandle || !activeHandle) return;
      e.preventDefault();
      updateFrameFromHandle(e.touches[0].clientX, e.touches[0].clientY);
      clampImagePosition();
    }, { passive: false });
    
    document.addEventListener('touchend', () => {
      if (isDraggingHandle) {
        isDraggingHandle = false;
        activeHandle = null;
      }
    });

    frame.addEventListener('touchstart', (e) => {
      if (isDraggingHandle) return;
      e.stopPropagation();
      const touch = e.touches[0];
      isDraggingFrame = true;
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      frameStartX = frameX;
      frameStartY = frameY;
    });
    
    frame.addEventListener('touchmove', (e) => {
      if (!isDraggingFrame || isDraggingHandle) return;
      e.preventDefault();
      const touch = e.touches[0];
      const wrapperDisplayWidth = parseFloat(wrapper.style.width);
      const wrapperDisplayHeight = parseFloat(wrapper.style.height);
      let newX = frameStartX + touch.clientX - dragStartX;
      let newY = frameStartY + touch.clientY - dragStartY;
      newX = Math.max(0, Math.min(newX, wrapperDisplayWidth - frameWidth));
      newY = Math.max(0, Math.min(newY, wrapperDisplayHeight - frameHeight));
      frameX = newX; frameY = newY;
      frame.style.left = newX + 'px';
      frame.style.top = newY + 'px';
    });
    
    frame.addEventListener('touchend', () => {
      isDraggingFrame = false;
    });

    wrapper.addEventListener('touchstart', (e) => {
      if (isDraggingHandle) return;
      if (e.target === frame || frame.contains(e.target)) return;
      const touch = e.touches[0];
      isDraggingImage = true;
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      imageStartX = cropImageX;
      imageStartY = cropImageY;
    });
    
    wrapper.addEventListener('touchmove', (e) => {
      if (!isDraggingImage || isDraggingHandle) return;
      e.preventDefault();
      const touch = e.touches[0];
      cropImageX = imageStartX + touch.clientX - dragStartX;
      cropImageY = imageStartY + touch.clientY - dragStartY;
      clampImagePosition();
    });
    
    wrapper.addEventListener('touchend', () => {
      isDraggingImage = false;
    });
    
    const workspace = document.querySelector('.crop-workspace');
    workspace.addEventListener('touchstart', (e) => {
      if (isDraggingHandle) return;
      if (e.target === wrapper || wrapper.contains(e.target)) return;
      if (e.target === frame || frame.contains(e.target)) return;
      const touch = e.touches[0];
      isDraggingImage = true;
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      imageStartX = cropImageX;
      imageStartY = cropImageY;
    });
    
    workspace.addEventListener('touchmove', (e) => {
      if (!isDraggingImage || isDraggingHandle) return;
      e.preventDefault();
      const touch = e.touches[0];
      cropImageX = imageStartX + touch.clientX - dragStartX;
      cropImageY = imageStartY + touch.clientY - dragStartY;
      clampImagePosition();
    });
    
    workspace.addEventListener('touchend', () => {
      isDraggingImage = false;
    });
  }

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
      
      const imgRatio = croppedCanvas.width / croppedCanvas.height;
      const canvasRatio = canvasW / canvasH;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (imgRatio > canvasRatio) {
        drawHeight = canvasH;
        drawWidth = drawHeight * imgRatio;
        drawX = (canvasW - drawWidth) / 2;
        drawY = 0;
      } else {
        drawWidth = canvasW;
        drawHeight = drawWidth / imgRatio;
        drawX = 0;
        drawY = (canvasH - drawHeight) / 2;
      }
      
      imgCtx.drawImage(croppedCanvas, 0, 0, croppedCanvas.width, croppedCanvas.height,
        drawX, drawY, drawWidth, drawHeight);
      
      cropMode.style.display = 'none';
      requestDraw();
    }, 100);
  }

  document.getElementById('backToWelcome').addEventListener('click', () => {
    if (confirm('¿Reiniciar?')) location.reload();
  });

  document.getElementById('toggleSettings').addEventListener('click', () => {
    panel.classList.toggle('open');
  });
  
  document.getElementById('closeSettings').addEventListener('click', () => {
    panel.classList.remove('open');
  });

  document.getElementById('circleSlider').addEventListener('input', (e) => {
    circleCount = parseInt(e.target.value);
    document.getElementById('circleCount').textContent = circleCount;
    requestDraw();
  });

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
    requestDraw();
  });

  document.getElementById('resetGuidesBtn').addEventListener('click', () => {
    guideOffsetX = 0;
    guideOffsetY = 0;
    requestDraw();
  });

  document.getElementById('lineWidth').addEventListener('input', (e) => {
    document.getElementById('lineWidthValue').textContent = e.target.value;
    requestDraw();
  });
  
  document.getElementById('opacity').addEventListener('input', (e) => {
    document.getElementById('opacityValue').textContent = e.target.value + '%';
    requestDraw();
  });
  
  document.getElementById('lineColor').addEventListener('input', () => {
    requestDraw();
  });

  function drawGuides() {
    const canvas = document.getElementById('guideCanvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return;
    
    ctx.clearRect(0, 0, w, h);
    
    const color = document.getElementById('lineColor').value;
    const opacity = document.getElementById('opacity').value / 100;
    const lineWidthVal = parseInt(document.getElementById('lineWidth').value);
    
    const offsetX = guideOffsetX;
    const offsetY = guideOffsetY;
    
    const centerX = w/2 + offsetX;
    const centerY = h/2 + offsetY;
    
    const usableHeight = h * 0.8;
    const spacing = usableHeight / (circleCount + 1);
    const radius = spacing * 0.45;
    const startY = centerY - ((circleCount - 1) * spacing) / 2;
    
    const sideOffset = w * 0.18;
    const leftX = centerX - sideOffset;
    const rightX = centerX + sideOffset;
    
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = lineWidthVal;
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, h);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(leftX, 0);
    ctx.lineTo(leftX, h);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(rightX, 0);
    ctx.lineTo(rightX, h);
    ctx.stroke();
    
    ctx.setLineDash([6, 6]);
    
    let centers = [];
    
    for (let i = 0; i < circleCount; i++) {
      const y = startY + i * spacing;
      
      centers.push({ x: centerX, y });
      
      ctx.beginPath();
      ctx.arc(centerX, y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
    ctx.lineWidth = lineWidthVal * 0.8;
    ctx.globalAlpha = opacity * 0.9;
    
    for (let i = 0; i < centers.length; i++) {
      
      const c = centers[i];
      
      ctx.beginPath();
      ctx.moveTo(centerX - radius, c.y);
      ctx.lineTo(centerX + radius, c.y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(centerX, c.y);
      ctx.lineTo(leftX, c.y - radius);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(centerX, c.y);
      ctx.lineTo(rightX, c.y - radius);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(centerX, c.y);
      ctx.lineTo(leftX, c.y + radius);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(centerX, c.y);
      ctx.lineTo(rightX, c.y + radius);
      ctx.stroke();
      
      if (i > 0) {
        const prev = centers[i - 1];
        
        ctx.beginPath();
        ctx.moveTo(leftX, c.y - radius);
        ctx.lineTo(centerX, prev.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(rightX, c.y - radius);
        ctx.lineTo(centerX, prev.y);
        ctx.stroke();
      }
      
      if (i < centers.length - 1) {
        const next = centers[i + 1];
        
        ctx.beginPath();
        ctx.moveTo(leftX, c.y + radius);
        ctx.lineTo(centerX, next.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(rightX, c.y + radius);
        ctx.lineTo(centerX, next.y);
        ctx.stroke();
      }
    }
    
    ctx.globalAlpha = 1;
  }

  document.getElementById('downloadBtn').addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    const imgC = document.getElementById('imageCanvas');
    const guideC = document.getElementById('guideCanvas');
    canvas.width = imgC.width;
    canvas.height = imgC.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgC, 0, 0);
    ctx.drawImage(guideC, 0, 0);
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `guia-${Date.now()}.png`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    });
  });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registrado:', reg.scope))
      .catch(err => console.log('Error SW:', err));
  });
}