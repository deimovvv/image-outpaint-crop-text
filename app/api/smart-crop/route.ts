import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { fal } from '@fal-ai/client';

// Configure FAL with API key
fal.config({
  credentials: process.env.FAL_KEY!
});

export const runtime = 'nodejs';

// Global storage for consistent cropping across batch
const batchFocalPoints = new Map<string, {x: number, y: number, score: number, secondary?: {x: number, y: number, score: number}}>;

// Algoritmo especializado para detectar personas (para protect faces mode)
async function detectPersonFocusedFocalPoint(imageBuffer: Buffer, width: number, height: number, sensitivity: number) {
  try {
    console.log('👤 Starting person-focused detection...');

    // Procesar a resolución óptima para detección de personas
    const resized = await sharp(imageBuffer)
      .resize(Math.min(700, width), Math.min(500, height), { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resized;
    const w = info.width;
    const h = info.height;

    let bestScore = 0;
    let bestX = Math.floor(w / 2);
    let bestY = Math.floor(h / 2);

    // Grid más fino para mejor detección de personas
    const stepSize = Math.max(3, Math.floor(Math.min(w, h) / 60));
    const regionSize = Math.max(20, stepSize * 6); // Región más grande para caras

    for (let y = regionSize; y < h - regionSize; y += stepSize) {
      for (let x = regionSize; x < w - regionSize; x += stepSize) {
        const region = extractRegion(data, x - regionSize/2, y - regionSize/2, regionSize, regionSize, w, h);
        if (region.length === 0) continue;

        // Algoritmo híbrido optimizado para personas
        const skinPixels = detectSuperSkinTones(region);
        const faceScore = calculateFaceLikeScore(region, regionSize);
        const contrast = calculateContrast(region);
        const colorConsistency = calculatePersonColorConsistency(region);

        let score = 0;
        const baseSens = sensitivity / 5.0;

        // SCORING ESPECÍFICO PARA PERSONAS
        if (skinPixels > 0.04) { // Umbral alto para piel
          // ALTA CONFIANZA: Mucha piel detectada
          score += skinPixels * 40.0 * baseSens; // Peso muy alto para piel
          score += faceScore * 15.0 * baseSens;  // Bonus por características faciales
          score += contrast * 8.0 * baseSens * 0.7;
          score += colorConsistency * 10.0 * baseSens;

          console.log(`  👤 HIGH SKIN at (${x}, ${y}): ${(skinPixels*100).toFixed(1)}% skin, face: ${faceScore.toFixed(2)}, score: ${score.toFixed(1)}`);
        } else if (skinPixels > 0.02) {
          // MEDIA CONFIANZA: Algo de piel
          score += skinPixels * 25.0 * baseSens;
          score += faceScore * 10.0 * baseSens;
          score += contrast * 8.0 * baseSens * 0.8;
          score += colorConsistency * 6.0 * baseSens;
        } else {
          // BAJA CONFIANZA: Poca o nula piel - score muy bajo
          score += contrast * 3.0 * baseSens;
          score += faceScore * 2.0 * baseSens;
        }

        // Bonus por posición típica de personas (regla de tercios)
        const thirdY = h / 3;
        if (y < thirdY * 2.2 && y > thirdY * 0.3) { // Entre 30% y 220% de la altura
          score *= 1.4;
        }

        // Bonus por zona central-superior (donde suelen estar las caras)
        if (y < h * 0.6) {
          score *= 1.2;
        }

        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }

    // Escalar coordenadas de vuelta al tamaño original
    const scaleX = width / w;
    const scaleY = height / h;

    const finalX = Math.floor(bestX * scaleX);
    const finalY = Math.floor(bestY * scaleY);

    console.log(`Person detection result: (${finalX}, ${finalY}) score: ${bestScore.toFixed(1)}`);

    return {
      x: finalX,
      y: finalY,
      score: bestScore
    };

  } catch (error) {
    console.error('Person-focused detection error:', error);
    return null;
  }
}

// Detección de piel super sensible para personas
function detectSuperSkinTones(region: Array<{r: number, g: number, b: number}>) {
  let skinPixels = 0;

  for (const pixel of region) {
    const { r, g, b } = pixel;
    let isSkin = false;

    // Algoritmo 1: RGB mejorado con múltiples rangos
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15 && (r - b) > 15) {
      isSkin = true;
    }

    // Algoritmo 2: Piel clara
    if (r > 180 && g > 150 && b > 120 && r > g && Math.abs(r - g) < 30) {
      isSkin = true;
    }

    // Algoritmo 3: Piel media
    if (r > 120 && r < 180 && g > 70 && g < 140 && b > 50 && b < 100 && r > g && (r - b) > 20) {
      isSkin = true;
    }

    // Algoritmo 4: Piel oscura
    if (r > 70 && r < 120 && g > 40 && g < 90 && b > 25 && b < 70 && r >= g && (r - b) > 15) {
      isSkin = true;
    }

    // Algoritmo 5: YCbCr (muy confiable)
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (cb >= 75 && cb <= 130 && cr >= 130 && cr <= 180) {
      isSkin = true;
    }

    if (isSkin) skinPixels++;
  }

  return region.length > 0 ? skinPixels / region.length : 0;
}

// Calcular score de características faciales
function calculateFaceLikeScore(region: Array<{r: number, g: number, b: number}>, regionSize: number): number {
  if (region.length === 0) return 0;

  let faceScore = 0;

  // 1. Consistency de color (caras son relativamente uniformes)
  const avgR = region.reduce((sum, p) => sum + p.r, 0) / region.length;
  const avgG = region.reduce((sum, p) => sum + p.g, 0) / region.length;
  const avgB = region.reduce((sum, p) => sum + p.b, 0) / region.length;

  const variance = region.reduce((sum, p) => {
    return sum + Math.pow(p.r - avgR, 2) + Math.pow(p.g - avgG, 2) + Math.pow(p.b - avgB, 2);
  }, 0) / region.length;

  const stdDev = Math.sqrt(variance);

  // Caras tienen varianza moderada (15-45 es ideal)
  if (stdDev >= 15 && stdDev <= 45) {
    faceScore += 1.0;
  } else if (stdDev >= 10 && stdDev <= 60) {
    faceScore += 0.5;
  }

  // 2. Brillo apropiado para caras (80-200)
  const avgBrightness = (avgR + avgG + avgB) / 3;
  if (avgBrightness >= 80 && avgBrightness <= 200) {
    faceScore += 1.0;
  } else if (avgBrightness >= 60 && avgBrightness <= 220) {
    faceScore += 0.5;
  }

  // 3. Relación de canales típica de piel
  if (avgR > avgG && avgG >= avgB && (avgR - avgB) > 10) {
    faceScore += 0.8;
  }

  return faceScore / 2.8; // Normalizar a 0-1
}

// Consistencia de color específica para personas
function calculatePersonColorConsistency(region: Array<{r: number, g: number, b: number}>): number {
  if (region.length === 0) return 0;

  const avgR = region.reduce((sum, p) => sum + p.r, 0) / region.length;
  const avgG = region.reduce((sum, p) => sum + p.g, 0) / region.length;
  const avgB = region.reduce((sum, p) => sum + p.b, 0) / region.length;

  // Las personas tienen colores de piel consistentes
  const rVariance = region.reduce((sum, p) => sum + Math.pow(p.r - avgR, 2), 0) / region.length;
  const gVariance = region.reduce((sum, p) => sum + Math.pow(p.g - avgG, 2), 0) / region.length;
  const bVariance = region.reduce((sum, p) => sum + Math.pow(p.b - avgB, 2), 0) / region.length;

  const avgVariance = (rVariance + gVariance + bVariance) / 3;
  const stdDev = Math.sqrt(avgVariance);

  // Personas tienen consistencia moderada (no demasiado uniforme, no caótica)
  if (stdDev >= 12 && stdDev <= 35) {
    return 1.0;
  } else if (stdDev >= 8 && stdDev <= 50) {
    return 0.6;
  }

  return Math.max(0, 1.0 - (stdDev / 60));
}

// Detección inteligente basada en composición fotográfica y regla de tercios
async function detectSubjectIntelligent(imageBuffer: Buffer, width: number, height: number) {
  try {
    console.log('Using intelligent composition-based subject detection...');

    // Procesar imagen para análisis
    const resized = await sharp(imageBuffer)
      .resize(Math.min(600, width), Math.min(450, height), { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resized;
    const w = info.width;
    const h = info.height;

    console.log(`Analyzing ${w}x${h} image using composition rules`);

    // Puntos de la regla de tercios (donde suelen estar los sujetos importantes)
    const thirdX1 = Math.floor(w / 3);
    const thirdX2 = Math.floor((2 * w) / 3);
    const thirdY1 = Math.floor(h / 3);
    const thirdY2 = Math.floor((2 * h) / 3);

    const candidatePoints = [
      // Puntos de regla de tercios (alta probabilidad de sujetos)
      { x: thirdX1, y: thirdY1, weight: 1.5, name: 'top-left-third' },
      { x: thirdX2, y: thirdY1, weight: 1.5, name: 'top-right-third' },
      { x: thirdX1, y: thirdY2, weight: 1.2, name: 'bottom-left-third' },
      { x: thirdX2, y: thirdY2, weight: 1.2, name: 'bottom-right-third' },

      // Áreas laterales (común en retratos)
      { x: Math.floor(w * 0.2), y: Math.floor(h * 0.4), weight: 1.3, name: 'left-portrait' },
      { x: Math.floor(w * 0.8), y: Math.floor(h * 0.4), weight: 1.3, name: 'right-portrait' },

      // Centro (backup)
      { x: Math.floor(w / 2), y: Math.floor(h / 2), weight: 0.8, name: 'center' },
    ];

    let bestPoint = null;
    let maxScore = 0;

    for (const candidate of candidatePoints) {
      const regionSize = Math.min(60, Math.floor(Math.min(w, h) / 8));
      const region = extractRegion(data,
        candidate.x - regionSize/2,
        candidate.y - regionSize/2,
        regionSize, regionSize, w, h);

      if (region.length === 0) continue;

      // Calcular métricas simples pero efectivas
      const contrast = calculateContrast(region);
      const edgeDensity = calculateEdgeDensity(region, regionSize);
      const colorVariance = calculateColorVariance(region);

      // Calcular brillo promedio
      const brightness = region.reduce((sum, pixel) => sum + (pixel.r + pixel.g + pixel.b) / 3, 0) / region.length;

      // Score basado en características visuales importantes
      let score = 0;

      // Contraste alto indica sujetos definidos
      score += contrast * 20;

      // Densidad de bordes moderada (no demasiado caótica)
      if (edgeDensity > 0.15 && edgeDensity < 0.7) {
        score += edgeDensity * 15;
      }

      // Varianza de color indica detalles/texturas
      score += colorVariance * 10;

      // Preferir rangos de brillo intermedios (evitar muy oscuro/claro)
      if (brightness > 50 && brightness < 200) {
        score += 10;
      }

      // Aplicar peso de composición
      score *= candidate.weight;

      if (score > 20) {
        console.log(`Strong candidate ${candidate.name}: score=${score.toFixed(1)}`);
      };

      if (score > maxScore) {
        maxScore = score;
        bestPoint = {
          x: candidate.x,
          y: candidate.y,
          score,
          name: candidate.name,
          contrast,
          edgeDensity,
          brightness
        };
      }
    }

    if (bestPoint && maxScore > 15) {
      // Escalar coordenadas de vuelta al tamaño original
      const scaleX = width / w;
      const scaleY = height / h;

      const finalX = Math.floor(bestPoint.x * scaleX);
      const finalY = Math.floor(bestPoint.y * scaleY);

      console.log(`Best subject point: ${bestPoint.name} at (${finalX}, ${finalY}) with score ${maxScore.toFixed(1)}`);

      return {
        x: finalX,
        y: finalY,
        score: maxScore,
        detection: 'intelligent',
        region: bestPoint.name
      };
    }

    console.log('No strong subject candidates found, using composition fallback');

    // Fallback inteligente: persona del lado izquierdo
    const fallbackX = Math.floor(width * 0.25); // 25% desde la izquierda
    const fallbackY = Math.floor(height * 0.4);  // 40% desde arriba

    return {
      x: fallbackX,
      y: fallbackY,
      score: 10,
      detection: 'fallback-left'
    };

  } catch (error) {
    console.error('Intelligent subject detection error:', error);
    return null;
  }
}

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
    // Si protectFaces está activado, usar algoritmo especializado para personas
    if (protectFaces) {
      console.log('🔍 PROTECT FACES MODE: Looking for people...');

      // Usar algoritmo más agresivo para detectar personas
      const personFocalPoint = await detectPersonFocusedFocalPoint(imageBuffer, width, height, sensitivity);

      if (personFocalPoint && personFocalPoint.score > 8.0) {
        const result = {
          x: personFocalPoint.x,
          y: personFocalPoint.y,
          score: personFocalPoint.score
        };

        // Almacenar para batch consistency
        if (batchId && !batchFocalPoints.has(batchId)) {
          batchFocalPoints.set(batchId, result);
          console.log(`Stored person-focused focal point for batch ${batchId}`);
        }

        console.log(`👤 PERSON DETECTED: (${result.x}, ${result.y}) score: ${result.score.toFixed(1)}`);
        return result;
      } else {
        console.log('⚠️  No clear person detected, using intelligent fallback...');

        // Fallback: usar detección inteligente
        const subjectDetection = await detectSubjectIntelligent(imageBuffer, width, height);
        if (subjectDetection && subjectDetection.score > 15) {
          const result = {
            x: subjectDetection.x,
            y: subjectDetection.y,
            score: subjectDetection.score
          };

          if (batchId && !batchFocalPoints.has(batchId)) {
            batchFocalPoints.set(batchId, result);
          }

          console.log(`📐 COMPOSITION FALLBACK: (${result.x}, ${result.y}) score: ${result.score.toFixed(1)}`);
          return result;
        }
      }
    }
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
    console.log(`  Settings: sensitivity=${sensitivity}, protectFaces=${protectFaces}, dual=${dualMode}, batchId=${batchId || 'none'}`);

    let bestScore = 0;
    let bestX = Math.floor(w / 2);
    let bestY = Math.floor(h / 2);

    // Grid más fino para mejor detección
    const stepSize = Math.max(2, Math.floor(Math.min(w, h) / 50)); // Grid más fino
    const regionSize = Math.max(12, stepSize * 4); // Región más grande para mejor contexto

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

        // Algoritmo de scoring mejorado y más equilibrado
        let score = 0;
        const baseSensitivity = sensitivity / 5.0;

        // Sistema de scoring optimizado
        const skinWeight = protectFaces ? 25.0 * baseSensitivity : 12.0 * baseSensitivity;
        const contrastWeight = 8.0 * baseSensitivity;
        const edgeWeight = 5.0 * baseSensitivity;
        const varianceWeight = 3.0 * baseSensitivity;

        // Combinar métricas con detección mejorada
        if (skinPixels > 0.03) { // Umbral más alto para evitar falsos positivos
          // PERSONA DETECTADA: scoring muy alto para piel
          score += skinPixels * skinWeight * 2.0; // Doble peso para piel
          score += contrast * contrastWeight * 0.8;
          score += edgeDensity * edgeWeight * 0.6;

          console.log(`  PERSON at (${x}, ${y}): ${(skinPixels*100).toFixed(1)}% skin, score: ${score.toFixed(1)}`);
        } else if (skinPixels > 0.01) {
          // Posible piel pero no muy seguro
          score += skinPixels * skinWeight * 1.2;
          score += contrast * contrastWeight * 0.9;
          score += edgeDensity * edgeWeight * 0.7;
        } else {
          // OBJETO/PRODUCTO: priorizar contraste y bordes
          score += contrast * contrastWeight * 1.4;
          score += edgeDensity * edgeWeight * 1.3;

          // Bonus por alta varianza de color (productos coloridos)
          if (colorVariance > 0.3) {
            score += colorVariance * varianceWeight * 1.5;
          }
        }

        score += colorVariance * varianceWeight;

        // Regla de tercios y composición
        const thirdY = h / 3;
        const centerY = h / 2;

        if (y < thirdY || (y > thirdY && y < thirdY * 2)) {
          score *= 1.3; // Bonus por regla de tercios
        } else if (y > centerY && y < h * 0.75) {
          score *= 1.1; // Menor bonus por zona media-baja
        }

        // Penalización por bordes más suave y progresiva
        const edgeDistance = Math.min(x, w - x, y, h - y);
        const edgeRatio = edgeDistance / Math.min(w, h);
        let edgePenalty = 1.0;

        if (edgeRatio < 0.05) edgePenalty = 0.6; // Muy cerca del borde
        else if (edgeRatio < 0.1) edgePenalty = 0.8; // Cerca del borde
        else if (edgeRatio < 0.15) edgePenalty = 0.95; // Algo cerca del borde

        score *= edgePenalty;

        scanResults.push({x, y, score});

        if (score > bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }

    // Refinamiento de segunda pasada en área del mejor candidato
    if (bestScore > 0) {
      console.log(`Refining around best candidate (${bestX}, ${bestY}) with score ${bestScore.toFixed(2)}`);

      const refineRadius = stepSize * 2;
      const fineStep = Math.max(1, Math.floor(stepSize / 3));

      for (let ry = Math.max(regionSize, bestY - refineRadius);
           ry <= Math.min(h - regionSize, bestY + refineRadius);
           ry += fineStep) {
        for (let rx = Math.max(regionSize, bestX - refineRadius);
             rx <= Math.min(w - regionSize, bestX + refineRadius);
             rx += fineStep) {

          if (rx === bestX && ry === bestY) continue; // Skip already computed point

          const region = extractRegion(data, rx - regionSize/2, ry - regionSize/2, regionSize, regionSize, w, h);
          if (region.length === 0) continue;

          const skinPixels = detectSkinTonesImproved(region);
          const contrast = calculateContrast(region);
          const edgeDensity = calculateEdgeDensity(region, regionSize);
          const colorVariance = calculateColorVariance(region);

          // Usar el mismo algoritmo de scoring
          let score = 0;
          const baseSensitivity = sensitivity / 5.0;
          const skinWeight = protectFaces ? 15.0 * baseSensitivity : 8.0 * baseSensitivity;
          const contrastWeight = 6.0 * baseSensitivity;
          const edgeWeight = 4.0 * baseSensitivity;
          const varianceWeight = 2.5 * baseSensitivity;

          if (skinPixels > 0.01) {
            score += skinPixels * skinWeight;
            score += contrast * contrastWeight * 0.7;
            score += edgeDensity * edgeWeight * 0.5;

            // Bonus adicional por detección de piel en refinement
            score += skinPixels * skinWeight * 0.5;
          } else {
            score += contrast * contrastWeight * 1.2;
            score += edgeDensity * edgeWeight * 1.1;
          }

          score += colorVariance * varianceWeight;

          // Aplicar modificadores de posición
          const thirdY = h / 3;
          const centerY = h / 2;

          if (ry < thirdY || (ry > thirdY && ry < thirdY * 2)) {
            score *= 1.3;
          } else if (ry > centerY && ry < h * 0.75) {
            score *= 1.1;
          }

          const edgeDistance = Math.min(rx, w - rx, ry, h - ry);
          const edgeRatio = edgeDistance / Math.min(w, h);
          let edgePenalty = 1.0;

          if (edgeRatio < 0.05) edgePenalty = 0.6;
          else if (edgeRatio < 0.1) edgePenalty = 0.8;
          else if (edgeRatio < 0.15) edgePenalty = 0.95;

          score *= edgePenalty;

          if (score > bestScore) {
            bestScore = score;
            bestX = rx;
            bestY = ry;
            console.log(`  Refined to (${bestX}, ${bestY}) score: ${bestScore.toFixed(2)}`);
          }
        }
      }
    }

    // Debug: mostrar solo el mejor candidato
    scanResults.sort((a, b) => b.score - a.score);
    if (scanResults.length > 0) {
      const best = scanResults[0];
      console.log(`Best focal point candidate: (${best.x}, ${best.y}) score: ${best.score.toFixed(1)}`);
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

// Algoritmo optimizado para detectar piel de personas
function detectSkinTonesImproved(region: Array<{r: number, g: number, b: number}>) {
  let skinPixels = 0;
  let totalPixels = region.length;

  if (totalPixels === 0) return 0;

  for (const pixel of region) {
    const { r, g, b } = pixel;
    let isSkin = false;

    // Algoritmo combinado más robusto para diferentes tonos de piel
    // Condición 1: Rangos RGB mejorados para piel clara y media
    if (r > 95 && g > 40 && b > 20 &&
        r > g && r > b &&
        (r - g) > 15 && (r - b) > 15 &&
        Math.max(r, g, b) - Math.min(r, g, b) > 15) {
      isSkin = true;
    }

    // Condición 2: HSV para piel en general
    const hsv = rgbToHsv(r, g, b);
    if (hsv.h >= 0 && hsv.h <= 50 && hsv.s >= 0.20 && hsv.s <= 0.68) {
      isSkin = true;
    }

    // Condición 3: YCbCr para detección más precisa
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
      isSkin = true;
    }

    // Condición 4: Para piel más oscura
    if (r > 60 && g > 35 && b > 20 &&
        r > g && r > b &&
        (r - b) > 10 && (r - g) > 5) {
      isSkin = true;
    }

    if (isSkin) {
      skinPixels++;
    }
  }

  const skinRatio = skinPixels / totalPixels;

  // Solo log si hay detección significativa de piel
  if (skinRatio > 0.05) {
    console.log(`  SKIN DETECTED: ${(skinRatio*100).toFixed(1)}% skin pixels`);
  }

  return skinRatio;
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

        // Umbral adaptativo basado en la intensidad promedio
        const avgIntensity = (current.r + current.g + current.b) / 3;
        const threshold = Math.max(15, Math.min(35, avgIntensity * 0.15));

        if (horizontalDiff > threshold || verticalDiff > threshold) {
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
    let useReframe = formData.get('useReframe') === 'true';
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
    console.log(`  Settings: sensitivity=${sensitivity}, protectFaces=${protectFaces}, consistent=${consistentCrop}, dual=${dualFocalPoints}, useReframe=${useReframe}`);

    let result: Buffer;

    // If reframe is enabled, use pure AI reframe (always generates/expands)
    if (useReframe) {
      console.log('🎨 AI REFRAME: Using pure AI reframe - intelligently adjusts aspect ratio while preserving subject');
      console.log(`   Original: ${originalWidth}x${originalHeight} (${(originalWidth/originalHeight).toFixed(2)}:1)`);
      console.log(`   Target: ${ratioWidth}:${ratioHeight} (${(ratioWidth/ratioHeight).toFixed(2)}:1)`);

      try {
        // Upload image to FAL storage
        const imageUrl = await fal.storage.upload(image);
        console.log('📤 Image uploaded for AI reframe:', imageUrl ? imageUrl.substring(0, 50) + '...' : 'No URL');

        // Map ratio to supported aspect ratios
        const aspectRatio = mapToSupportedRatio(ratioWidth, ratioHeight);
        console.log(`📐 Mapped ${ratioWidth}:${ratioHeight} to ${aspectRatio}`);

        // Call FAL AI reframe API
        const reframeResult = await fal.subscribe("fal-ai/image-editing/reframe", {
          input: {
            image_url: imageUrl,
            aspect_ratio: aspectRatio,
            guidance_scale: 3.5,
            num_inference_steps: 30,
            safety_tolerance: "2",
            output_format: "png"
          },
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
              update.logs?.map((log) => log.message).forEach(console.log);
            }
          }
        });

        if (reframeResult.data?.images?.[0]?.url) {
          // Download the reframed image
          const reframedResponse = await fetch(reframeResult.data.images[0].url);
          const reframedBuffer = Buffer.from(await reframedResponse.arrayBuffer());

          // Resize to exact target dimensions if needed
          result = await sharp(reframedBuffer)
            .resize(width, targetHeight, { fit: 'fill' })
            .png()
            .toBuffer();

          console.log('✅ AI Reframe completed successfully - subject preserved with new aspect ratio');
        } else {
          throw new Error('No reframed image returned from API');
        }
      } catch (error) {
        console.error('❌ AI Reframe failed, falling back to traditional cropping:', error);
        // Fall through to traditional cropping logic
        useReframe = false; // This will make it use the traditional logic below
      }
    }

    // Traditional cropping logic (used if reframe is disabled or failed)
    if (!useReframe) {

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
    } // End of traditional cropping logic

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


// Map custom ratios to supported aspect ratios for reframe API
function mapToSupportedRatio(width: number, height: number): string {
  const ratio = width / height;
  const supportedRatios = [
    { ratio: 21/9, label: "21:9" },
    { ratio: 16/9, label: "16:9" },
    { ratio: 4/3, label: "4:3" },
    { ratio: 3/2, label: "3:2" },
    { ratio: 1/1, label: "1:1" },
    { ratio: 2/3, label: "2:3" },
    { ratio: 3/4, label: "3:4" },
    { ratio: 9/16, label: "9:16" },
    { ratio: 9/21, label: "9:21" }
  ];

  // Find the closest supported ratio
  let closestRatio = supportedRatios[0];
  let minDiff = Math.abs(ratio - closestRatio.ratio);

  for (const supported of supportedRatios) {
    const diff = Math.abs(ratio - supported.ratio);
    if (diff < minDiff) {
      minDiff = diff;
      closestRatio = supported;
    }
  }

  return closestRatio.label;
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