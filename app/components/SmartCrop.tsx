"use client";

import { useState } from "react";

const RATIOS = [
  { label: "1:1", value: 1/1 },
  { label: "4:5", value: 4/5 },
  { label: "3:4", value: 3/4 },
  { label: "9:16", value: 9/16 },
  { label: "16:9", value: 16/9 },
];

interface SmartCropProps {
  onResults: (results: string[]) => void;
  onProcessingChange: (isProcessing: boolean) => void;
}

export default function SmartCrop({ onResults, onProcessingChange }: SmartCropProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [ratio, setRatio] = useState(RATIOS[0].value);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);

  const handleFilesSelect = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);

    // Generate previews
    const previewUrls = fileArray.map(file => URL.createObjectURL(file));
    setPreviews(previewUrls);
  };

  const processImages = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    onProcessingChange(true);
    setProgress(0);
    setCurrentImage(0);
    const results: string[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentImage(i + 1);

        // Actualizar progreso al inicio de cada imagen
        setProgress((i / selectedFiles.length) * 100);

        const form = new FormData();
        form.append("image", file);
        form.append("ratio", RATIOS.find(r => r.value === ratio)?.label || "1:1");
        form.append("width", "1080");

        const res = await fetch("/api/smart-crop", {
          method: "POST",
          body: form
        });

        if (res.ok) {
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
            <div style={{ fontSize: 24, marginBottom: 8, color: "#666" }}>□</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Drop images or click to upload
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Multiple images supported for batch processing
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
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
            gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
            gap: 12,
            marginBottom: 24
          }}>
            {previews.map((preview, index) => (
              <div key={index} style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid #222"
              }}>
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                />
                <div style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  background: "rgba(0,0,0,0.8)",
                  color: "#fff",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: 10,
                  fontWeight: 600
                }}>
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
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
              background: "linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)",
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
        padding: "20px",
        background: "linear-gradient(135deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)",
        borderRadius: "12px",
        border: "1px solid #222"
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#888",
          marginBottom: 12,
          letterSpacing: "0.05em"
        }}>
          FEATURES
        </div>
        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>• Automatic subject and object detection</div>
          <div style={{ marginBottom: 8 }}>• Intelligent focal point preservation</div>
          <div style={{ marginBottom: 8 }}>• Batch processing for multiple images</div>
          <div>• Optimized for social media formats</div>
        </div>
      </div>
    </div>
  );
}