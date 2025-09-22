import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';

// Global storage for consistent cropping across batch
const batchFocalPoints = new Map<string, {x: number, y: number, score: number, secondary?: {x: number, y: number, score: number}}>;

// Generate batch ID from timestamp + random
function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Función para detectar focal points inteligentes (puede ser dual)
async function detectFocalPoint(
  imageBuffer: Buffer,
  width: number,
  height: number,
  sensitivity: number = 5,
  protectFaces: boolean = true,
  dualMode: boolean = false,
  batchId?: string,
  useStoredFocalPoint: boolean = false
): Promise<{x: number, y: number, score: number, secondary?: {x: number, y: number, score: number}}> {
  try {
    // Si es modo batch consistente, usar focal point almacenado
    if (useStoredFocalPoint && batchId && batchFocalPoints.has(batchId)) {
      const stored = batchFocalPoints.get(batchId)!;
      console.log(`Using stored focal point for batch ${batchId}: (${stored.x}, ${stored.y})`);
      return stored;
    }

    // Obtener datos de imagen como array con mayor resolución para mejor detección
    const { data } = await sharp(imageBuffer)
      .resize(Math.min(width, 600), Math.min(height, 400), { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const resized = await sharp(imageBuffer)
      .resize(Math.min(width, 600), Math.min(height, 400), { fit: 'inside' })
      .metadata();

    const w = resized.width!;
    const h = resized.height!;

    console.log(`Analyzing image of size ${w}x${h} for focal points`);

    let bestScore = 0;
    let bestX = Math.floor(w / 2);
    let bestY = Math.floor(h / 2);

    // Grid más fino para mejor detección
    const stepSize = Math.max(4, Math.floor(Math.min(w, h) / 30));
    const regionSize = stepSize * 3;

    const scanResults: Array<{x: number, y: number, score: number}> = [];

    for (let y = regionSize; y < h - regionSize; y += stepSize) {
      for (let x = regionSize; x < w - regionSize; x += stepSize) {
        const region = extractRegion(data, x - regionSize/2, y - regionSize/2, regionSize, regionSize, w, h);

        if (region.length === 0) continue;

        // Múltiples métricas de detección
        const skinPixels = detectSkinTonesImproved(region);
        const contrast = calculateContrast(region);
        const edgeDensity = calculateEdgeDensity(region, regionSize);
        const colorVariance = calculateColorVariance(region);

        // Algoritmo de scoring ajustable por sensibilidad
        let score = 0;
        const baseSensitivity = sensitivity / 5.0; // Normalizar a 1.0

        // Priorizar detección de piel - ajustable por protectFaces
        const skinWeight = protectFaces ? 12.0 * baseSensitivity : 8.0 * baseSensitivity;
        score += skinPixels * skinWeight;

        // Contraste alto indica rasgos definidos
        score += contrast * (5.0 * baseSensitivity);

        // Edges para bordes y definición
        score += edgeDensity * (3.0 * baseSensitivity);

        // Varianza de color (diversidad indica complexión)
        score += colorVariance * (2.0 * baseSensitivity);

        // Bonus por posición vertical favorable (cara típicamente en tercio superior)
        if (y < h * 0.5) {
          score *= 1.4;
        }

        // Menos penalización por bordes para permitir personas en los lados
        const edgeDistance = Math.min(x, w - x, y, h - y);
        const edgePenalty = edgeDistance < stepSize ? 0.7 : 1.0;  // Menos penalización
        score *= edgePenalty;

        scanResults.push({x, y, score});

        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }

    // Debug: mostrar top 3 candidatos
    scanResults.sort((a, b) => b.score - a.score);
    console.log('Top 3 focal point candidates:');
    for (let i = 0; i < Math.min(3, scanResults.length); i++) {
      const candidate = scanResults[i];
      console.log(`  ${i+1}. (${candidate.x}, ${candidate.y}) score: ${candidate.score.toFixed(2)}`);
    }

    // Escalar coordenadas de vuelta al tamaño original
    const scaleX = width / w;
    const scaleY = height / h;

    const finalX = Math.floor(bestX * scaleX);
    const finalY = Math.floor(bestY * scaleY);

    console.log(`Final focal point: (${finalX}, ${finalY}) with score ${bestScore.toFixed(2)}`);

    const result: {x: number, y: number, score: number, secondary?: {x: number, y: number, score: number}} = {
      x: finalX,
      y: finalY,
      score: bestScore
    };

    // Si es modo dual, buscar segundo focal point (producto/objeto)
    if (dualMode) {
      const secondaryFocalPoint = detectSecondaryFocalPoint(data, w, h, finalX, finalY, width, height, sensitivity);
      if (secondaryFocalPoint.score > 1.0) { // Umbral más alto para evitar falsos positivos
        result.secondary = secondaryFocalPoint;
        console.log(`Dual mode: Secondary focal point at (${secondaryFocalPoint.x}, ${secondaryFocalPoint.y}) with score ${secondaryFocalPoint.score.toFixed(2)}`);
      } else {
        console.log(`Dual mode: No strong secondary focal point found (score: ${secondaryFocalPoint.score.toFixed(2)})`);
      }
    }

    // Almacenar para batch consistency
    if (batchId && !batchFocalPoints.has(batchId)) {
      batchFocalPoints.set(batchId, result);
      console.log(`Stored focal point for batch ${batchId}`);
    }

    return result;
  } catch (error) {
    console.error('Focal point detection error:', error);
    // Fallback al centro
    const fallback = {
      x: Math.floor(width / 2),
      y: Math.floor(height / 2),
      score: 0
    };

    // Almacenar fallback para consistency
    if (batchId && !batchFocalPoints.has(batchId)) {
      batchFocalPoints.set(batchId, fallback);
    }

    return fallback;
  }
}

// Extraer región de la imagen
function extractRegion(data: Buffer, x: number, y: number, regionWidth: number, regionHeight: number, imageWidth: number, imageHeight: number) {
  const region = [];
  const channels = 3; // RGB

  for (let ry = 0; ry < regionHeight && (y + ry) < imageHeight; ry++) {
    for (let rx = 0; rx < regionWidth && (x + rx) < imageWidth; rx++) {
      const pixelIndex = ((y + ry) * imageWidth + (x + rx)) * channels;
      if (pixelIndex + 2 < data.length) {
        region.push({
          r: data[pixelIndex],
          g: data[pixelIndex + 1],
          b: data[pixelIndex + 2]
        });
      }
    }
  }

  return region;
}

// Algoritmo mejorado de detección de piel más permisivo
function detectSkinTonesImproved(region: Array<{r: number, g: number, b: number}>) {
  let skinPixels = 0;

  for (const pixel of region) {
    const { r, g, b } = pixel;

    // Múltiples algoritmos de detección de piel con umbrales más permisivos
    let isSkin = false;

    // Algoritmo 1: Rangos RGB expandidos
    if (r > 60 && g > 30 && b > 15 &&  // Umbrales más bajos
        r > g && r > b &&
        Math.max(r, g, b) - Math.min(r, g, b) > 10 &&  // Menos restrictivo
        Math.abs(r - g) > 8) {  // Menos restrictivo
      isSkin = true;
    }

    // Algoritmo 2: HSV con rangos expandidos
    const hsv = rgbToHsv(r, g, b);
    if ((hsv.h >= 0 && hsv.h <= 60) || (hsv.h >= 300 && hsv.h <= 360)) {  // Rango expandido
      if (hsv.s >= 0.15 && hsv.s <= 0.8 && hsv.v >= 0.2) {  // Más permisivo
        isSkin = true;
      }
    }

    // Algoritmo 3: YCbCr más permisivo
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    if (cb >= 70 && cb <= 135 && cr >= 125 && cr <= 180) {  // Rangos expandidos
      isSkin = true;
    }

    // Algoritmo 4: Simple warmth detection (colores cálidos)
    if (r > b && (r + g) > b * 1.5 && r > 80) {
      isSkin = true;
    }

    if (isSkin) skinPixels++;
  }

  return region.length > 0 ? skinPixels / region.length : 0;
}

// Función para backward compatibility
function detectSkinTones(region: Array<{r: number, g: number, b: number}>) {
  let skinPixels = 0;

  for (const pixel of region) {
    const { r, g, b } = pixel;

    // Múltiples algoritmos de detección de piel
    let isSkin = false;

    // Algoritmo 1: Rangos RGB tradicionales
    if (r > 95 && g > 40 && b > 20 &&
        r > g && r > b &&
        Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
        Math.abs(r - g) > 15 && r > g && r > b) {
      isSkin = true;
    }

    // Algoritmo 2: HSV skin detection
    const hsv = rgbToHsv(r, g, b);
    if (hsv.h >= 0 && hsv.h <= 50 && hsv.s >= 0.23 && hsv.s <= 0.68) {
      isSkin = true;
    }

    // Algoritmo 3: YCbCr skin detection
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
      isSkin = true;
    }

    if (isSkin) skinPixels++;
  }

  return region.length > 0 ? skinPixels / region.length : 0;
}

// Convertir RGB a HSV
function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === r) h = ((g - b) / diff) % 6;
    else if (max === g) h = (b - r) / diff + 2;
    else h = (r - g) / diff + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : diff / max;
  const v = max;

  return { h, s, v };
}

// Calcular contraste en una región
function calculateContrast(region: Array<{r: number, g: number, b: number}>) {
  if (region.length === 0) return 0;

  const luminances = region.map(pixel =>
    0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b
  );

  const min = Math.min(...luminances);
  const max = Math.max(...luminances);

  return max > 0 ? (max - min) / max : 0;
}

// Calcular densidad de edges (bordes)
function calculateEdgeDensity(region: Array<{r: number, g: number, b: number}>, width: number) {
  if (region.length < width * 2) return 0;

  let edges = 0;
  const height = Math.floor(region.length / width);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (idx >= region.length) continue;

      const current = region[idx];
      const right = region[idx + 1];
      const bottom = region[(y + 1) * width + x];

      if (right && bottom) {
        const horizontalDiff = Math.abs(current.r - right.r) +
                              Math.abs(current.g - right.g) +
                              Math.abs(current.b - right.b);

        const verticalDiff = Math.abs(current.r - bottom.r) +
                            Math.abs(current.g - bottom.g) +
                            Math.abs(current.b - bottom.b);

        if (horizontalDiff > 20 || verticalDiff > 20) {  // Umbral más bajo
          edges++;
        }
      }
    }
  }

  return edges / region.length;
}

// Calcular varianza de color (diversidad)
function calculateColorVariance(region: Array<{r: number, g: number, b: number}>) {
  if (region.length === 0) return 0;

  // Calcular promedios
  const avgR = region.reduce((sum, p) => sum + p.r, 0) / region.length;
  const avgG = region.reduce((sum, p) => sum + p.g, 0) / region.length;
  const avgB = region.reduce((sum, p) => sum + p.b, 0) / region.length;

  // Calcular varianza
  const variance = region.reduce((sum, p) => {
    const diffR = p.r - avgR;
    const diffG = p.g - avgG;
    const diffB = p.b - avgB;
    return sum + (diffR * diffR + diffG * diffG + diffB * diffB);
  }, 0) / region.length;

  return Math.sqrt(variance) / 255; // Normalizar
}

// Detectar segundo focal point más simple y robusto
function detectSecondaryFocalPoint(
  data: Buffer,
  resizedWidth: number,
  resizedHeight: number,
  primaryX: number,
  primaryY: number,
  originalWidth: number,
  originalHeight: number,
  sensitivity: number
): {x: number, y: number, score: number} {

  const scaleX = resizedWidth / originalWidth;
  const scaleY = resizedHeight / originalHeight;
  const scaledPrimaryX = Math.floor(primaryX * scaleX);
  const scaledPrimaryY = Math.floor(primaryY * scaleY);

  let bestScore = 0;
  let bestX = Math.floor(resizedWidth / 2);
  let bestY = Math.floor(resizedHeight / 2);

  const stepSize = Math.max(6, Math.floor(Math.min(resizedWidth, resizedHeight) / 20));
  const regionSize = stepSize * 3;
  const exclusionRadius = Math.min(resizedWidth, resizedHeight) * 0.2; // 20% del tamaño de imagen

  console.log(`Secondary focal point search: exclusion radius ${exclusionRadius}px around (${scaledPrimaryX}, ${scaledPrimaryY})`);

  for (let y = regionSize; y < resizedHeight - regionSize; y += stepSize) {
    for (let x = regionSize; x < resizedWidth - regionSize; x += stepSize) {
      // Evitar área del focal point primario con radio más grande
      const distanceFromPrimary = Math.sqrt(
        Math.pow(x - scaledPrimaryX, 2) + Math.pow(y - scaledPrimaryY, 2)
      );

      if (distanceFromPrimary < exclusionRadius) {
        continue;
      }

      const region = extractRegion(data, x - regionSize/2, y - regionSize/2, regionSize, regionSize, resizedWidth, resizedHeight);
      if (region.length === 0) continue;

      // Detectar objetos: alta varianza de color + edges, baja detección de piel
      const skinPixels = detectSkinTonesImproved(region);
      const contrast = calculateContrast(region);
      const edgeDensity = calculateEdgeDensity(region, regionSize);
      const colorVariance = calculateColorVariance(region);

      let score = 0;
      const baseSensitivity = sensitivity / 5.0;

      // Algoritmo simplificado para objetos/productos
      if (skinPixels < 0.3) { // Poca piel detectada
        score += contrast * (5.0 * baseSensitivity);
        score += edgeDensity * (4.0 * baseSensitivity);
        score += colorVariance * (3.0 * baseSensitivity);

        // Bonus por estar lejos del centro (objetos suelen estar en laterales)
        const distanceFromCenter = Math.sqrt(
          Math.pow(x - resizedWidth/2, 2) + Math.pow(y - resizedHeight/2, 2)
        );
        const centerDistance = distanceFromCenter / Math.max(resizedWidth, resizedHeight);
        if (centerDistance > 0.2) {
          score *= 1.2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  // Escalar de vuelta al tamaño original
  const finalX = Math.floor(bestX * (originalWidth / resizedWidth));
  const finalY = Math.floor(bestY * (originalHeight / resizedHeight));

  console.log(`Secondary focal point found at (${finalX}, ${finalY}) with score ${bestScore.toFixed(2)}`);

  return {
    x: finalX,
    y: finalY,
    score: bestScore
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const ratio = formData.get('ratio') as string;
    const width = parseInt(formData.get('width') as string) || 1080;
    const height = formData.get('height') ? parseInt(formData.get('height') as string) : undefined;
    const sensitivity = parseInt(formData.get('sensitivity') as string) || 5;
    const protectFaces = formData.get('protectFaces') === 'true';
    const consistentCrop = formData.get('consistentCrop') === 'true';
    const dualFocalPoints = formData.get('dualFocalPoints') === 'true';
    const isFirstImage = formData.get('isFirstImage') === 'true';
    const imageIndex = parseInt(formData.get('imageIndex') as string) || 0;

    // Generate or use batch ID for consistent cropping
    let batchId = request.headers.get('x-batch-id');
    if (!batchId && consistentCrop && isFirstImage) {
      batchId = generateBatchId();
    }

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!ratio) {
      return NextResponse.json({ error: 'No ratio provided' }, { status: 400 });
    }

    let ratioWidth: number, ratioHeight: number, targetHeight: number;

    if (ratio === 'Custom') {
      if (!height) {
        return NextResponse.json({ error: 'Custom ratio requires height parameter' }, { status: 400 });
      }
      ratioWidth = width;
      ratioHeight = height;
      targetHeight = height;
    } else {
      // Parse ratio (e.g., "16:9" -> [16, 9])
      const parts = ratio.split(':').map(Number);
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return NextResponse.json({ error: 'Invalid ratio format' }, { status: 400 });
      }
      [ratioWidth, ratioHeight] = parts;

      // Calculate target dimensions
      targetHeight = Math.round(width * (ratioHeight / ratioWidth));
    }

    // Convert File to Buffer
    const imageBuffer = Buffer.from(await image.arrayBuffer());

    // Get original image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width!;
    const originalHeight = metadata.height!;

    // Detect focal point(s) with user settings
    const useStored = consistentCrop && !isFirstImage && !!batchId;
    const focalPoint = await detectFocalPoint(
      imageBuffer,
      originalWidth,
      originalHeight,
      sensitivity,
      protectFaces,
      dualFocalPoints,
      batchId || undefined,
      useStored
    );

    console.log(`Image ${imageIndex + 1}: Focal point detected at (${focalPoint.x}, ${focalPoint.y}) with score ${focalPoint.score}`);
    if (focalPoint.secondary) {
      console.log(`  Secondary focal point at (${focalPoint.secondary.x}, ${focalPoint.secondary.y}) with score ${focalPoint.secondary.score}`);
    }
    console.log(`  Settings: sensitivity=${sensitivity}, protectFaces=${protectFaces}, consistent=${consistentCrop}, dual=${dualFocalPoints}`);

    let result: Buffer;

    // Check if image needs expansion or just cropping
    const originalRatio = originalWidth / originalHeight;
    const targetRatio = ratioWidth / ratioHeight;

    if (Math.abs(originalRatio - targetRatio) < 0.01) {
      // Ratios are very similar, just resize
      result = await sharp(imageBuffer)
        .resize(width, targetHeight, { fit: 'fill' })
        .png()
        .toBuffer();
    } else if (originalRatio > targetRatio) {
      // Original is wider, crop horizontally - USAR FOCAL POINT
      const cropWidth = Math.round(originalHeight * targetRatio);

      // Calcular cropX basado en focal point(s)
      let cropX;

      if (focalPoint.secondary && dualFocalPoints) {
        // Dual mode: calcular crop que incluya ambos puntos
        const leftMost = Math.min(focalPoint.x, focalPoint.secondary.x);
        const rightMost = Math.max(focalPoint.x, focalPoint.secondary.x);
        const requiredWidth = rightMost - leftMost;

        console.log(`Dual crop: points at ${focalPoint.x} and ${focalPoint.secondary.x}, span: ${requiredWidth}px, crop width: ${cropWidth}px`);

        if (requiredWidth < cropWidth * 0.8) { // Si ambos puntos caben cómodamente
          const centerBetween = (leftMost + rightMost) / 2;
          cropX = centerBetween - Math.round(cropWidth / 2);
        } else {
          // Si están muy separados, priorizar el punto principal
          console.log('Dual points too far apart, prioritizing primary focal point');
          cropX = focalPoint.x - Math.round(cropWidth / 2);
        }
      } else {
        // Single mode: centrar en focal point principal
        cropX = focalPoint.x - Math.round(cropWidth / 2);
      }

      cropX = Math.max(0, Math.min(cropX, originalWidth - cropWidth));

      console.log(`Horizontal crop: width=${cropWidth}, cropX=${cropX} (focal point influenced)`);

      result = await sharp(imageBuffer)
        .extract({ left: cropX, top: 0, width: cropWidth, height: originalHeight })
        .resize(width, targetHeight, { fit: 'fill' })
        .png()
        .toBuffer();
    } else {
      // Original is taller, need to expand or crop vertically
      if (originalWidth < width || originalHeight < targetHeight) {
        // Need expansion - use edge padding with blur, but center on focal point
        const scaleFactor = Math.max(width / originalWidth, targetHeight / originalHeight);
        const scaledWidth = Math.round(originalWidth * scaleFactor);
        const scaledHeight = Math.round(originalHeight * scaleFactor);

        // Create blurred background
        const blurredBg = await sharp(imageBuffer)
          .resize(width, targetHeight, { fit: 'cover' })
          .blur(10)
          .toBuffer();

        // Resize original image
        const scaledImage = await sharp(imageBuffer)
          .resize(scaledWidth, scaledHeight, { fit: 'inside' })
          .toBuffer();

        // Calculate position based on focal point
        const scaledFocalX = (focalPoint.x / originalWidth) * scaledWidth;
        const scaledFocalY = (focalPoint.y / originalHeight) * scaledHeight;

        let left = Math.round((width / 2) - scaledFocalX);
        let top = Math.round((targetHeight / 2) - scaledFocalY);

        // Keep image within bounds
        left = Math.max(Math.min(left, 0), width - scaledWidth);
        top = Math.max(Math.min(top, 0), targetHeight - scaledHeight);

        console.log(`Expansion with focal point: left=${left}, top=${top}`);

        // Composite scaled image on blurred background
        result = await sharp(blurredBg)
          .composite([{
            input: scaledImage,
            left: left,
            top: top
          }])
          .png()
          .toBuffer();
      } else {
        // Can crop vertically - USAR FOCAL POINT
        const cropHeight = Math.round(originalWidth / targetRatio);

        // Calcular cropY basado en focal point(s)
        let cropY;

        if (focalPoint.secondary && dualFocalPoints) {
          // Dual mode: calcular crop vertical
          const topMost = Math.min(focalPoint.y, focalPoint.secondary.y);
          const bottomMost = Math.max(focalPoint.y, focalPoint.secondary.y);
          const requiredHeight = bottomMost - topMost;

          if (requiredHeight < cropHeight * 0.8) { // Si ambos puntos caben cómodamente
            const centerBetween = (topMost + bottomMost) / 2;
            cropY = centerBetween - Math.round(cropHeight / 2);
          } else {
            // Si están muy separados verticalmente, priorizar punto principal
            cropY = focalPoint.y - Math.round(cropHeight / 2);
          }
        } else {
          cropY = focalPoint.y - Math.round(cropHeight / 2);
        }

        cropY = Math.max(0, Math.min(cropY, originalHeight - cropHeight));

        console.log(`Vertical crop: height=${cropHeight}, cropY=${cropY} (focal point influenced)`);

        result = await sharp(imageBuffer)
          .extract({ left: 0, top: cropY, width: originalWidth, height: cropHeight })
          .resize(width, targetHeight, { fit: 'fill' })
          .png()
          .toBuffer();
      }
    }

    const response = new NextResponse(result, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="smartcrop_${width}x${targetHeight}_${ratio.replace(':', 'x')}.png"`
      }
    });

    // Return batch ID for consistent cropping
    if (batchId && isFirstImage) {
      response.headers.set('X-Batch-Id', batchId);
    }

    return response;

  } catch (error) {
    console.error('Smart crop error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

// Cleanup old batch data (call periodically)
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [batchId] of batchFocalPoints.entries()) {
    const timestamp = parseInt(batchId.split('_')[1]);
    if (now - timestamp > maxAge) {
      batchFocalPoints.delete(batchId);
      console.log(`Cleaned up batch ${batchId}`);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes