"use client";

import { useState } from "react";
import SmartCrop from "./components/SmartCrop";
import Outpaint from "./components/Outpaint";
import ComingSoon from "./components/ComingSoon";
import BackgroundRemoval from "./components/BackgroundRemoval";
import Settings from "./components/Settings";
import ResultsGrid from "./components/ResultsGrid";

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
    <div style={{
      minHeight: "100vh",
      background: "#000",
      color: "#fff",
      margin: 0,
      padding: 0
    }}>
      {/* Header */}
      <header style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
        borderBottom: "1px solid #222",
        padding: "20px 32px",
        position: "relative"
      }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          margin: 0,
          textAlign: "center",
          background: "linear-gradient(135deg, #fff 0%, #888 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.02em"
        }}>
          AI IMAGE STUDIO
        </h1>
        <p style={{
          margin: "4px 0 0 0",
          textAlign: "center",
          fontSize: 12,
          color: "#666",
          fontWeight: 400,
          letterSpacing: "0.1em"
        }}>
          SMART PROCESSING SUITE
        </p>

        {/* Settings Button - Temporarily Hidden */}
        {false && (
          <div style={{ position: "absolute", top: 20, right: 32 }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                padding: "8px",
                background: "transparent",
                border: "1px solid #333",
                borderRadius: "6px",
                color: "#888",
                cursor: "pointer",
                fontSize: 14,
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#222";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#888";
              }}
            >
              ⋯
            </button>

            {/* Settings Dropdown */}
            {showSettings && (
              <div style={{
                position: "absolute",
                top: 45,
                right: 0,
                width: 400,
                maxHeight: "80vh",
                background: "#111",
                border: "1px solid #333",
                borderRadius: "12px",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.8)",
                zIndex: 1000,
                overflow: "hidden"
              }}>
                <div style={{ maxHeight: "80vh", overflowY: "auto" }}>
                  <Settings
                    onResults={() => {}}
                    onProcessingChange={() => {}}
                  />
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
                "linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)" :
                isProcessing ? "#333" : "transparent",
              color: currentMode === "smart-crop" ? "#000" :
                     isProcessing ? "#555" : "#888",
              border: "none",
              cursor: isProcessing ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "all 0.2s ease",
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
  );
}