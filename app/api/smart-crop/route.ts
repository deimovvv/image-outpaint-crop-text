import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const runtime = 'nodejs';

// Función para detectar focal points inteligentes
async function detectFocalPoint(imageBuffer: Buffer, width: number, height: number) {
  try {
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

    let scanResults: Array<{x: number, y: number, score: number}> = [];

    for (let y = regionSize; y < h - regionSize; y += stepSize) {
      for (let x = regionSize; x < w - regionSize; x += stepSize) {
        const region = extractRegion(data, x - regionSize/2, y - regionSize/2, regionSize, regionSize, w, h);

        if (region.length === 0) continue;

        // Múltiples métricas de detección
        const skinPixels = detectSkinTonesImproved(region);
        const contrast = calculateContrast(region);
        const edgeDensity = calculateEdgeDensity(region, regionSize);
        const colorVariance = calculateColorVariance(region);

        // Algoritmo de scoring más agresivo
        let score = 0;

        // Priorizar detección de piel con múltiples algoritmos
        score += skinPixels * 10.0;  // Aumentado de 3.0

        // Contraste alto indica rasgos definidos
        score += contrast * 5.0;     // Aumentado de 2.0

        // Edges para bordes y definición
        score += edgeDensity * 3.0;  // Aumentado de 1.5

        // Varianza de color (diversidad indica complexión)
        score += colorVariance * 2.0;

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

    return {
      x: finalX,
      y: finalY,
      score: bestScore
    };
  } catch (error) {
    console.error('Focal point detection error:', error);
    // Fallback al centro
    return {
      x: Math.floor(width / 2),
      y: Math.floor(height / 2),
      score: 0
    };
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const ratio = formData.get('ratio') as string;
    const width = parseInt(formData.get('width') as string) || 1080;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!ratio) {
      return NextResponse.json({ error: 'No ratio provided' }, { status: 400 });
    }

    // Parse ratio (e.g., "16:9" -> [16, 9])
    const [ratioWidth, ratioHeight] = ratio.split(':').map(Number);
    if (!ratioWidth || !ratioHeight) {
      return NextResponse.json({ error: 'Invalid ratio format' }, { status: 400 });
    }

    // Calculate target dimensions
    const targetHeight = Math.round(width * (ratioHeight / ratioWidth));

    // Convert File to Buffer
    const imageBuffer = Buffer.from(await image.arrayBuffer());

    // Get original image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width!;
    const originalHeight = metadata.height!;

    // Detect focal point (person/face)
    const focalPoint = await detectFocalPoint(imageBuffer, originalWidth, originalHeight);
    console.log(`Focal point detected at (${focalPoint.x}, ${focalPoint.y}) with score ${focalPoint.score}`);

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

      // Calcular cropX basado en focal point, pero mantener dentro de bounds
      let cropX = focalPoint.x - Math.round(cropWidth / 2);
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

        // Calcular cropY basado en focal point
        let cropY = focalPoint.y - Math.round(cropHeight / 2);
        cropY = Math.max(0, Math.min(cropY, originalHeight - cropHeight));

        console.log(`Vertical crop: height=${cropHeight}, cropY=${cropY} (focal point influenced)`);

        result = await sharp(imageBuffer)
          .extract({ left: 0, top: cropY, width: originalWidth, height: cropHeight })
          .resize(width, targetHeight, { fit: 'fill' })
          .png()
          .toBuffer();
      }
    }

    return new NextResponse(result, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="smartcrop_${width}x${targetHeight}.png"`
      }
    });

  } catch (error) {
    console.error('Smart crop error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}