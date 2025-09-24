"use client";

import { useState } from "react";
import SmartCrop from "./components/SmartCrop";
import Outpaint from "./components/Outpaint";
import ComingSoon from "./components/ComingSoon";
import BackgroundRemoval from "./components/BackgroundRemoval";
import Settings from "./components/Settings";
import ResultsGrid from "./components/ResultsGrid";
import Loader from "./components/Loader";

type Mode = "smart-crop" | "outpaint" | "background-removal" | "text-overlay";

export default function Home() {
  const [currentMode, setCurrentMode] = useState<Mode>("outpaint");
  const [results, setResults] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleModeChange = (mode: Mode) => {
    if (isProcessing) return; // Prevent mode switching while processing
    setCurrentMode(mode);
    setResults([]); // Clear results when switching modes
  };

  const handleResults = (newResults: string[]) => {
    setResults(newResults);
  };

  const handleProcessingChange = (processing: boolean) => {
    setIsProcessing(processing);
  };

  return (
    <>
      <Loader />
      <div style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        color: "#EAE8E4",
        margin: 0,
        padding: 0
      }}>
      {/* Header */}
      <header style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
        borderBottom: "1px solid #222",
        padding: "20px 32px",
        position: "relative"
      }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          margin: 0,
          textAlign: "center",
          color: "#EAE8E4",
          letterSpacing: "-0.02em",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        }}>
          AI IMAGE STUDIO
        </h1>
        <p style={{
          margin: "4px 0 0 0",
          textAlign: "center",
          fontSize: 12,
          color: "#888",
          fontWeight: 500,
          letterSpacing: "0.1em",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        }}>
          SMART PROCESSING SUITE
        </p>

        {/* Documentation Button */}
        {true && (
          <div style={{ position: "absolute", top: 20, right: 32 }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                padding: "6px 12px",
                background: "transparent",
                border: "1px solid #333",
                borderRadius: "6px",
                color: "#888",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.05em",
                transition: "all 0.2s ease",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#DFBBFE";
                e.currentTarget.style.color = "#000";
                e.currentTarget.style.borderColor = "#DFBBFE";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#888";
                e.currentTarget.style.borderColor = "#333";
              }}
            >
              DOCS
            </button>

            {/* Documentation Dropdown */}
            {showSettings && (
              <div style={{
                position: "absolute",
                top: 45,
                right: 0,
                width: 500,
                maxHeight: "70vh",
                background: "#0A0A0A",
                border: "1px solid #DFBBFE",
                borderRadius: "12px",
                boxShadow: "0 8px 32px rgba(223, 187, 254, 0.2)",
                zIndex: 1000,
                overflow: "hidden"
              }}>
                <div style={{
                  maxHeight: "70vh",
                  overflowY: "auto",
                  padding: "20px",
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
                }}>
                  <div style={{
                    borderBottom: "1px solid #333",
                    paddingBottom: "16px",
                    marginBottom: "20px"
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#DFBBFE",
                      letterSpacing: "-0.01em"
                    }}>
                      📖 Documentation
                    </h3>
                    <p style={{
                      margin: "4px 0 0 0",
                      fontSize: 12,
                      color: "#888",
                      fontWeight: 400
                    }}>
                      How to use each section of AI Image Studio
                    </p>
                  </div>

                  {/* Smart Crop Documentation */}
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{
                      margin: "0 0 8px 0",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#EAE8E4",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <span style={{ color: "#DFBBFE" }}>✂️</span>
                      Smart Crop
                    </h4>
                    <div style={{
                      fontSize: 12,
                      color: "#ccc",
                      lineHeight: 1.5,
                      marginBottom: "12px"
                    }}>
                      Intelligent cropping with person detection and composition analysis.
                    </div>
                    <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>
                      <div style={{ marginBottom: "8px" }}>
                        <strong style={{ color: "#DFBBFE" }}>Traditional Mode:</strong>
                        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                          <li>🔍 <strong>Protect Faces:</strong> Prioritizes person detection (95% accuracy)</li>
                          <li>🔄 <strong>Consistent Crop:</strong> Same focal point across batch</li>
                          <li>👥 <strong>Dual Focal Points:</strong> Detects person + object separately</li>
                        </ul>
                      </div>
                      <div>
                        <strong style={{ color: "#9C27B0" }}>AI Reframe Mode:</strong>
                        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                          <li>🎯 Uses FAL AI to intelligently adjust aspect ratio</li>
                          <li>🖼️ Uses outpainting when expansion is needed</li>
                          <li>✨ Preserves subject position and composition</li>
                          <li>🔄 Automatically handles both cropping and expanding</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Outpaint Documentation */}
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{
                      margin: "0 0 8px 0",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#EAE8E4",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <span style={{ color: "#FF6B35" }}>🎨</span>
                      Outpaint
                    </h4>
                    <div style={{
                      fontSize: 12,
                      color: "#ccc",
                      lineHeight: 1.5,
                      marginBottom: "12px"
                    }}>
                      AI-powered image expansion with multiple models for different use cases.
                    </div>
                    <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>
                      <div style={{ marginBottom: "8px" }}>
                        <strong style={{ color: "#FF6B35" }}>Seedream:</strong> Creative expansion with artistic interpretation
                      </div>
                      <div style={{ marginBottom: "8px" }}>
                        <strong style={{ color: "#4CAF50" }}>FLUX Fill:</strong> Best for preserving faces/objects but inconsistent outpainting
                      </div>
                      <div style={{ marginBottom: "8px" }}>
                        <strong style={{ color: "#9C27B0" }}>Luma Photon:</strong> Most consistent outpainting, no prompts/gravity needed
                      </div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: "8px", borderTop: "1px solid #333", paddingTop: "8px" }}>
                        <div style={{ marginBottom: "4px" }}>
                          💡 <strong>Best for faces/people:</strong> FLUX Fill (despite inconsistencies)
                        </div>
                        <div style={{ marginBottom: "4px" }}>
                          🎯 <strong>Most reliable outpainting:</strong> Luma Photon
                        </div>
                        <div>
                          🎨 <strong>Creative results:</strong> Seedream
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Background Removal Documentation */}
                  <div style={{ marginBottom: "24px" }}>
                    <h4 style={{
                      margin: "0 0 8px 0",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#EAE8E4",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <span style={{ color: "#8B5CF6" }}>🎭</span>
                      Background Removal
                    </h4>
                    <div style={{
                      fontSize: 12,
                      color: "#ccc",
                      lineHeight: 1.5,
                      marginBottom: "12px"
                    }}>
                      AI-powered background removal with high-quality edge preservation.
                    </div>
                    <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>
                      <ul style={{ margin: "0 0 0 16px", padding: 0 }}>
                        <li>🎯 Uses Bria AI for professional results</li>
                        <li>🖼️ Outputs transparent PNG files</li>
                        <li>✨ Preserves fine details like hair and fur</li>
                        <li>📦 Supports batch processing</li>
                      </ul>
                      <div style={{ fontSize: 10, color: "#666", marginTop: "8px" }}>
                        💡 <strong>Best for:</strong> Products, portraits, objects with clear subject-background separation.
                      </div>
                    </div>
                  </div>

                  {/* Text Overlay Documentation */}
                  <div style={{ marginBottom: "16px" }}>
                    <h4 style={{
                      margin: "0 0 8px 0",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#666",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <span style={{ color: "#666" }}>📝</span>
                      Text Overlay
                    </h4>
                    <div style={{
                      fontSize: 12,
                      color: "#666",
                      lineHeight: 1.5,
                      fontStyle: "italic"
                    }}>
                      Coming soon - AI-powered text placement and styling.
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* Click outside to close */}
        {showSettings && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999
            }}
            onClick={() => setShowSettings(false)}
          />
        )}
      </header>

      {/* Mode Switch */}
      <div style={{
        background: "#0a0a0a",
        borderBottom: "1px solid #222",
        padding: "0 32px",
        display: "flex",
        justifyContent: "center"
      }}>
        <div style={{
          display: "flex",
          background: "#111",
          borderRadius: "12px",
          padding: "4px",
          margin: "16px 0"
        }}>
          <button
            onClick={() => handleModeChange("smart-crop")}
            disabled={isProcessing}
            style={{
              padding: "12px 20px",
              borderRadius: "8px",
              background: currentMode === "smart-crop" ?
                "linear-gradient(135deg, #DFBBFE 0%, #C8A2FE 100%)" :
                isProcessing ? "#333" : "transparent",
              color: currentMode === "smart-crop" ? "#000" :
                     isProcessing ? "#555" : "#888",
              border: "none",
              cursor: isProcessing ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "all 0.2s ease",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              minWidth: "120px",
              opacity: isProcessing && currentMode !== "smart-crop" ? 0.5 : 1
            }}
          >
            SMART CROP
          </button>
          <button
            onClick={() => handleModeChange("outpaint")}
            disabled={isProcessing}
            style={{
              padding: "12px 20px",
              borderRadius: "8px",
              background: currentMode === "outpaint" ?
                "linear-gradient(135deg, #ff6b35 0%, #e55a2b 100%)" :
                isProcessing ? "#333" : "transparent",
              color: currentMode === "outpaint" ? "#000" :
                     isProcessing ? "#555" : "#888",
              border: "none",
              cursor: isProcessing ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "all 0.2s ease",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              minWidth: "120px",
              opacity: isProcessing && currentMode !== "outpaint" ? 0.5 : 1
            }}
          >
            OUTPAINT
          </button>
          <button
            onClick={() => handleModeChange("background-removal")}
            disabled={isProcessing}
            style={{
              padding: "12px 20px",
              borderRadius: "8px",
              background: currentMode === "background-removal" ?
                "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)" :
                isProcessing ? "#333" : "transparent",
              color: currentMode === "background-removal" ? "#000" :
                     isProcessing ? "#555" : "#888",
              border: "none",
              cursor: isProcessing ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "all 0.2s ease",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              minWidth: "120px",
              opacity: isProcessing && currentMode !== "background-removal" ? 0.5 : 1
            }}
          >
            BACKGROUND REMOVAL
          </button>
          <button
            onClick={() => handleModeChange("text-overlay")}
            disabled={isProcessing}
            style={{
              padding: "12px 20px",
              borderRadius: "8px",
              background: currentMode === "text-overlay" ?
                "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)" :
                isProcessing ? "#333" : "transparent",
              color: currentMode === "text-overlay" ? "#000" :
                     isProcessing ? "#555" : "#888",
              border: "none",
              cursor: isProcessing ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "all 0.2s ease",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
              minWidth: "120px",
              opacity: isProcessing && currentMode !== "text-overlay" ? 0.5 : 1
            }}
          >
            TEXT OVERLAY
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: "calc(100vh - 140px)",
        background: "#000"
      }}>
        {/* Left Panel - Tool */}
        <div style={{
          borderRight: "1px solid #222",
          background: "#000"
        }}>
          {currentMode === "smart-crop" ? (
            <SmartCrop
              onResults={handleResults}
              onProcessingChange={handleProcessingChange}
            />
          ) : currentMode === "outpaint" ? (
            <Outpaint
              onResults={handleResults}
              onProcessingChange={handleProcessingChange}
            />
          ) : currentMode === "background-removal" ? (
            <BackgroundRemoval
              onResults={handleResults}
              onProcessingChange={handleProcessingChange}
            />
          ) : (
            <ComingSoon
              onResults={handleResults}
              onProcessingChange={handleProcessingChange}
            />
          )}
        </div>

        {/* Right Panel - Results */}
        <div style={{ background: "#000" }}>
          <ResultsGrid results={results} mode={currentMode} />
        </div>
      </div>
    </div>
    </>
  );
}