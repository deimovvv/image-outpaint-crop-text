import { NextRequest, NextResponse } from 'next/server';
import { writePsd, Layer, Psd, BlendMode } from 'ag-psd';
import sharp from 'sharp';

export const runtime = 'nodejs';

interface LayerData {
  name: string;
  imageBuffer: Buffer;
  width: number;
  height: number;
  x: number;
  y: number;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  metadata?: any;
}

interface PSDExportRequest {
  toolType: 'smart-crop' | 'outpaint' | 'text-overlay';
  layers: LayerData[];
  canvasWidth: number;
  canvasHeight: number;
  metadata?: any;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const toolType = formData.get('toolType') as string;
    const canvasWidth = parseInt(formData.get('canvasWidth') as string);
    const canvasHeight = parseInt(formData.get('canvasHeight') as string);
    const metadata = formData.get('metadata') ? JSON.parse(formData.get('metadata') as string) : {};

    if (!toolType || !canvasWidth || !canvasHeight) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const layers: Layer[] = [];
    const layerCount = parseInt(formData.get('layerCount') as string) || 0;

    console.log(`Creating PSD for ${toolType} with ${layerCount} layers`);

    // Procesar cada capa
    for (let i = 0; i < layerCount; i++) {
      const layerName = formData.get(`layer_${i}_name`) as string;
      const layerFile = formData.get(`layer_${i}_image`) as File;
      const layerX = parseInt(formData.get(`layer_${i}_x`) as string) || 0;
      const layerY = parseInt(formData.get(`layer_${i}_y`) as string) || 0;
      const layerOpacity = parseFloat(formData.get(`layer_${i}_opacity`) as string) || 1.0;
      const layerVisible = formData.get(`layer_${i}_visible`) !== 'false';
      const layerBlendMode = (formData.get(`layer_${i}_blendMode`) as BlendMode) || 'normal';

      if (!layerName || !layerFile) {
        console.warn(`Skipping layer ${i}: missing name or image`);
        continue;
      }

      // Convertir imagen a buffer
      const layerBuffer = Buffer.from(await layerFile.arrayBuffer());

      // Obtener metadata de la imagen
      const layerMeta = await sharp(layerBuffer).metadata();
      const layerWidth = layerMeta.width!;
      const layerHeight = layerMeta.height!;

      // Convertir a RGBA para PSD
      const rgbaBuffer = await sharp(layerBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer();

      // Crear capa para PSD
      const layer: Layer = {
        name: layerName,
        left: layerX,
        top: layerY,
        right: layerX + layerWidth,
        bottom: layerY + layerHeight,
        opacity: Math.round(layerOpacity * 255),
        blendMode: layerBlendMode,
        canvas: {
          width: layerWidth,
          height: layerHeight,
          data: new Uint8Array(rgbaBuffer)
        } as any  // ag-psd expects canvas with data property
      };

      layers.push(layer);
      console.log(`Added layer: ${layerName} (${layerWidth}x${layerHeight})`);
    }

    // Crear documento PSD
    const psd: Psd = {
      width: canvasWidth,
      height: canvasHeight,
      children: layers.reverse(), // PSD layers se apilan de abajo hacia arriba
      canvas: createBackgroundCanvas(canvasWidth, canvasHeight)
    };

    // Agregar metadata específico por herramienta
    if (toolType === 'smart-crop' && metadata.focalPoint) {
      // Agregar capa de guía para focal point
      const focalGuide = createFocalPointGuide(
        metadata.focalPoint.x,
        metadata.focalPoint.y,
        canvasWidth,
        canvasHeight
      );
      psd.children!.unshift(focalGuide);
    }

    // Generar PSD
    const psdBuffer = writePsd(psd);

    console.log(`Generated PSD: ${psdBuffer.byteLength} bytes`);

    // Determinar nombre del archivo
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `${toolType}_${timestamp}.psd`;

    return new NextResponse(psdBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': psdBuffer.byteLength.toString()
      }
    });

  } catch (error) {
    console.error('PSD export error:', error);
    return NextResponse.json({
      error: 'Failed to generate PSD',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Crear canvas de fondo transparente
function createBackgroundCanvas(width: number, height: number) {
  const canvas = {
    width,
    height,
    data: new Uint8Array(width * height * 4) // RGBA transparente
  };

  // Llenar con transparente (ya está en 0s por default)
  return canvas as any;
}

// Crear guía visual para focal point (solo para Smart Crop)
function createFocalPointGuide(x: number, y: number, canvasWidth: number, canvasHeight: number): Layer {
  const guideSize = 20;
  const guideCanvas = {
    width: guideSize,
    height: guideSize,
    data: new Uint8Array(guideSize * guideSize * 4)
  };

  // Dibujar cruz roja semi-transparente
  for (let i = 0; i < guideSize; i++) {
    for (let j = 0; j < guideSize; j++) {
      const idx = (i * guideSize + j) * 4;

      // Cruz roja en el centro
      if (i === Math.floor(guideSize/2) || j === Math.floor(guideSize/2)) {
        guideCanvas.data[idx] = 255;     // R
        guideCanvas.data[idx + 1] = 0;   // G
        guideCanvas.data[idx + 2] = 0;   // B
        guideCanvas.data[idx + 3] = 180; // A (semi-transparente)
      }
    }
  }

  return {
    name: '🎯 Focal Point Guide',
    left: x - Math.floor(guideSize/2),
    top: y - Math.floor(guideSize/2),
    right: x + Math.ceil(guideSize/2),
    bottom: y + Math.ceil(guideSize/2),
    opacity: 180,
    visible: true,
    blendMode: 'normal',
    canvas: guideCanvas as any
  };
}