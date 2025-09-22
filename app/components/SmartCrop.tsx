"use client";

import { useState, useEffect, useCallback } from "react";

const RATIOS = [
  { label: "1:1", value: 1/1 },
  { label: "4:5", value: 4/5 },
  { label: "3:4", value: 3/4 },
  { label: "9:16", value: 9/16 },
  { label: "16:9", value: 16/9 },
  { label: "Custom", value: 0 },
];

interface SmartCropProps {
  onResults: (results: string[]) => void;
  onProcessingChange: (isProcessing: boolean) => void;
}

export default function SmartCrop({ onResults, onProcessingChange }: SmartCropProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [ratio, setRatio] = useState(RATIOS[0].value);
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [sensitivity, setSensitivity] = useState(5);
  const [protectFaces, setProtectFaces] = useState(true);
  const [consistentCrop, setConsistentCrop] = useState(true);
  const [dualFocalPoints, setDualFocalPoints] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [previewCrops, setPreviewCrops] = useState<{x: number, y: number, width: number, height: number}[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  const handleFilesSelect = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);

    // Generate previews and calculate crop areas
    const previewUrls = fileArray.map(file => URL.createObjectURL(file));
    setPreviews(previewUrls);

    // Calculate preview crop areas
    calculatePreviewCrops(fileArray);
  };

  const calculatePreviewCrops = useCallback(async (files: File[]) => {
    const crops: {x: number, y: number, width: number, height: number}[] = [];

    for (const file of files) {
      const img = new Image();
      const url = URL.createObjectURL(file);

      await new Promise((resolve) => {
        img.onload = () => {
          const targetRatio = ratio === 0 ? customWidth / customHeight : ratio;
          const imgRatio = img.width / img.height;

          let cropWidth, cropHeight, x, y;

          if (imgRatio > targetRatio) {
            cropHeight = img.height;
            cropWidth = cropHeight * targetRatio;
            x = (img.width - cropWidth) / 2;
            y = 0;
          } else {
            cropWidth = img.width;
            cropHeight = cropWidth / targetRatio;
            x = 0;
            y = (img.height - cropHeight) / 2;
          }

          crops.push({ x, y, width: cropWidth, height: cropHeight });
          URL.revokeObjectURL(url);
          resolve(null);
        };
      });

      img.src = url;
    }

    setPreviewCrops(crops);
  }, [ratio, customWidth, customHeight]);

  useEffect(() => {
    if (selectedFiles.length > 0) {
      calculatePreviewCrops(selectedFiles);
    }
  }, [selectedFiles, ratio, customWidth, customHeight, calculatePreviewCrops]);

  const processImages = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    onProcessingChange(true);
    setProgress(0);
    setCurrentImage(0);
    setBatchId(null);
    const results: string[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentImage(i + 1);

        // Actualizar progreso al inicio de cada imagen
        setProgress((i / selectedFiles.length) * 100);

        const form = new FormData();
        form.append("image", file);
        form.append("ratio", ratio === 0 ? "Custom" : RATIOS.find(r => r.value === ratio)?.label || "1:1");
        form.append("width", ratio === 0 ? customWidth.toString() : "1080");
        form.append("height", ratio === 0 ? customHeight.toString() : undefined);
        form.append("sensitivity", sensitivity.toString());
        form.append("protectFaces", protectFaces.toString());
        form.append("consistentCrop", consistentCrop.toString());
        form.append("dualFocalPoints", dualFocalPoints.toString());
        form.append("isFirstImage", (i === 0).toString());
        form.append("imageIndex", i.toString());

        const headers: HeadersInit = {};
        if (batchId) {
          headers['X-Batch-Id'] = batchId;
        }

        const res = await fetch("/api/smart-crop", {
          method: "POST",
          headers,
          body: form
        });

        if (res.ok) {
          // Get batch ID from first image for consistency
          if (i === 0 && consistentCrop) {
            const responseBatchId = res.headers.get('X-Batch-Id');
            if (responseBatchId) {
              setBatchId(responseBatchId);
              console.log(`Batch ID set: ${responseBatchId}`);
            }
          }

          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          results.push(url);
        } else {
          const error = await res.text();
          console.error("Smart Crop Error:", error);
          alert(`Error processing ${file.name}: ${error}`);
        }

        // Actualizar progreso al completar cada imagen
        setProgress(((i + 1) / selectedFiles.length) * 100);
      }

      onResults(results);
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
    setPreviews([]);
    setPreviewCrops([]);
    setProgress(0);
    setCurrentImage(0);
    setSelectedImageIndex(null);
    setBatchId(null);
    onResults([]);
  };

  const removeImage = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    const newCrops = previewCrops.filter((_, i) => i !== index);

    setSelectedFiles(newFiles);
    setPreviews(newPreviews);
    setPreviewCrops(newCrops);

    if (selectedImageIndex === index) {
      setSelectedImageIndex(null);
    } else if (selectedImageIndex !== null && selectedImageIndex > index) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    handleFilesSelect(files);
  };

  return (
    <div style={{
      padding: "clamp(16px, 4vw, 32px)",
      background: "#000",
      color: "#fff",
      minHeight: "100%",
      maxWidth: "1200px",
      margin: "0 auto"
    }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 8,
          color: "#fff",
          letterSpacing: "0.02em"
        }}>
          SMART CROP
        </h2>
        <p style={{
          fontSize: 13,
          color: "#666",
          margin: 0,
          fontWeight: 400
        }}>
          Intelligent focal point detection
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            position: "relative",
            border: dragOver ? "2px dashed #00ff88" : "2px dashed #333",
            borderRadius: "12px",
            padding: "32px",
            background: dragOver ?
              "linear-gradient(135deg, rgba(0,255,136,0.1) 0%, rgba(0,204,106,0.05) 100%)" :
              "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
            transition: "all 0.3s ease",
            transform: dragOver ? "scale(1.02)" : "scale(1)"
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
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
            <div style={{
              fontSize: 32,
              marginBottom: 12,
              color: dragOver ? "#00ff88" : "#666",
              transition: "color 0.3s ease"
            }}>📁</div>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 6,
              color: dragOver ? "#fff" : "inherit"
            }}>
              {dragOver ? "Drop images here" : "Drop images or click to upload"}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Multiple images • JPG, PNG, WebP supported
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
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

          <div>
            <label style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#888",
              marginBottom: 8,
              letterSpacing: "0.05em"
            }}>
              DETECTION STRENGTH
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="range"
                min="1"
                max="10"
                value={sensitivity}
                onChange={e => setSensitivity(Number(e.target.value))}
                style={{
                  flex: 1,
                  height: 4,
                  background: "#333",
                  borderRadius: 2,
                  outline: "none"
                }}
              />
              <span style={{ fontSize: 12, color: "#666", minWidth: 20 }}>{sensitivity}</span>
            </div>
          </div>
        </div>

        {ratio === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#888",
                marginBottom: 8,
                letterSpacing: "0.05em"
              }}>
                CUSTOM WIDTH
              </label>
              <input
                type="number"
                min="100"
                max="4000"
                value={customWidth}
                onChange={e => setCustomWidth(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none"
                }}
              />
            </div>
            <div>
              <label style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: "#888",
                marginBottom: 8,
                letterSpacing: "0.05em"
              }}>
                CUSTOM HEIGHT
              </label>
              <input
                type="number"
                min="100"
                max="4000"
                value={customHeight}
                onChange={e => setCustomHeight(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: 14,
                  outline: "none"
                }}
              />
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          <label style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 500,
            color: "#ccc",
            cursor: "pointer"
          }}>
            <input
              type="checkbox"
              checked={protectFaces}
              onChange={e => setProtectFaces(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: "#00ff88"
              }}
            />
            <span>🎯 PROTECT FACES</span>
            <span style={{ color: "#666", fontSize: 11 }}>(Higher priority for person detection)</span>
          </label>

          <label style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 500,
            color: "#ccc",
            cursor: "pointer"
          }}>
            <input
              type="checkbox"
              checked={consistentCrop}
              onChange={e => setConsistentCrop(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: "#00ff88"
              }}
            />
            <span>🔄 CONSISTENT CROP</span>
            <span style={{ color: "#666", fontSize: 11 }}>(Same focal point across all images)</span>
          </label>

          <label style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 500,
            color: "#ccc",
            cursor: "pointer"
          }}>
            <input
              type="checkbox"
              checked={dualFocalPoints}
              onChange={e => setDualFocalPoints(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: "#00ff88"
              }}
            />
            <span>👥 DUAL FOCAL POINTS</span>
            <span style={{ color: "#666", fontSize: 11 }}>(Find person + object separately, include both)</span>
          </label>
        </div>
      </div>

      {selectedFiles.length > 0 && (
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
              {selectedFiles.length} IMAGE{selectedFiles.length > 1 ? 'S' : ''} SELECTED
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

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 16,
            marginBottom: 24
          }}>
            {previews.map((preview, index) => (
              <div key={index} style={{
                position: "relative",
                aspectRatio: ratio === 0 ? customWidth / customHeight : ratio,
                borderRadius: "12px",
                overflow: "hidden",
                border: selectedImageIndex === index ? "2px solid #00ff88" : "2px solid #222",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background: "#111"
              }}
              onClick={() => setSelectedImageIndex(selectedImageIndex === index ? null : index)}
              >
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transition: "transform 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                />

                {/* Crop preview overlay */}
                {previewCrops[index] && (
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none"
                  }}>
                    <div style={{
                      position: "absolute",
                      border: "2px solid #00ff88",
                      borderRadius: "4px",
                      background: "rgba(0,255,136,0.1)",
                      left: `${(previewCrops[index].x / (previewCrops[index].x + previewCrops[index].width)) * 50}%`,
                      top: `${(previewCrops[index].y / (previewCrops[index].y + previewCrops[index].height)) * 50}%`,
                      width: `${(previewCrops[index].width / (previewCrops[index].x + previewCrops[index].width)) * 50}%`,
                      height: `${(previewCrops[index].height / (previewCrops[index].y + previewCrops[index].height)) * 50}%`
                    }} />
                  </div>
                )}

                {/* Image number */}
                <div style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  background: "rgba(0,0,0,0.8)",
                  color: "#fff",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: 11,
                  fontWeight: 600
                }}>
                  {index + 1}
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 24,
                    height: 24,
                    background: "rgba(255,0,0,0.8)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,0,0,1)";
                    e.currentTarget.style.transform = "scale(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,0,0,0.8)";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  ×
                </button>

                {/* Processing indicator */}
                {isProcessing && currentImage === index + 1 && (
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "12px"
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      border: "3px solid #333",
                      borderTop: "3px solid #00ff88",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite"
                    }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Progress Bar */}
      {isProcessing && (
        <div style={{
          marginBottom: 24,
          padding: "20px",
          background: "linear-gradient(135deg, #111 0%, #0a0a0a 100%)",
          borderRadius: "12px",
          border: "1px solid #222"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <div style={{
                width: 16,
                height: 16,
                border: "2px solid #333",
                borderTop: "2px solid #00ff88",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }} />
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                letterSpacing: "0.05em"
              }}>
                PROCESSING IMAGES
              </span>
            </div>
            <span style={{
              fontSize: 12,
              color: "#00ff88",
              fontWeight: 600
            }}>
              {currentImage}/{selectedFiles.length} • {Math.round(progress)}%
            </span>
          </div>

          <div style={{
            width: "100%",
            height: 12,
            background: "#222",
            borderRadius: 6,
            overflow: "hidden",
            marginBottom: 8
          }}>
            <div style={{
              width: `${progress}%`,
              height: "100%",
              background: "linear-gradient(90deg, #00ff88 0%, #00cc6a 50%, #00ff88 100%)",
              transition: "width 0.3s ease",
              borderRadius: 6,
              position: "relative",
              overflow: "hidden"
            }}>
              <div style={{
                position: "absolute",
                top: 0,
                left: "-100%",
                width: "100%",
                height: "100%",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                animation: "shimmer 1.5s infinite"
              }} />
            </div>
          </div>

          <div style={{
            fontSize: 11,
            color: "#888",
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8
          }}>
            {currentImage > 0 && (
              <>
                <span>📷</span>
                <span>{selectedFiles[currentImage - 1]?.name}</span>
              </>
            )}
          </div>
        </div>
      )}

      <button
        onClick={processImages}
        disabled={selectedFiles.length === 0 || isProcessing}
        style={{
          width: "100%",
          padding: "16px 24px",
          borderRadius: "12px",
          background: (selectedFiles.length === 0 || isProcessing) ?
            "linear-gradient(135deg, #333 0%, #444 100%)" :
            "linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)",
          color: (selectedFiles.length === 0 || isProcessing) ? "#666" : "#000",
          border: "none",
          cursor: (selectedFiles.length === 0 || isProcessing) ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.02em",
          transition: "all 0.2s ease",
          marginBottom: 32
        }}
      >
        {isProcessing ?
          `PROCESSING ${selectedFiles.length} IMAGE${selectedFiles.length > 1 ? 'S' : ''}...` :
          selectedFiles.length > 0 ?
            `CROP ${selectedFiles.length} IMAGE${selectedFiles.length > 1 ? 'S' : ''}` :
            'SELECT IMAGES TO CROP'
        }
      </button>

      <div style={{
        padding: "24px",
        background: "linear-gradient(135deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)",
        borderRadius: "16px",
        border: "1px solid #333"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16
        }}>
          <div style={{ fontSize: 16 }}>🎯</div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.05em"
          }}>
            SMART CROP FEATURES
          </div>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          fontSize: 12,
          color: "#ccc",
          lineHeight: 1.5
        }}>
          <div>
            <div style={{ color: "#00ff88", fontWeight: 600, marginBottom: 4 }}>🎨 Detection</div>
            <div>• {dualFocalPoints ? 'Person + Object detection' : 'Single focal point'}</div>
            <div>• {protectFaces ? 'Face priority' : 'Standard detection'}</div>
            <div>• {consistentCrop ? 'Batch consistency' : 'Individual crops'}</div>
          </div>
          <div>
            <div style={{ color: "#00ff88", fontWeight: 600, marginBottom: 4 }}>⚙️ Smart Features</div>
            <div>• Cross-image consistency</div>
            <div>• Dual focal points</div>
            <div>• Adjustable sensitivity</div>
          </div>
        </div>
        {selectedImageIndex !== null && (
          <div style={{
            marginTop: 16,
            padding: 12,
            background: "rgba(0,255,136,0.1)",
            borderRadius: 8,
            fontSize: 11,
            color: "#00ff88"
          }}>
            💡 Image {selectedImageIndex + 1} selected - Green overlay shows detected crop area
          </div>
        )}

        {consistentCrop && selectedFiles.length > 1 && (
          <div style={{
            marginTop: 8,
            padding: 12,
            background: "rgba(0,200,255,0.1)",
            borderRadius: 8,
            fontSize: 11,
            color: "#00ccff"
          }}>
            🔄 Consistent Crop: First image focal point will be applied to all {selectedFiles.length} images
          </div>
        )}

        {dualFocalPoints && (
          <div style={{
            marginTop: 8,
            padding: 12,
            background: "rgba(255,200,0,0.1)",
            borderRadius: 8,
            fontSize: 11,
            color: "#ffcc00"
          }}>
            👥 Dual Mode Active: Will detect person first, then find the strongest object/product in a different area. Crop will center between both points when possible.
          </div>
        )}
      </div>

      {/* Add CSS animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }

        @media (max-width: 768px) {
          .grid-cols-2 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}