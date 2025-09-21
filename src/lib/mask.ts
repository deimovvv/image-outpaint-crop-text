export type Gravity = "center" | "left" | "right" | "top" | "bottom";
export type MaskStrategy = "smart" | "conservative" | "aggressive" | "center_only" | "ai_subject";

/** dataURL -> Blob */
export async function dataUrlToBlob(dataUrl: string) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Genera (imageDataUrl, maskDataUrl) a partir de:
 *  - img (HTMLImageElement/ImageBitmap)
 *  - targetRatio (ej 9/16)
 *  - gravity (left/right/top/bottom/center)
 *  - featherPx (blur de borde)
 *
 * Convención máscara: NEGRO = preservar, BLANCO = expandir.
 */
export async function buildOutpaintCanvases(
  img: HTMLImageElement | ImageBitmap,
  targetRatio: number,
  gravity: Gravity = "center",
  featherPx = 8,
  maskStrategy: MaskStrategy = "smart"
): Promise<{ imageDataUrl: string; maskDataUrl: string; subjectMaskDataUrl?: string }> {
  const ow = "width" in img ? (img as HTMLImageElement).width : (img as HTMLImageElement).naturalWidth;
  const oh = "height" in img ? (img as HTMLImageElement).height : (img as HTMLImageElement).naturalHeight;
  const origW = ow, origH = oh;
  const origRatio = origW / origH;

  // Mantener lado largo; expandir lado corto hasta llegar al ratio
  let W = origW, H = origH;
  if (targetRatio > origRatio) W = Math.round(origH * targetRatio); else
  if (targetRatio < origRatio) H = Math.round(origW / targetRatio);

  // Canvas imagen
  const ci = document.createElement("canvas");
  ci.width = W; ci.height = H;
  const ctxI = ci.getContext("2d")!;

  let x = Math.floor((W - origW) / 2);
  let y = Math.floor((H - origH) / 2);
  if (gravity === "left") x = 0;
  if (gravity === "right") x = W - origW;
  if (gravity === "top") y = 0;
  if (gravity === "bottom") y = H - origH;

  ctxI.drawImage(img, x, y, origW, origH);

  // Canvas máscara: estrategias según el tipo seleccionado
  const cm = document.createElement("canvas");
  cm.width = W; cm.height = H;
  const ctxM = cm.getContext("2d")!;

  // Empezar con todo blanco (expandir todo)
  ctxM.fillStyle = "#fff";
  ctxM.fillRect(0, 0, W, H);

  // Aplicar estrategia de máscara según el tipo
  ctxM.fillStyle = "#000";
  let subjectMaskDataUrl: string | undefined;

  if (maskStrategy === "ai_subject") {
    // AI Subject detection - usar TensorFlow.js para detectar personas
    try {
      const { generateSubjectMask, combineSubjectAndExpandMask } = await import('./subject-mask');

      // Generar máscara básica de expansión (preservar toda la imagen original)
      ctxM.fillRect(x, y, origW, origH);

      // Generar máscara de sujeto con AI
      const { subjectMaskDataUrl: aiMaskUrl, maskCanvas: subjectCanvas } =
        await generateSubjectMask(img as HTMLImageElement, W, H);

      // Combinar máscaras
      const { combinedMaskDataUrl } = combineSubjectAndExpandMask(
        subjectCanvas,
        cm,
        W,
        H
      );

      subjectMaskDataUrl = aiMaskUrl;

      // Reemplazar máscara con la combinada
      ctxM.clearRect(0, 0, W, H);
      const combinedImg = new Image();
      await new Promise((resolve) => {
        combinedImg.onload = resolve;
        combinedImg.src = combinedMaskDataUrl;
      });
      ctxM.drawImage(combinedImg, 0, 0);

    } catch (error) {
      console.warn('AI subject detection failed, falling back to smart mask:', error);
      // Fallback a smart mask
      const preserveW = Math.round(origW * 0.6);
      const preserveH = Math.round(origH * 0.6);
      const preserveX = x + Math.round((origW - preserveW) / 2);
      const preserveY = y + Math.round((origH - preserveH) / 2);
      ctxM.fillRect(preserveX, preserveY, preserveW, preserveH);
    }
  } else if (maskStrategy === "conservative") {
    // Conservador: preservar toda el área original
    ctxM.fillRect(x, y, origW, origH);
  } else if (maskStrategy === "aggressive") {
    // Agresivo: preservar solo el 40% central
    const preserveW = Math.round(origW * 0.4);
    const preserveH = Math.round(origH * 0.4);
    const preserveX = x + Math.round((origW - preserveW) / 2);
    const preserveY = y + Math.round((origH - preserveH) / 2);
    ctxM.fillRect(preserveX, preserveY, preserveW, preserveH);
  } else if (maskStrategy === "center_only") {
    // Solo centro: preservar solo el 30% central para máxima expansión
    const preserveW = Math.round(origW * 0.3);
    const preserveH = Math.round(origH * 0.3);
    const preserveX = x + Math.round((origW - preserveW) / 2);
    const preserveY = y + Math.round((origH - preserveH) / 2);
    ctxM.fillRect(preserveX, preserveY, preserveW, preserveH);
  } else {
    // Smart (default): preservar el 60% central donde probablemente esté el sujeto
    const preserveW = Math.round(origW * 0.6);
    const preserveH = Math.round(origH * 0.6);
    const preserveX = x + Math.round((origW - preserveW) / 2);
    const preserveY = y + Math.round((origH - preserveH) / 2);
    ctxM.fillRect(preserveX, preserveY, preserveW, preserveH);
  }

  if (featherPx > 0) {
    const tmp = document.createElement("canvas");
    tmp.width = W; tmp.height = H;
    const tctx = tmp.getContext("2d")!;
    tctx.filter = `blur(${featherPx}px)`;
    tctx.drawImage(cm, 0, 0);
    ctxM.clearRect(0, 0, W, H);
    ctxM.drawImage(tmp, 0, 0);
  }

  return {
    imageDataUrl: ci.toDataURL("image/png"),
    maskDataUrl: cm.toDataURL("image/png"),
    subjectMaskDataUrl,
  };
}