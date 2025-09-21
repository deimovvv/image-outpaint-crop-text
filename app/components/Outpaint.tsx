"use client";

import { useState, useEffect } from "react";
import { buildSeedreamCanvas, buildCleanPreview, protectiveRecomposition, buildFluxBaseImage } from "@/lib/seedream-canvas";
import { generateAutoPrompt, getSuggestedPrompts, PRESET_PROMPTS } from "@/lib/auto-prompts";
import { dataUrlToBlob, Gravity, MaskStrategy } from "@/lib/mask";

const RATIOS = [
  { label: "1:1", value: 1/1 },
  { label: "4:5", value: 4/5 },
  { label: "3:4", value: 3/4 },
  { label: "9:16", value: 9/16 },
  { label: "16:9", value: 16/9 },
];

interface OutpaintProps {
  onResults: (results: string[]) => void;
  onProcessingChange: (isProcessing: boolean) => void;
}

export default function Outpaint({ onResults, onProcessingChange }: OutpaintProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imgElements, setImgElements] = useState<HTMLImageElement[]>([]);
  const [ratio, setRatio] = useState(RATIOS[4].value); // Default 16:9
  const [gravity, setGravity] = useState<Gravity>("center");
  const [maskStrategy, setMaskStrategy] = useState<MaskStrategy>("smart");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isUsingAutoPrompt, setIsUsingAutoPrompt] = useState(true);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [cleanPreviews, setCleanPreviews] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [aiModel, setAiModel] = useState<"seedream" | "flux-fill">("seedream");

  const currentImg = imgElements[currentImageIndex];
  const currentPreview = cleanPreviews[currentImageIndex];

  // Auto-generate prompt when gravity or ratio changes
  useEffect(() => {
    if (currentImg && isUsingAutoPrompt) {
      const originalRatio = currentImg.naturalWidth / currentImg.naturalHeight;
      const autoPrompt = generateAutoPrompt(gravity, ratio, originalRatio);
      setCustomPrompt(autoPrompt);
    }
  }, [currentImg, gravity, ratio, isUsingAutoPrompt]);

  // Generate clean preview when image, ratio, or gravity changes
  useEffect(() => {
    if (currentImg) {
      generatePreview(currentImg, currentImageIndex);
    }
  }, [currentImg, ratio, gravity]);

  const handleFilesSelect = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);
    setCurrentImageIndex(0);

    // Generate preview URLs and load images
    const previews: string[] = [];
    const images: HTMLImageElement[] = [];

    fileArray.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      previews.push(url);

      const img = new Image();
      img.onload = () => {
        images[index] = img;
        if (images.filter(Boolean).length === fileArray.length) {
          setImgElements([...images]);
          // Generate initial clean preview for first image
          if (images[0]) {
            generatePreview(images[0], 0);
          }
        }
      };
      img.src = url;
    });

    setPreviewUrls(previews);
    setCleanPreviews([]);
    setResults([]);
    onResults([]);
  };

  const generatePreview = (img: HTMLImageElement, index: number) => {
    try {
      const { finalDimensions } = buildSeedreamCanvas(img, ratio, gravity);
      const cleanPreview = buildCleanPreview(img, ratio, gravity, finalDimensions);

      setCleanPreviews(prev => {
        const newPreviews = [...prev];
        newPreviews[index] = cleanPreview;
        return newPreviews;
      });
    } catch (error) {
      console.error("Error generating preview:", error);
    }
  };

  const processImages = async () => {
    if (imgElements.length === 0) return;

    setIsProcessing(true);
    onProcessingChange(true);
    setProgress(0);
    setCurrentImage(0);
    const newResults: string[] = [];

    try {
      for (let i = 0; i < imgElements.length; i++) {
        setCurrentImage(i + 1);
        setProgress((i / imgElements.length) * 100);
        const img = imgElements[i];
        const file = selectedFiles[i];

        // Get current prompt
        const currentPrompt = isUsingAutoPrompt
          ? generateAutoPrompt(gravity, ratio, img.naturalWidth / img.naturalHeight)
          : customPrompt;

        // Prepare form data based on AI model
        const form = new FormData();
        form.append("prompt", currentPrompt);
        form.append("seed", String(Math.floor(Math.random() * 1000000)));
        form.append("original_image", file);
        form.append("ai_model", aiModel);

        let canvasDataUrl: string;
        let originalImageInfo: any;
        let finalDimensions: any;

        if (aiModel === "flux-fill") {
          // Generate base image and mask for FLUX Fill
          const fluxResult = buildFluxBaseImage(img, ratio, gravity);
          canvasDataUrl = fluxResult.baseImageDataUrl;
          originalImageInfo = fluxResult.originalImageInfo;
          finalDimensions = fluxResult.finalDimensions;

          // Add mask for FLUX Fill
          form.append("mask_image", await dataUrlToBlob(fluxResult.maskDataUrl), "mask.png");
        } else {
          // Generate canvas for Seedream
          const seedreamResult = buildSeedreamCanvas(img, ratio, gravity);
          canvasDataUrl = seedreamResult.canvasDataUrl;
          originalImageInfo = seedreamResult.originalImageInfo;
          finalDimensions = seedreamResult.finalDimensions;
        }

        form.append("image_size", `${finalDimensions.width}x${finalDimensions.height}`);
        form.append("canvas_image", await dataUrlToBlob(canvasDataUrl), "canvas.png");

        const res = await fetch("/api/outpaint", { method: "POST", body: form });
        const json = await res.json();

        if (res.ok) {
          const imageUrl = json?.data?.images?.[0]?.url;
          if (imageUrl) {
            // Apply protective recomposition if needed
            // For Seedream: use mask strategy
            // For FLUX Fill: generally no need since it should respect the mask
            const shouldProtect = aiModel === "seedream" &&
              (maskStrategy === "ai_subject" || maskStrategy === "conservative");

            if (shouldProtect) {
              const seedreamImg = new Image();
              seedreamImg.crossOrigin = "anonymous";

              await new Promise((resolve, reject) => {
                seedreamImg.onload = () => {
                  try {
                    const protectedResult = protectiveRecomposition(
                      seedreamImg,
                      img,
                      originalImageInfo,
                      16
                    );

                    fetch(protectedResult)
                      .then(res => res.blob())
                      .then(blob => {
                        const url = URL.createObjectURL(blob);
                        newResults.push(url);
                        resolve(url);
                      });
                  } catch (error) {
                    newResults.push(imageUrl);
                    resolve(imageUrl);
                  }
                };
                seedreamImg.onerror = reject;
                seedreamImg.src = imageUrl;
              });
            } else {
              newResults.push(imageUrl);
            }
          }
        } else {
          console.error(`Error processing image ${i + 1}:`, json.error);
          alert(`Error processing image ${i + 1}: ${json.error}`);
        }

        setProgress(((i + 1) / imgElements.length) * 100);
      }

      setResults(newResults);
      onResults(newResults);
    } catch (error) {
      console.error("Error:", error);
      alert("Error processing images: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsProcessing(false);
      onProcessingChange(false);
      setProgress(0);
      setCurrentImage(0);
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setImgElements([]);
    setPreviewUrls([]);
    setCleanPreviews([]);
    setResults([]);
    setCurrentImageIndex(0);
    setProgress(0);
    setCurrentImage(0);
    onResults([]);
  };

  return (
    <div style={{ padding: 32, background: "#000", color: "#fff", minHeight: "100%" }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 8,
          color: "#fff",
          letterSpacing: "0.02em"
        }}>
          OUTPAINT
        </h2>
        <p style={{
          fontSize: 13,
          color: "#666",
          margin: 0,
          fontWeight: 400
        }}>
          Intelligent AI-powered expansion
        </p>
      </div>

      {/* File Upload */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          position: "relative",
          border: "2px dashed #333",
          borderRadius: "12px",
          padding: "24px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
          transition: "all 0.2s ease"
        }}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFilesSelect(e.target.files)}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer"
            }}
          />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🎨</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Drop images or click to upload
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Multiple images supported for batch expansion
            </div>
          </div>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <>
          {/* Image Selection */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16
            }}>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#888",
                letterSpacing: "0.05em"
              }}>
                {selectedFiles.length} IMAGE{selectedFiles.length > 1 ? 'S' : ''} LOADED
              </span>
              <button
                onClick={clearSelection}
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  color: "#666",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 500,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#222";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#666";
                }}
              >
                CLEAR
              </button>
            </div>

            {selectedFiles.length > 1 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))",
                gap: 8,
                marginBottom: 20
              }}>
                {previewUrls.map((preview, index) => (
                  <div
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    style={{
                      position: "relative",
                      cursor: "pointer",
                      border: currentImageIndex === index ? "2px solid #ff6b35" : "1px solid #333",
                      borderRadius: "8px",
                      overflow: "hidden",
                      aspectRatio: "1",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <img
                      src={preview}
                      alt={`Image ${index + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover"
                      }}
                    />
                    <div style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      background: currentImageIndex === index ? "#ff6b35" : "rgba(0,0,0,0.8)",
                      color: currentImageIndex === index ? "#000" : "#fff",
                      padding: "2px 5px",
                      borderRadius: "4px",
                      fontSize: 9,
                      fontWeight: 600
                    }}>
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#888",
                marginBottom: 8,
                letterSpacing: "0.05em"
              }}>
                TARGET RATIO
              </label>
              <select
                value={ratio}
                onChange={e => setRatio(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                {RATIOS.map(r => (
                  <option key={r.label} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>Gravity: </label>
              <div style={{ marginTop: 6 }}>
                {(["left", "center", "right", "top", "bottom"] as Gravity[]).map(g => (
                  <button
                    key={g}
                    onClick={() => setGravity(g)}
                    style={{
                      marginRight: 8,
                      marginBottom: 4,
                      padding: "6px 10px",
                      background: gravity === g ? "#FF6B35" : "#222",
                      color: gravity === g ? "#fff" : "#eee",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#888",
                marginBottom: 8,
                letterSpacing: "0.05em"
              }}>
                AI MODEL
              </label>
              <div style={{ marginBottom: 12 }}>
                {(["seedream", "flux-fill"] as const).map(model => (
                  <button
                    key={model}
                    onClick={() => setAiModel(model)}
                    style={{
                      marginRight: 8,
                      marginBottom: 4,
                      padding: "8px 12px",
                      background: aiModel === model ?
                        (model === "seedream" ? "#FF6B35" : "#4CAF50") : "#222",
                      color: aiModel === model ? "#fff" : "#eee",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      transition: "all 0.2s ease"
                    }}
                  >
                    {model === "seedream" ? "🌱 Seedream" : "🎯 FLUX Fill"}
                  </button>
                ))}
              </div>
              <div style={{
                fontSize: 10,
                color: "#666",
                marginBottom: 12,
                lineHeight: 1.4
              }}>
                {aiModel === "seedream" ?
                  "• Creative expansion, natural blending" :
                  "• Precise outpainting with mask control"}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>Estrategia: </label>
              <div style={{ marginTop: 6 }}>
                {(["smart", "ai_subject", "conservative"] as MaskStrategy[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setMaskStrategy(s)}
                    style={{
                      marginRight: 8,
                      marginBottom: 4,
                      padding: "4px 8px",
                      background: maskStrategy === s ? "#4CAF50" : "#222",
                      color: maskStrategy === s ? "#fff" : "#eee",
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 11
                    }}
                  >
                    {s === "ai_subject" ? "🤖 AI" : s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <label>Prompt: </label>
                  <button
                    onClick={() => setIsUsingAutoPrompt(!isUsingAutoPrompt)}
                    style={{
                      marginLeft: 8,
                      padding: "4px 8px",
                      background: isUsingAutoPrompt ? "#4CAF50" : "#666",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 11
                    }}
                  >
                    {isUsingAutoPrompt ? "🤖 Auto" : "✏️ Manual"}
                  </button>
                </div>
                <textarea
                  value={customPrompt}
                  onChange={e => {
                    setCustomPrompt(e.target.value);
                    setIsUsingAutoPrompt(false);
                  }}
                  placeholder="El prompt se genera automáticamente basado en gravity..."
                  style={{
                    width: "100%",
                    height: 80,
                    background: "#111",
                    color: "#eee",
                    padding: 8,
                    border: "1px solid #333",
                    borderRadius: 4,
                    fontSize: 12,
                    resize: "vertical"
                  }}
                />
              </div>

              <div style={{ fontSize: 10, color: "#666" }}>
                <strong>Presets:</strong>{" "}
                {Object.entries(PRESET_PROMPTS).slice(0, 3).map(([key, prompt]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCustomPrompt(prompt);
                      setIsUsingAutoPrompt(false);
                    }}
                    style={{
                      margin: "0 4px 4px 0",
                      padding: "2px 6px",
                      background: "#333",
                      color: "#ccc",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                      fontSize: 9
                    }}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          </div>

        {/* Preview */}
          {currentPreview && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>
                Preview · Imagen {currentImageIndex + 1}
                {selectedFiles.length > 1 && ` de ${selectedFiles.length}`}
              </h3>
              <img
                src={currentPreview}
                alt="Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: 300,
                  borderRadius: 8,
                  border: "1px solid #333"
                }}
              />
            </div>
          )}

          {/* Progress Bar */}
          {isProcessing && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8
              }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#888",
                  letterSpacing: "0.05em"
                }}>
                  PROCESANDO IMÁGENES
                </span>
                <span style={{
                  fontSize: 11,
                  color: "#666"
                }}>
                  {currentImage}/{selectedFiles.length} • {Math.round(progress)}%
                </span>
              </div>

              <div style={{
                width: "100%",
                height: 8,
                background: "#222",
                borderRadius: 4,
                overflow: "hidden"
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "linear-gradient(135deg, #FF6B35 0%, #ff5722 100%)",
                  transition: "width 0.3s ease",
                  borderRadius: 4
                }} />
              </div>

              <div style={{
                fontSize: 10,
                color: "#666",
                marginTop: 4,
                textAlign: "center"
              }}>
                {currentImage > 0 && `Procesando: ${selectedFiles[currentImage - 1]?.name}`}
              </div>
            </div>
          )}

          {/* Process Button */}
          <button
            onClick={processImages}
            disabled={imgElements.length === 0 || isProcessing}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              background: (imgElements.length === 0 || isProcessing) ? "#444" : "#FF6B35",
              color: (imgElements.length === 0 || isProcessing) ? "#888" : "#fff",
              border: "none",
              cursor: (imgElements.length === 0 || isProcessing) ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 16
            }}
          >
            {isProcessing ?
              `🌱 Procesando ${selectedFiles.length} imagen${selectedFiles.length > 1 ? 'es' : ''}...` :
              `🌱 Expandir ${selectedFiles.length} imagen${selectedFiles.length > 1 ? 'es' : ''}`
            }
          </button>
        </>
      )}

      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>
        <strong>Outpaint Inteligente:</strong><br/>
        • Preview inmediato al cargar imagen<br/>
        • Prompts automáticos según gravity y ratio<br/>
        • Procesamiento en lote de múltiples imágenes<br/>
        • Recomposición protectora para preservar sujetos
      </div>
    </div>
  );
}