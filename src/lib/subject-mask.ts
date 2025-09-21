'use client';

// Implementación simple de detección de sujeto sin MediaPipe
// Usa análisis de color y contraste para detectar posibles sujetos
export async function generateSubjectMask(
  imageElement: HTMLImageElement,
  outputWidth: number,
  outputHeight: number
): Promise<{ maskCanvas: HTMLCanvasElement; subjectMaskDataUrl: string }> {
  // Create canvas for processing
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  // Draw image to canvas
  ctx.drawImage(imageElement, 0, 0, outputWidth, outputHeight);

  // Get image data for analysis
  const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
  const data = imageData.data;

  // Create mask canvas
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d')!;
  maskCanvas.width = outputWidth;
  maskCanvas.height = outputHeight;

  // Fill with white (background to be expanded)
  maskCtx.fillStyle = 'white';
  maskCtx.fillRect(0, 0, outputWidth, outputHeight);

  // NUEVA ESTRATEGIA: Detección inteligente basada en análisis de contenido real
  console.log('🔍 Starting intelligent subject detection for', outputWidth, 'x', outputHeight);

  const maskImageData = maskCtx.createImageData(outputWidth, outputHeight);

  // Analizar la imagen para detectar áreas con mayor variación (probables sujetos)
  const edgeMap = new Uint8Array(outputWidth * outputHeight);
  const skinMap = new Uint8Array(outputWidth * outputHeight);

  // Paso 1: Detectar bordes y tonos de piel
  for (let y = 1; y < outputHeight - 1; y++) {
    for (let x = 1; x < outputWidth - 1; x++) {
      const idx = (y * outputWidth + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Detección de bordes (Sobel simplificado)
      const gx = Math.abs(
        data[((y-1) * outputWidth + (x-1)) * 4] - data[((y-1) * outputWidth + (x+1)) * 4] +
        2 * (data[(y * outputWidth + (x-1)) * 4] - data[(y * outputWidth + (x+1)) * 4]) +
        data[((y+1) * outputWidth + (x-1)) * 4] - data[((y+1) * outputWidth + (x+1)) * 4]
      );

      const gy = Math.abs(
        data[((y-1) * outputWidth + (x-1)) * 4] - data[((y+1) * outputWidth + (x-1)) * 4] +
        2 * (data[((y-1) * outputWidth + x) * 4] - data[((y+1) * outputWidth + x) * 4]) +
        data[((y-1) * outputWidth + (x+1)) * 4] - data[((y+1) * outputWidth + (x+1)) * 4]
      );

      const edgeStrength = Math.sqrt(gx * gx + gy * gy);
      edgeMap[y * outputWidth + x] = edgeStrength > 30 ? 255 : 0;

      // Detección de tonos de piel mejorada
      const isSkin = detectSkinTone(r, g, b);
      skinMap[y * outputWidth + x] = isSkin ? 255 : 0;
    }
  }

  // Paso 2: Combinar información para crear máscara inteligente
  let subjectPixels = 0;
  let totalPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % outputWidth;
    const y = Math.floor(pixelIndex / outputWidth);

    totalPixels++;

    // Factores para determinar si es sujeto
    let subjectScore = 0;

    // Factor 1: Sesgo central (personas suelen estar en el centro)
    const centerX = outputWidth / 2;
    const centerY = outputHeight / 2;
    const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
    const centralBias = Math.max(0, 1 - (distanceFromCenter / maxDistance)) * 0.3;

    // Factor 2: Detección de piel
    const hasSkin = skinMap[y * outputWidth + x] > 0 ? 0.4 : 0;

    // Factor 3: Bordes fuertes (contornos de personas)
    const hasEdges = edgeMap[y * outputWidth + x] > 0 ? 0.2 : 0;

    // Factor 4: Análisis de vecindario (si hay muchos píxeles similares cerca, probablemente sea sujeto)
    let neighborhoodScore = 0;
    if (x > 5 && x < outputWidth - 5 && y > 5 && y < outputHeight - 5) {
      let similarNeighbors = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nIdx = ((y + dy) * outputWidth + (x + dx)) * 4;
          const nR = data[nIdx];
          const nG = data[nIdx + 1];
          const nB = data[nIdx + 2];

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const colorDiff = Math.abs(r - nR) + Math.abs(g - nG) + Math.abs(b - nB);
          if (colorDiff < 50) similarNeighbors++;
        }
      }
      neighborhoodScore = Math.min(similarNeighbors / 49, 1) * 0.1;
    }

    subjectScore = centralBias + hasSkin + hasEdges + neighborhoodScore;

    // Threshold más inteligente
    const isSubject = subjectScore > 0.25;

    if (isSubject) {
      // Sujeto detectado - NEGRO (preservar)
      maskImageData.data[i] = 0;
      maskImageData.data[i + 1] = 0;
      maskImageData.data[i + 2] = 0;
      maskImageData.data[i + 3] = 255;
      subjectPixels++;
    } else {
      // Fondo - BLANCO (expandir)
      maskImageData.data[i] = 255;
      maskImageData.data[i + 1] = 255;
      maskImageData.data[i + 2] = 255;
      maskImageData.data[i + 3] = 255;
    }
  }

  console.log(`🎯 Intelligent subject detection complete:
    - Subject pixels (black): ${subjectPixels}
    - Background pixels (white): ${totalPixels - subjectPixels}
    - Subject ratio: ${(subjectPixels / totalPixels * 100).toFixed(1)}%
  `);

  maskCtx.putImageData(maskImageData, 0, 0);

  // Apply feathering/blur to smooth edges
  maskCtx.filter = 'blur(8px)';
  maskCtx.globalCompositeOperation = 'source-over';
  maskCtx.drawImage(maskCanvas, 0, 0);
  maskCtx.filter = 'none';

  const subjectMaskDataUrl = maskCanvas.toDataURL('image/png');

  return {
    maskCanvas,
    subjectMaskDataUrl
  };
}

function detectSkinTone(r: number, g: number, b: number): boolean {
  // Simple skin tone detection using RGB ranges
  // This is a basic heuristic that works reasonably well
  return (
    r > 95 && g > 40 && b > 20 &&
    Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  ) || (
    // Alternative skin tone range
    r > 220 && g > 210 && b > 170 &&
    Math.abs(r - g) <= 15 &&
    r > b && g > b
  );
}

function detectEdges(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  // Simple edge detection using Sobel-like operator
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
    return false;
  }

  const getPixel = (px: number, py: number) => {
    const idx = (py * width + px) * 4;
    // Convert to grayscale
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  };

  // Sobel X kernel
  const gx =
    -1 * getPixel(x - 1, y - 1) + 1 * getPixel(x + 1, y - 1) +
    -2 * getPixel(x - 1, y) + 2 * getPixel(x + 1, y) +
    -1 * getPixel(x - 1, y + 1) + 1 * getPixel(x + 1, y + 1);

  // Sobel Y kernel
  const gy =
    -1 * getPixel(x - 1, y - 1) + -2 * getPixel(x, y - 1) + -1 * getPixel(x + 1, y - 1) +
    1 * getPixel(x - 1, y + 1) + 2 * getPixel(x, y + 1) + 1 * getPixel(x + 1, y + 1);

  const magnitude = Math.sqrt(gx * gx + gy * gy);
  return magnitude > 30; // Threshold for edge detection
}

// Crear máscara final simplificada: todo blanco excepto sujeto en negro
export function makeFinalMask(subjectMaskCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const W = subjectMaskCanvas.width;
  const H = subjectMaskCanvas.height;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d')!;

  // 1) Todo blanco (área editable/expandible)
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // 2) Multiplicar con la máscara de sujeto para que el sujeto quede negro
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(subjectMaskCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  return out;
}

// Dilatar y suavizar máscara para evitar costuras (SIMPLIFICADO)
export function dilateAndFeatherMask(
  maskCanvas: HTMLCanvasElement,
  dilatePixels: number = 12,
  featherPixels: number = 8
): HTMLCanvasElement {
  const W = maskCanvas.width;
  const H = maskCanvas.height;
  const result = document.createElement('canvas');
  result.width = W;
  result.height = H;
  const ctx = result.getContext('2d')!;

  console.log(`🔧 Applying dilate (${dilatePixels}px) and feather (${featherPixels}px)`);

  // Copiar máscara original
  ctx.drawImage(maskCanvas, 0, 0);

  // Aplicar solo suavizado (el dilatado puede estar causando problemas)
  ctx.filter = `blur(${featherPixels}px)`;
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.filter = 'none';

  console.log(`✅ Dilate and feather complete`);
  return result;
}

export function combineSubjectAndExpandMask(
  subjectMaskCanvas: HTMLCanvasElement,
  expandMaskCanvas: HTMLCanvasElement,
  outputWidth: number,
  outputHeight: number
): { combinedMaskDataUrl: string; combinedMaskCanvas: HTMLCanvasElement } {

  console.log(`🔀 Combining masks: ${outputWidth}x${outputHeight}`);

  // Por ahora, simplificamos: solo aplicar ligero suavizado
  const processedSubjectMask = dilateAndFeatherMask(subjectMaskCanvas, 8, 6);

  // Crear máscara final simplificada
  const finalMask = makeFinalMask(processedSubjectMask);

  // DEBUG: Verificar contenido de la máscara final
  const finalCtx = finalMask.getContext('2d')!;
  const finalData = finalCtx.getImageData(0, 0, outputWidth, outputHeight);
  let blackPixels = 0;
  let whitePixels = 0;

  for (let i = 0; i < finalData.data.length; i += 4) {
    const brightness = (finalData.data[i] + finalData.data[i+1] + finalData.data[i+2]) / 3;
    if (brightness < 128) blackPixels++;
    else whitePixels++;
  }

  console.log(`🎭 Final mask composition:
    - Black pixels (preserve): ${blackPixels} (${(blackPixels/(blackPixels+whitePixels)*100).toFixed(1)}%)
    - White pixels (expand): ${whitePixels} (${(whitePixels/(blackPixels+whitePixels)*100).toFixed(1)}%)
  `);

  const combinedMaskDataUrl = finalMask.toDataURL('image/png');

  return {
    combinedMaskDataUrl,
    combinedMaskCanvas: finalMask
  };
}