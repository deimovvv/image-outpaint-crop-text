"use client";

import { useState } from "react";

interface ResultsGridProps {
  results: string[];
  mode: "smart-crop" | "outpaint" | "text-overlay";
}

export default function ResultsGrid({ results, mode }: ResultsGridProps) {
  const [selectedResult, setSelectedResult] = useState<string | null>(null);

  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const prefix = mode === "smart-crop" ? "smart-crop" :
                     mode === "outpaint" ? "outpaint" : "text-overlay";
      link.download = `${prefix}-${index + 1}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Error downloading image');
    }
  };

  const downloadAllZip = async () => {
    // For now, download individually. Could implement ZIP later
    results.forEach((url, index) => {
      setTimeout(() => downloadImage(url, index), index * 500);
    });
  };

  if (results.length === 0) {
    return (
      <div style={{
        padding: 40,
        textAlign: "center",
        color: "#666",
        background: "#111",
        borderRadius: 8,
        border: "1px dashed #333"
      }}>
        <div style={{
          fontSize: 32,
          marginBottom: 16,
          color: "#666",
          fontWeight: 300
        }}>📷</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>No results yet</div>
        <div style={{ fontSize: 12 }}>
          Process images with {
            mode === "smart-crop" ? "Smart Crop" :
            mode === "outpaint" ? "Outpaint" :
            mode === "background-removal" ? "Background Removal" :
            "Text Overlay"
          } to see results here
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, background: "#000", color: "#fff", minHeight: "100%" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 32
      }}>
        <div>
          <h3 style={{
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
            letterSpacing: "0.02em"
          }}>
            RESULTS
          </h3>
          <p style={{
            fontSize: 12,
            color: "#666",
            margin: "4px 0 0 0"
          }}>
            {results.length} image{results.length !== 1 ? 's' : ''} processed
          </p>
        </div>
        {results.length > 1 && (
          <button
            onClick={downloadAllZip}
            style={{
              padding: "10px 16px",
              background: "linear-gradient(135deg, #333 0%, #444 100%)",
              color: "#fff",
              border: "1px solid #555",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "all 0.2s ease"
            }}
          >
            DOWNLOAD ALL
          </button>
        )}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: results.length === 1 ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16
      }}>
        {results.map((imageUrl, index) => (
          <div
            key={index}
            style={{
              background: "#111",
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid #333"
            }}
          >
            <div
              style={{ position: "relative", cursor: "pointer" }}
              onClick={() => setSelectedResult(imageUrl)}
            >
              <img
                src={imageUrl}
                alt={`Result ${index + 1}`}
                style={{
                  width: "100%",
                  height: results.length === 1 ? "auto" : 200,
                  objectFit: "cover",
                  display: "block"
                }}
              />
              <div style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "rgba(0,0,0,0.8)",
                color: "white",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500
              }}>
                {index + 1}
              </div>
              {results.length > 1 && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0,
                  transition: "opacity 0.2s"
                }}
                className="hover-overlay"
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}
                >
                  <div style={{
                    background: "rgba(255,255,255,0.9)",
                    color: "#000",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    👁️ Ver completa
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: 12 }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: 12, color: "#999" }}>
                  {mode === "smart-crop" ? "✂️ Smart Crop" :
                   mode === "outpaint" ? "🌱 Outpaint" :
                   "📝 Text Overlay"}
                </span>
                <button
                  onClick={() => downloadImage(imageUrl, index)}
                  style={{
                    padding: "6px 10px",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 500
                  }}
                >
                  ⬇️ Descargar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for full image view */}
      {selectedResult && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20
          }}
          onClick={() => setSelectedResult(null)}
        >
          <div style={{ position: "relative", maxWidth: "85vw", maxHeight: "85vh" }}>
            <img
              src={selectedResult}
              alt="Full size"
              style={{
                width: "auto",
                height: "auto",
                maxWidth: "85vw",
                maxHeight: "85vh",
                objectFit: "contain",
                borderRadius: 8,
                display: "block"
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedResult(null)}
              style={{
                position: "absolute",
                top: -10,
                right: -10,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#ff4444",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: "bold"
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}