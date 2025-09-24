"use client";

import { useState, useEffect } from "react";

interface SettingsProps {
  onResults: (results: string[]) => void;
  onProcessingChange: (isProcessing: boolean) => void;
}

export default function Settings({ onResults, onProcessingChange }: SettingsProps) {
  const [apiKey, setApiKey] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    // Load API key from localStorage on component mount
    const savedKey = localStorage.getItem("fal_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setIsValid(true);
      setLastChecked(localStorage.getItem("fal_api_key_checked"));
    }
  }, []);

  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      setIsValid(false);
      return;
    }

    setIsChecking(true);
    try {
      // Test API key with a simple request
      const response = await fetch("/api/validate-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const result = await response.json();
      const valid = response.ok && result.valid;

      setIsValid(valid);

      if (valid) {
        // Save to localStorage if valid
        localStorage.setItem("fal_api_key", apiKey.trim());
        localStorage.setItem("fal_api_key_checked", new Date().toISOString());
        setLastChecked(new Date().toISOString());
      } else {
        // Remove from localStorage if invalid
        localStorage.removeItem("fal_api_key");
        localStorage.removeItem("fal_api_key_checked");
        setLastChecked(null);
      }
    } catch (error) {
      console.error("Error validating API key:", error);
      setIsValid(false);
    } finally {
      setIsChecking(false);
    }
  };

  const clearApiKey = () => {
    setApiKey("");
    setIsValid(false);
    setLastChecked(null);
    localStorage.removeItem("fal_api_key");
    localStorage.removeItem("fal_api_key_checked");
  };

  const useDefaultKey = () => {
    setApiKey("default");
    setIsValid(true);
    setLastChecked(new Date().toISOString());
    localStorage.setItem("fal_api_key", "default");
    localStorage.setItem("fal_api_key_checked", new Date().toISOString());
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
          Settings
        </h2>
        <p style={{
          fontSize: 13,
          color: "#666",
          margin: 0,
          fontWeight: 300
        }}>
          Configure your FAL AI API credentials
        </p>
      </div>

      {/* API Key Configuration */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          background: "#0a0a0a",
          border: "1px solid #333",
          borderRadius: 12,
          padding: 24
        }}>
          <h3 style={{
            fontSize: 16,
            fontWeight: 400,
            marginBottom: 16,
            color: "#fff"
          }}>
            FAL AI API Key
          </h3>

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontSize: 12,
              fontWeight: 400,
              color: "#888",
              marginBottom: 8,
              letterSpacing: "0.02em"
            }}>
              API Key
            </label>

            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                value={apiKey === "default" ? "Using default key" : apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={apiKey === "default"}
                placeholder="Enter your FAL AI API key (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:xxxxxxxx...)"
                style={{
                  width: "100%",
                  padding: "12px 45px 12px 16px",
                  background: apiKey === "default" ? "#1a1a1a" : "#111",
                  border: `1px solid ${isValid ? "#4CAF50" : "#333"}`,
                  borderRadius: "8px",
                  color: apiKey === "default" ? "#666" : "#fff",
                  fontSize: 14,
                  fontFamily: "monospace",
                  outline: "none",
                  transition: "border-color 0.2s ease"
                }}
              />

              {apiKey && apiKey !== "default" && (
                <button
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "#666",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: 4
                  }}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              )}
            </div>
          </div>

          <div style={{
            display: "flex",
            gap: 12,
            marginBottom: 16
          }}>
            <button
              onClick={validateApiKey}
              disabled={!apiKey.trim() || isChecking || apiKey === "default"}
              style={{
                padding: "8px 16px",
                background: isChecking ? "#444" : "#0066CC",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isChecking || apiKey === "default" ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 500,
                transition: "all 0.2s ease"
              }}
            >
              {isChecking ? "Validating..." : "Validate Key"}
            </button>

            <button
              onClick={useDefaultKey}
              style={{
                padding: "8px 16px",
                background: "transparent",
                color: "#888",
                border: "1px solid #333",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
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
              Use Default Key
            </button>

            {apiKey && (
              <button
                onClick={clearApiKey}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  color: "#ff6b6b",
                  border: "1px solid #ff6b6b",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#ff6b6b";
                  e.currentTarget.style.color = "#000";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#ff6b6b";
                }}
              >
                Clear Key
              </button>
            )}
          </div>

          {/* Status */}
          <div style={{ marginBottom: 16 }}>
            {isValid && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "#1a4d3a",
                border: "1px solid #4CAF50",
                borderRadius: 6,
                fontSize: 12
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50" }} />
                <span>API key is valid</span>
                {lastChecked && (
                  <span style={{ color: "#666", marginLeft: "auto" }}>
                    Checked: {new Date(lastChecked).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {apiKey && !isValid && !isChecking && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "#4d1a1a",
                border: "1px solid #ff6b6b",
                borderRadius: 6,
                fontSize: 12
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff6b6b" }} />
                <span>Invalid API key</span>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div style={{
            fontSize: 11,
            color: "#666",
            lineHeight: 1.5,
            background: "#0a0a0a",
            padding: 16,
            borderRadius: 6,
            border: "1px solid #222"
          }}>
            <strong style={{ fontWeight: 400, color: "#888" }}>How to get your FAL AI API Key:</strong><br/>
            1. Visit <a href="https://fal.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#0066CC" }}>fal.ai</a> and create an account<br/>
            2. Go to your dashboard and find the API Keys section<br/>
            3. Create a new API key<br/>
            4. Copy the key (format: id:secret) and paste it above<br/>
            5. Click "Validate Key" to verify it works<br/>
            <br/>
            <strong style={{ fontWeight: 400, color: "#888" }}>Note:</strong> Your API key is stored locally in your browser and never sent to our servers.
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div style={{
        background: "#0a0a0a",
        border: "1px solid #333",
        borderRadius: 12,
        padding: 24
      }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 400,
          marginBottom: 16,
          color: "#fff"
        }}>
          Current Configuration
        </h3>

        <div style={{ fontSize: 12, color: "#ccc", lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Status:</strong> {isValid ? "✅ Ready to use AI features" : "❌ API key required"}
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Key Type:</strong> {apiKey === "default" ? "Default (Demo)" : apiKey ? "Custom" : "None"}
          </div>
          <div>
            <strong>Available Features:</strong> {isValid ? "Smart Crop, Outpaint, Background Removal" : "None (configure API key first)"}
          </div>
        </div>
      </div>
    </div>
  );
}