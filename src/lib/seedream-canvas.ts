'use client';

export type Gravity = "center" | "left" | "right" | "top" | "bottom";

/**
 * Crea preview limpio (sin blur) para mostrar al usuario
 */
export function buildCleanPreview(
  img: HTMLImageElement,
  targetRatio: number,
  gravity: Gravity = "center",
  finalDimensions: { width: number; height: number }
): string {
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;
  const origRatio = origW / origH;

  // Calcular dimensiones iniciales (antes de aplicar límites)
  let initialW = origW;
  let initialH = origH;

  if (targetRatio > origRatio) {
    initialW = Math.round(origH * targetRatio);
  } else if (targetRatio < origRatio) {
    initialH = Math.round(origW / targetRatio);
  }

  // Calcular escala basada en las dimensiones finales (que ya tienen límites aplicados)
  let scaledOrigW = origW;
  let scaledOrigH = origH;

  // Si las dimensiones finales son diferentes a las iniciales, aplicar escala proporcionalmente
  if (finalDimensions.width !== initialW || finalDimensions.height !== initialH) {
    const scale = Math.min(finalDimensions.width / initialW, finalDimensions.height / initialH);
    scaledOrigW = Math.round(origW * scale);
    scaledOrigH = Math.round(origH * scale);
  }

  // Calcular posición según gravity
  let x = Math.floor((finalDimensions.width - scaledOrigW) / 2);
  let y = Math.floor((finalDimensions.height - scaledOrigH) / 2);

  if (gravity === "left") x = 0;
  if (gravity === "right") x = finalDimensions.width - scaledOrigW;
  if (gravity === "top") y = 0;
  if (gravity === "bottom") y = finalDimensions.height - scaledOrigH;

  // Crear canvas limpio
  const canvas = document.createElement('canvas');
  canvas.width = finalDimensions.width;
  canvas.height = finalDimensions.height;
  const ctx = canvas.getContext('2d')!;

  // Fondo gris claro para mostrar las áreas que se expandirán
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, finalDimensions.width, finalDimensions.height);

  // Pegar imagen original escalada
  ctx.drawImage(img, x, y, scaledOrigW, scaledOrigH);

  // Agregar indicadores visuales de las áreas de expansión
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);

  // Indicar áreas de expansión
  if (x > 0) {
    // Banda izquierda
    ctx.strokeRect(2, y + 2, x - 4, scaledOrigH - 4);
  }
  if (x + scaledOrigW < finalDimensions.width) {
    // Banda derecha
    ctx.strokeRect(x + scaledOrigW + 2, y + 2, finalDimensions.width - (x + scaledOrigW) - 4, scaledOrigH - 4);
  }
  if (y > 0) {
    // Banda superior
    ctx.strokeRect(x + 2, 2, scaledOrigW - 4, y - 4);
  }
  if (y + scaledOrigH < finalDimensions.height) {
    // Banda inferior
    ctx.strokeRect(x + 2, y + scaledOrigH + 2, scaledOrigW - 4, finalDimensions.height - (y + scaledOrigH) - 4);
  }

  ctx.setLineDash([]);

  return canvas.toDataURL('image/png');
}

/**
 * Crea canvas expandido con pre-sembrado inteligente para Seedream
 * - Pega la imagen original según gravity
 * - Pre-siembra las áreas nuevas con edge-pad/reflect para dar contexto
 */
export function buildSeedreamCanvas(
  img: HTMLImageElement,
  targetRatio: number,
  gravity: Gravity = "center"
): {
  canvasDataUrl: string;
  originalImageInfo: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  finalDimensions: {
    width: number;
    height: number;
  };
} {
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;
  const origRatio = origW / origH;

  console.log('🎨 Building Seedream canvas:', {
    original: `${origW}x${origH}`,
    originalRatio: origRatio.toFixed(2),
    targetRatio: targetRatio.toFixed(2),
    gravity
  });

  // Calcular dimensiones finales - mantener lado largo, expandir lado corto
  let finalW = origW;
  let finalH = origH;

  if (targetRatio > origRatio) {
    // Expandir ancho
    finalW = Math.round(origH * targetRatio);
  } else if (targetRatio < origRatio) {
    // Expandir alto
    finalH = Math.round(origW / targetRatio);
  }

  // CRITICAL: Aplicar límites de Seedream (512-4096 por dimensión)
  const MAX_DIM = 1800; // Más conservador para evitar errores 400
  const MIN_DIM = 512;

  // Si alguna dimensión excede el límite, escalar proporcionalmente
  if (finalW > MAX_DIM || finalH > MAX_DIM) {
    const scale = Math.min(MAX_DIM / finalW, MAX_DIM / finalH);
    finalW = Math.round(finalW * scale);
    finalH = Math.round(finalH * scale);

    console.log(`⚠️  Scaling down: ${Math.round(finalW/scale)}x${Math.round(finalH/scale)} → ${finalW}x${finalH}`);
  }

  // Si alguna dimensión es muy pequeña, escalar hacia arriba
  if (finalW < MIN_DIM || finalH < MIN_DIM) {
    const scale = Math.max(MIN_DIM / finalW, MIN_DIM / finalH);
    finalW = Math.round(finalW * scale);
    finalH = Math.round(finalH * scale);

    console.log(`⬆️  Scaling up: ${Math.round(finalW/scale)}x${Math.round(finalH/scale)} → ${finalW}x${finalH}`);
  }

  // Asegurar que las dimensiones sean pares (mejor para AI)
  finalW = Math.floor(finalW / 8) * 8;
  finalH = Math.floor(finalH / 8) * 8;

  // Recalcular el tamaño de la imagen original proporcionalmente si hubo scaling
  let scaledOrigW = origW;
  let scaledOrigH = origH;

  // Si las dimensiones finales son muy diferentes a las calculadas inicialmente,
  // necesitamos escalar la imagen original también
  const originalCalculatedW = targetRatio > origRatio ? Math.round(origH * targetRatio) : origW;
  const originalCalculatedH = targetRatio < origRatio ? Math.round(origW / targetRatio) : origH;

  if (finalW !== originalCalculatedW || finalH !== originalCalculatedH) {
    // Hubo scaling, ajustar imagen original proporcionalmente
    const scale = Math.min(finalW / originalCalculatedW, finalH / originalCalculatedH);
    scaledOrigW = Math.round(origW * scale);
    scaledOrigH = Math.round(origH * scale);

    console.log(`📏 Scaling original image: ${origW}x${origH} → ${scaledOrigW}x${scaledOrigH}`);
  }

  // Calcular posición de la imagen escalada según gravity
  let x = Math.floor((finalW - scaledOrigW) / 2);
  let y = Math.floor((finalH - scaledOrigH) / 2);

  if (gravity === "left") x = 0;
  if (gravity === "right") x = finalW - scaledOrigW;
  if (gravity === "top") y = 0;
  if (gravity === "bottom") y = finalH - scaledOrigH;

  console.log('📐 Canvas layout:', {
    final: `${finalW}x${finalH}`,
    originalPosition: `${x},${y}`,
    expandDirection: getExpandDirection(gravity, targetRatio, origRatio)
  });

  // Crear canvas
  const canvas = document.createElement('canvas');
  canvas.width = finalW;
  canvas.height = finalH;
  const ctx = canvas.getContext('2d')!;

  // EXPERIMENTO: Canvas sin pre-sembrado para que Seedream sea más creativo
  console.log('🧪 Creating minimal canvas without heavy pre-seeding');

  // Fondo neutro muy sutil
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(0, 0, finalW, finalH);

  // Pegar la imagen original escalada
  ctx.drawImage(img, x, y, scaledOrigW, scaledOrigH);

  // Agregar solo una indicación MUY sutil en los bordes para contexto
  if (x > 0 || x + scaledOrigW < finalW || y > 0 || y + scaledOrigH < finalH) {
    // Crear un gradiente muy sutil desde los bordes
    addSubtleEdgeHints(ctx, img, finalW, finalH, x, y, scaledOrigW, scaledOrigH);
  }

  console.log('✅ Canvas ready for Seedream');

  return {
    canvasDataUrl: canvas.toDataURL('image/png'),
    originalImageInfo: { x, y, width: scaledOrigW, height: scaledOrigH },
    finalDimensions: { width: finalW, height: finalH }
  };
}

/**
 * Agrega pistas muy sutiles en los bordes para dar contexto mínimo al modelo
 */
function addSubtleEdgeHints(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  finalW: number,
  finalH: number,
  x: number,
  y: number,
  origW: number,
  origH: number
) {
  console.log('✨ Adding minimal edge hints for Seedream context');

  // Crear canvas temporal para obtener colores promedio de los bordes
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = origW;
  tempCanvas.height = origH;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.drawImage(img, 0, 0);

  // Obtener colores promedio de cada borde
  const imageData = tempCtx.getImageData(0, 0, origW, origH);

  // Color promedio del borde izquierdo
  let leftR = 0, leftG = 0, leftB = 0;
  for (let i = 0; i < origH; i++) {
    const idx = i * origW * 4;
    leftR += imageData.data[idx];
    leftG += imageData.data[idx + 1];
    leftB += imageData.data[idx + 2];
  }
  leftR = Math.floor(leftR / origH);
  leftG = Math.floor(leftG / origH);
  leftB = Math.floor(leftB / origH);

  // Color promedio del borde derecho
  let rightR = 0, rightG = 0, rightB = 0;
  for (let i = 0; i < origH; i++) {
    const idx = (i * origW + (origW - 1)) * 4;
    rightR += imageData.data[idx];
    rightG += imageData.data[idx + 1];
    rightB += imageData.data[idx + 2];
  }
  rightR = Math.floor(rightR / origH);
  rightG = Math.floor(rightG / origH);
  rightB = Math.floor(rightB / origH);

  // Aplicar colores sutiles a las bandas
  ctx.globalAlpha = 0.3; // Muy sutil

  if (x > 0) {
    // Banda izquierda con color promedio del borde izquierdo
    ctx.fillStyle = `rgb(${leftR}, ${leftG}, ${leftB})`;
    ctx.fillRect(0, y, x, origH);
  }

  if (x + origW < finalW) {
    // Banda derecha con color promedio del borde derecho
    ctx.fillStyle = `rgb(${rightR}, ${rightG}, ${rightB})`;
    ctx.fillRect(x + origW, y, finalW - (x + origW), origH);
  }

  ctx.globalAlpha = 1.0; // Restaurar opacidad
}

/**
 * Llena las esquinas con un color promedio o gradiente suave
 */
function fillCorners(
  ctx: CanvasRenderingContext2D,
  finalW: number,
  finalH: number,
  x: number,
  y: number,
  origW: number,
  origH: number
) {
  // Color de relleno - gris medio neutral
  const fillColor = '#888888';

  ctx.fillStyle = fillColor;

  // Esquina superior izquierda
  if (x > 0 && y > 0) {
    ctx.fillRect(0, 0, x, y);
  }

  // Esquina superior derecha
  if (x + origW < finalW && y > 0) {
    ctx.fillRect(x + origW, 0, finalW - (x + origW), y);
  }

  // Esquina inferior izquierda
  if (x > 0 && y + origH < finalH) {
    ctx.fillRect(0, y + origH, x, finalH - (y + origH));
  }

  // Esquina inferior derecha
  if (x + origW < finalW && y + origH < finalH) {
    ctx.fillRect(x + origW, y + origH, finalW - (x + origW), finalH - (y + origH));
  }
}

/**
 * Determina la dirección de expansión para el prompt
 */
function getExpandDirection(gravity: Gravity, targetRatio: number, origRatio: number): string {
  if (Math.abs(targetRatio - origRatio) < 0.01) return "none";

  if (targetRatio > origRatio) {
    // Expandiendo horizontalmente
    switch (gravity) {
      case "left": return "right";
      case "right": return "left";
      case "center": return "left and right";
      default: return "horizontally";
    }
  } else {
    // Expandiendo verticalmente
    switch (gravity) {
      case "top": return "bottom";
      case "bottom": return "top";
      case "center": return "top and bottom";
      default: return "vertically";
    }
  }
}

/**
 * Crea prompt optimizado para Seedream según la dirección de expansión
 */
export function buildSeedreamPrompt(
  gravity: Gravity,
  targetRatio: number,
  origRatio: number,
  customPrompt?: string
): string {
  if (customPrompt && customPrompt.trim()) {
    return customPrompt;
  }

  const direction = getExpandDirection(gravity, targetRatio, origRatio);

  // Prompt más directo y menos restrictivo para mejores resultados
  if (direction === "none") {
    return customPrompt || "enhance the image quality, maintain all details";
  }

  const basePrompt = `Expand the background ${direction} naturally. Continue the existing environment seamlessly. Keep the same lighting, colors and perspective. Do not add new objects or people.`;

  console.log('📝 Generated Seedream prompt:', basePrompt);
  return basePrompt;
}

/**
 * Genera máscara para FLUX Fill - Negro = preservar, Blanco = expandir
 * CRITICAL: Las dimensiones de la máscara deben ser EXACTAMENTE iguales a la imagen base
 */
export function generateFluxMask(
  finalDimensions: { width: number; height: number },
  originalImageInfo: { x: number; y: number; width: number; height: number },
  featherSize: number = 4
): string {
  const canvas = document.createElement('canvas');

  // CRITICAL: Usar exactamente las mismas dimensiones que la imagen base
  canvas.width = finalDimensions.width;
  canvas.height = finalDimensions.height;
  const ctx = canvas.getContext('2d')!;

  console.log('🎭 Creating FLUX mask with dimensions:', {
    maskSize: `${canvas.width}x${canvas.height}`,
    originalArea: `${originalImageInfo.x},${originalImageInfo.y} ${originalImageInfo.width}x${originalImageInfo.height}`,
    featherSize
  });

  // Fondo blanco (áreas a expandir/fill)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Área negra donde está la imagen original (preservar/keep)
  ctx.fillStyle = '#000000';

  // Asegurar que las coordenadas estén dentro de los límites
  const safeX = Math.max(0, Math.min(originalImageInfo.x, canvas.width));
  const safeY = Math.max(0, Math.min(originalImageInfo.y, canvas.height));
  const safeWidth = Math.min(originalImageInfo.width, canvas.width - safeX);
  const safeHeight = Math.min(originalImageInfo.height, canvas.height - safeY);

  ctx.fillRect(safeX, safeY, safeWidth, safeHeight);

  // Aplicar feathering MUY suave para transición natural
  if (featherSize > 0) {
    // Crear un segundo canvas para el blur
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = canvas.width;
    blurCanvas.height = canvas.height;
    const blurCtx = blurCanvas.getContext('2d')!;

    // Copiar la máscara base
    blurCtx.drawImage(canvas, 0, 0);

    // Aplicar blur solo en los bordes
    blurCtx.filter = `blur(${featherSize}px)`;
    blurCtx.globalCompositeOperation = 'source-over';

    // Re-dibujar la máscara con blur
    blurCtx.drawImage(canvas, 0, 0);

    // Copiar el resultado blurred de vuelta al canvas principal
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(blurCanvas, 0, 0);
  }

  console.log('✅ FLUX mask generated successfully:', {
    finalSize: `${canvas.width}x${canvas.height}`,
    preservedArea: `${safeX},${safeY} ${safeWidth}x${safeHeight}`
  });

  return canvas.toDataURL('image/png', 1.0); // Máxima calidad para la máscara
}

/**
 * Genera imagen base limpia para FLUX Fill (sin indicadores visuales)
 * CRITICAL: Imagen base y máscara deben tener exactamente las mismas dimensiones
 */
export function buildFluxBaseImage(
  img: HTMLImageElement,
  targetRatio: number,
  gravity: Gravity = "center"
): {
  baseImageDataUrl: string;
  maskDataUrl: string;
  originalImageInfo: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  finalDimensions: {
    width: number;
    height: number;
  };
} {
  console.log('🎯 Building FLUX base image:', {
    original: `${img.naturalWidth}x${img.naturalHeight}`,
    targetRatio: targetRatio.toFixed(2),
    gravity
  });

  // Usar la misma lógica que Seedream para dimensiones y posición
  const result = buildSeedreamCanvas(img, targetRatio, gravity);

  // CRITICAL: Crear imagen base con dimensiones exactas
  const canvas = document.createElement('canvas');
  canvas.width = result.finalDimensions.width;
  canvas.height = result.finalDimensions.height;
  const ctx = canvas.getContext('2d')!;

  console.log('📐 FLUX canvas dimensions:', {
    canvasSize: `${canvas.width}x${canvas.height}`,
    originalPos: `${result.originalImageInfo.x},${result.originalImageInfo.y}`,
    originalSize: `${result.originalImageInfo.width}x${result.originalImageInfo.height}`
  });

  // Fondo neutro uniforme - más claro para que FLUX tenga mejor contexto
  ctx.fillStyle = '#C0C0C0'; // Gris claro neutral
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Pegar imagen original en posición calculada con anti-aliasing suave
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    result.originalImageInfo.x,
    result.originalImageInfo.y,
    result.originalImageInfo.width,
    result.originalImageInfo.height
  );

  // Generar máscara correspondiente con las MISMAS dimensiones
  const maskDataUrl = generateFluxMask(
    result.finalDimensions,
    result.originalImageInfo,
    4 // Feather más suave para FLUX
  );

  console.log('✅ FLUX base image and mask generated:', {
    baseSize: `${canvas.width}x${canvas.height}`,
    maskGenerated: true
  });

  return {
    baseImageDataUrl: canvas.toDataURL('image/png', 1.0), // Máxima calidad
    maskDataUrl,
    originalImageInfo: result.originalImageInfo,
    finalDimensions: result.finalDimensions
  };
}

/**
 * Recomposición protectora: superpone la imagen original sobre el resultado
 */
export function protectiveRecomposition(
  seedreamResult: HTMLImageElement,
  originalImg: HTMLImageElement,
  originalInfo: { x: number; y: number; width: number; height: number },
  featherSize: number = 16
): string {
  const canvas = document.createElement('canvas');
  canvas.width = seedreamResult.naturalWidth;
  canvas.height = seedreamResult.naturalHeight;
  const ctx = canvas.getContext('2d')!;

  // Dibujar resultado de Seedream como base
  ctx.drawImage(seedreamResult, 0, 0);

  // Crear máscara de feather para mezcla suave
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const maskCtx = maskCanvas.getContext('2d')!;

  // Máscara: blanco en el centro, gradiente hacia los bordes
  const gradient = maskCtx.createRadialGradient(
    originalInfo.x + originalInfo.width / 2,
    originalInfo.y + originalInfo.height / 2,
    Math.min(originalInfo.width, originalInfo.height) / 2 - featherSize,
    originalInfo.x + originalInfo.width / 2,
    originalInfo.y + originalInfo.height / 2,
    Math.min(originalInfo.width, originalInfo.height) / 2
  );
  gradient.addColorStop(0, 'white');
  gradient.addColorStop(1, 'transparent');

  maskCtx.fillStyle = gradient;
  maskCtx.fillRect(0, 0, canvas.width, canvas.height);

  // Aplicar máscara y superponer original
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;
  ctx.drawImage(
    originalImg,
    originalInfo.x,
    originalInfo.y,
    originalInfo.width,
    originalInfo.height
  );

  console.log('🛡️ Protective recomposition applied');

  return canvas.toDataURL('image/png');
}