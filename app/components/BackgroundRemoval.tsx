"use client";

import { useState } from "react";

interface BackgroundRemovalProps {
  onResults: (results: string[]) => void;
  onProcessingChange: (isProcessing: boolean) => void;
}

export default function BackgroundRemoval({ onResults, onProcessingChange }: BackgroundRemovalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);

  const handleFilesSelect = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);

    // Generate preview URLs
    const previews = fileArray.map(file => URL.createObjectURL(file));
    setPreviewUrls(previews);

    // Clear previous results
    onResults([]);
  };

  const processImages = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    onProcessingChange(true);
    setProgress(0);
    setCurrentImage(0);
    const newResults: string[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        setCurrentImage(i + 1);
        setProgress((i / selectedFiles.length) * 100);

        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch("/api/background-removal", {
          method: "POST",
          body: formData
        });

        const json = await res.json();

        if (res.ok) {
          const imageUrl = json?.data?.image?.url;
          if (imageUrl) {
            newResults.push(imageUrl);
          }
        } else {
          console.error(`Error processing image ${i + 1}:`, json.error);
          alert(`Error processing image ${i + 1}: ${json.error}`);
        }

        setProgress(((i + 1) / selectedFiles.length) * 100);
      }

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
    setPreviewUrls([]);
    onResults([]);
    setProgress(0);
    setCurrentImage(0);
  };

  return (
    <div style={{ padding: 32, background: "#000", color: "#fff", minHeight: "100%" }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{
          fontSize: 20,
          fontWeight: 300,
          marginBottom: 8,
          color: "#fff",
          letterSpacing: "0.02em"
        }}>
          Background Removal
        </h2>
        <p style={{
          fontSize: 13,
          color: "#666",
          margin: 0,
          fontWeight: 300
        }}>
          AI-powered background removal
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
            <div style={{ fontSize: 14, fontWeight: 400, marginBottom: 4 }}>
              Drop images or click to upload
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Multiple images supported for batch processing
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
                fontWeight: 400,
                color: "#888",
                letterSpacing: "0.02em"
              }}>
                {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''} loaded
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
                Clear
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
                    style={{
                      position: "relative",
                      border: "1px solid #333",
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
                      background: "rgba(0,0,0,0.8)",
                      color: "#fff",
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
                  fontWeight: 400,
                  color: "#888",
                  letterSpacing: "0.02em"
                }}>
                  Processing images
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
                  background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
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
                {currentImage > 0 && `Processing: ${selectedFiles[currentImage - 1]?.name}`}
              </div>
            </div>
          )}

          {/* Process Button */}
          <button
            onClick={processImages}
            disabled={selectedFiles.length === 0 || isProcessing}
            style={{
              padding: "12px 20px",
              borderRadius: 8,
              background: (selectedFiles.length === 0 || isProcessing) ? "#444" : "#8B5CF6",
              color: (selectedFiles.length === 0 || isProcessing) ? "#888" : "#fff",
              border: "none",
              cursor: (selectedFiles.length === 0 || isProcessing) ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 16
            }}
          >
            {isProcessing ?
              `Processing ${selectedFiles.length} image${selectedFiles.length > 1 ? 's' : ''}...` :
              `Remove Background from ${selectedFiles.length} image${selectedFiles.length > 1 ? 's' : ''}`
            }
          </button>
        </>
      )}

      <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5, fontWeight: 300 }}>
        <strong style={{ fontWeight: 400 }}>Features:</strong><br/>
        • High-quality AI background removal<br/>
        • Batch processing support<br/>
        • Preserves subject details and edges<br/>
        • Transparent PNG output
      </div>
    </div>
  );
}