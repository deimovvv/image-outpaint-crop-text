// Utility functions for PSD export

export interface PSDLayer {
  name: string;
  imageBlob: Blob;
  x: number;
  y: number;
  opacity: number;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
  visible: boolean;
  metadata?: any;
}

export interface PSDExportData {
  toolType: 'smart-crop' | 'outpaint' | 'text-overlay';
  canvasWidth: number;
  canvasHeight: number;
  layers: PSDLayer[];
  metadata?: any;
}

// Smart Crop: Generar capas para PSD
export async function generateSmartCropPSD(
  originalImage: string, // URL de imagen original
  croppedImage: string,  // URL de imagen cropped
  cropData: {x: number, y: number, width: number, height: number},
  focalPoint: {x: number, y: number},
  finalWidth: number,
  finalHeight: number
): Promise<PSDExportData> {

  const layers: PSDLayer[] = [];

  // Layer 1: Imagen original completa (oculta por defecto)
  const originalBlob = await urlToBlob(originalImage);
  layers.push({
    name: 'Original Image',
    imageBlob: originalBlob,
    x: 0,
    y: 0,
    opacity: 1.0,
    blendMode: 'normal',
    visible: false, // Oculta por defecto
    metadata: { type: 'original', focalPoint }
  });

  // Layer 2: Imagen cropped (visible)
  const croppedBlob = await urlToBlob(croppedImage);
  layers.push({
    name: 'Smart Crop Result',
    imageBlob: croppedBlob,
    x: 0,
    y: 0,
    opacity: 1.0,
    blendMode: 'normal',
    visible: true,
    metadata: { type: 'cropped', cropData, focalPoint }
  });

  // Layer 3: Máscara de crop (para visualizar área seleccionada)
  const maskBlob = await generateCropMask(cropData, finalWidth, finalHeight);
  layers.push({
    name: 'Crop Mask (Guide)',
    imageBlob: maskBlob,
    x: 0,
    y: 0,
    opacity: 0.3,
    blendMode: 'overlay',
    visible: false, // Oculta por defecto
    metadata: { type: 'mask', cropData }
  });

  return {
    toolType: 'smart-crop',
    canvasWidth: finalWidth,
    canvasHeight: finalHeight,
    layers,
    metadata: {
      focalPoint,
      cropData,
      algorithm: 'smart-crop-v1'
    }
  };
}

// Outpaint: Generar capas para PSD
export async function generateOutpaintPSD(
  originalImage: string,
  expandedImage: string,
  canvasWidth: number,
  canvasHeight: number,
  originalPosition: {x: number, y: number, width: number, height: number}
): Promise<PSDExportData> {

  const layers: PSDLayer[] = [];

  // Layer 1: Resultado completo del AI
  const expandedBlob = await urlToBlob(expandedImage);
  layers.push({
    name: 'AI Expanded Result',
    imageBlob: expandedBlob,
    x: 0,
    y: 0,
    opacity: 1.0,
    blendMode: 'normal',
    visible: true,
    metadata: { type: 'expanded' }
  });

  // Layer 2: Imagen original (para comparación)
  const originalBlob = await urlToBlob(originalImage);
  layers.push({
    name: 'Original Image',
    imageBlob: originalBlob,
    x: originalPosition.x,
    y: originalPosition.y,
    opacity: 1.0,
    blendMode: 'normal',
    visible: false, // Oculta por defecto
    metadata: { type: 'original', position: originalPosition }
  });

  // Layer 3: Máscara de área expandida (guía visual)
  const maskBlob = await generateExpansionMask(originalPosition, canvasWidth, canvasHeight);
  layers.push({
    name: 'Expansion Mask (Guide)',
    imageBlob: maskBlob,
    x: 0,
    y: 0,
    opacity: 0.2,
    blendMode: 'multiply',
    visible: false,
    metadata: { type: 'expansion-mask' }
  });

  return {
    toolType: 'outpaint',
    canvasWidth,
    canvasHeight,
    layers,
    metadata: {
      originalPosition,
      expansionAreas: calculateExpansionAreas(originalPosition, canvasWidth, canvasHeight)
    }
  };
}

// Text Overlay: Generar capas para PSD
export async function generateTextOverlayPSD(
  baseImage: string,
  resultImage: string,
  textElements: Array<{
    text: string,
    x: number,
    y: number,
    fontSize: number,
    fontFamily: string,
    color: string,
    type: 'main' | 'subtitle' | 'cta'
  }>,
  canvasWidth: number,
  canvasHeight: number
): Promise<PSDExportData> {

  const layers: PSDLayer[] = [];

  // Layer 1: Imagen base
  const baseBlob = await urlToBlob(baseImage);
  layers.push({
    name: 'Base Image',
    imageBlob: baseBlob,
    x: 0,
    y: 0,
    opacity: 1.0,
    blendMode: 'normal',
    visible: true,
    metadata: { type: 'base' }
  });

  // Layers 2-N: Cada elemento de texto como capa separada
  for (let i = 0; i < textElements.length; i++) {
    const element = textElements[i];
    const textBlob = await generateTextLayer(element, canvasWidth, canvasHeight);

    layers.push({
      name: `${element.type.toUpperCase()}: ${element.text.substring(0, 20)}...`,
      imageBlob: textBlob,
      x: 0,
      y: 0,
      opacity: 1.0,
      blendMode: 'normal',
      visible: true,
      metadata: {
        type: 'text',
        textData: element
      }
    });
  }

  return {
    toolType: 'text-overlay',
    canvasWidth,
    canvasHeight,
    layers,
    metadata: {
      textElements,
      totalLayers: layers.length
    }
  };
}

// Función para exportar PSD al servidor
export async function exportToPSD(psdData: PSDExportData): Promise<Blob> {
  const formData = new FormData();

  formData.append('toolType', psdData.toolType);
  formData.append('canvasWidth', psdData.canvasWidth.toString());
  formData.append('canvasHeight', psdData.canvasHeight.toString());
  formData.append('layerCount', psdData.layers.length.toString());
  formData.append('metadata', JSON.stringify(psdData.metadata || {}));

  // Agregar cada capa
  psdData.layers.forEach((layer, index) => {
    formData.append(`layer_${index}_name`, layer.name);
    formData.append(`layer_${index}_image`, layer.imageBlob, `layer_${index}.png`);
    formData.append(`layer_${index}_x`, layer.x.toString());
    formData.append(`layer_${index}_y`, layer.y.toString());
    formData.append(`layer_${index}_opacity`, layer.opacity.toString());
    formData.append(`layer_${index}_blendMode`, layer.blendMode);
    formData.append(`layer_${index}_visible`, layer.visible.toString());
  });

  const response = await fetch('/api/export-psd', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`PSD export failed: ${error.error}`);
  }

  return response.blob();
}

// Helper functions

async function urlToBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  return response.blob();
}

async function generateCropMask(
  cropData: {x: number, y: number, width: number, height: number},
  canvasWidth: number,
  canvasHeight: number
): Promise<Blob> {

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  // Fondo semi-transparente negro
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Área de crop transparente
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(cropData.x, cropData.y, cropData.width, cropData.height);

  // Borde del crop
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 2;
  ctx.strokeRect(cropData.x, cropData.y, cropData.width, cropData.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

async function generateExpansionMask(
  originalPos: {x: number, y: number, width: number, height: number},
  canvasWidth: number,
  canvasHeight: number
): Promise<Blob> {

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  // Área expandida en azul semi-transparente
  ctx.fillStyle = 'rgba(0,150,255,0.2)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Área original transparente
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(originalPos.x, originalPos.y, originalPos.width, originalPos.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

async function generateTextLayer(
  element: {text: string, x: number, y: number, fontSize: number, fontFamily: string, color: string},
  canvasWidth: number,
  canvasHeight: number
): Promise<Blob> {

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.font = `${element.fontSize}px ${element.fontFamily}`;
  ctx.fillStyle = element.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Text with shadow for better visibility
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillText(element.text, element.x, element.y);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

function calculateExpansionAreas(
  originalPos: {x: number, y: number, width: number, height: number},
  canvasWidth: number,
  canvasHeight: number
) {
  return {
    top: originalPos.y > 0,
    bottom: originalPos.y + originalPos.height < canvasHeight,
    left: originalPos.x > 0,
    right: originalPos.x + originalPos.width < canvasWidth
  };
}