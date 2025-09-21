"use client";

import { useState } from "react";

const CANVAS_SIZES = [
  { label: "Instagram Post", value: { width: 1080, height: 1080 } },
  { label: "Instagram Story", value: { width: 1080, height: 1920 } },
  { label: "Facebook Post", value: { width: 1200, height: 630 } },
  { label: "Twitter Header", value: { width: 1500, height: 500 } },
  { label: "YouTube Thumbnail", value: { width: 1280, height: 720 } },
  { label: "Custom", value: { width: 1080, height: 1080 } },
];

const TYPOGRAPHY_OPTIONS = [
  { label: "Modern Sans", value: "modern-sans", description: "Clean, contemporary" },
  { label: "Helvetica", value: "helvetica", description: "Classic, professional" },
  { label: "Playfair", value: "playfair", description: "Elegant, serif" },
];

interface TextOverlayProps {
  onResults: (results: string[]) => void;
  onProcessingChange: (isProcessing: boolean) => void;
}

export default function TextOverlay({ onResults, onProcessingChange }: TextOverlayProps) {
  const [mainTitle, setMainTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [callToAction, setCallToAction] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [baseImageFile, setBaseImageFile] = useState<File | null>(null);
  const [baseImagePreview, setBaseImagePreview] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState(CANVAS_SIZES[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [backgroundStyle, setBackgroundStyle] = useState<"gradient" | "solid" | "minimal">("gradient");
  const [mainTitlePosition, setMainTitlePosition] = useState<"top" | "center" | "bottom">("top");
  const [subtitlePosition, setSubtitlePosition] = useState<"top" | "center" | "bottom">("center");
  const [callToActionPosition, setCallToActionPosition] = useState<"top" | "center" | "bottom">("bottom");
  const [logoPosition, setLogoPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("top-left");
  const [selectedTypography, setSelectedTypography] = useState(TYPOGRAPHY_OPTIONS[0]);

  const handleLogoSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.includes('png')) {
      alert('Solo se aceptan archivos PNG para el logo');
      return;
    }

    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  };

  const handleBaseImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.includes('image/')) {
      alert('Solo se aceptan archivos de imagen');
      return;
    }

    setBaseImageFile(file);
    const url = URL.createObjectURL(file);
    setBaseImagePreview(url);
  };

  const generateImage = async () => {
    if (!baseImageFile && !mainTitle && !subtitle && !callToAction) {
      alert('Agrega una imagen base o al menos un texto');
      return;
    }

    setIsProcessing(true);
    onProcessingChange(true);
    setProgress(0);

    try {
      // Build prompt for Seedream
      let prompt = "Create a professional social media design with modern typography. ";

      if (mainTitle) prompt += `Main headline: "${mainTitle}". `;
      if (subtitle) prompt += `Subtitle: "${subtitle}". `;
      if (callToAction) prompt += `Call to action: "${callToAction}". `;

      prompt += `Background style: ${backgroundStyle}. `;
      prompt += "Clean, minimal, professional design. High contrast text. Modern typography. ";

      if (logoFile) prompt += "Include logo placement area. ";

      const form = new FormData();
      form.append("prompt", prompt);
      form.append("image_size", `${selectedSize.value.width}x${selectedSize.value.height}`);
      form.append("main_title", mainTitle);
      form.append("subtitle", subtitle);
      form.append("call_to_action", callToAction);
      form.append("background_style", backgroundStyle);
      form.append("main_title_position", mainTitlePosition);
      form.append("subtitle_position", subtitlePosition);
      form.append("call_to_action_position", callToActionPosition);
      form.append("logo_position", logoPosition);
      form.append("typography", selectedTypography.value);

      if (baseImageFile) {
        form.append("base_image", baseImageFile);
      }

      if (logoFile) {
        form.append("logo_file", logoFile);
      }

      setProgress(50);

      const res = await fetch("/api/text-overlay", {
        method: "POST",
        body: form
      });

      const json = await res.json();

      if (res.ok) {
        const imageUrl = json?.data?.images?.[0]?.url;
        if (imageUrl) {
          onResults([imageUrl]);
        }
      } else {
        console.error("Text Overlay Error:", json.error);
        alert(`Error: ${json.error}`);
      }

      setProgress(100);
    } catch (error) {
      console.error("Error:", error);
      alert("Error generating image: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsProcessing(false);
      onProcessingChange(false);
      setProgress(0);
    }
  };

  const clearAll = () => {
    setMainTitle("");
    setSubtitle("");
    setCallToAction("");
    setLogoFile(null);
    setLogoPreview("");
    setBaseImageFile(null);
    setBaseImagePreview("");
    setMainTitlePosition("top");
    setSubtitlePosition("center");
    setCallToActionPosition("bottom");
    setLogoPosition("top-left");
    setSelectedTypography(TYPOGRAPHY_OPTIONS[0]);
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
          TEXT OVERLAY
        </h2>
        <p style={{
          fontSize: 13,
          color: "#666",
          margin: 0,
          fontWeight: 400
        }}>
          AI-powered text and logo composition
        </p>
      </div>

      {/* Canvas Size Selection */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#888",
          marginBottom: 8,
          letterSpacing: "0.05em"
        }}>
          CANVAS SIZE
        </label>
        <select
          value={CANVAS_SIZES.findIndex(size => size === selectedSize)}
          onChange={e => setSelectedSize(CANVAS_SIZES[parseInt(e.target.value)])}
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
          {CANVAS_SIZES.map((size, index) => (
            <option key={size.label} value={index}>
              {size.label} ({size.value.width}×{size.value.height})
            </option>
          ))}
        </select>
      </div>

      {/* Typography Selection */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#888",
          marginBottom: 8,
          letterSpacing: "0.05em"
        }}>
          TYPOGRAPHY
        </label>
        <select
          value={TYPOGRAPHY_OPTIONS.findIndex(font => font === selectedTypography)}
          onChange={e => setSelectedTypography(TYPOGRAPHY_OPTIONS[parseInt(e.target.value)])}
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
          {TYPOGRAPHY_OPTIONS.map((font, index) => (
            <option key={font.value} value={index}>
              {font.label} - {font.description}
            </option>
          ))}
        </select>
      </div>

      {/* Base Image Upload */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#888",
          marginBottom: 8,
          letterSpacing: "0.05em"
        }}>
          BASE IMAGE (Optional)
        </label>
        <div style={{
          position: "relative",
          border: "2px dashed #333",
          borderRadius: "12px",
          padding: "20px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
          transition: "all 0.2s ease"
        }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleBaseImageSelect(e.target.files)}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer"
            }}
          />
          <div style={{ textAlign: "center" }}>
            {baseImagePreview ? (
              <div>
                <img
                  src={baseImagePreview}
                  alt="Base image preview"
                  style={{
                    maxWidth: 120,
                    maxHeight: 80,
                    marginBottom: 8,
                    borderRadius: 4,
                    objectFit: "cover"
                  }}
                />
                <div style={{ fontSize: 12, color: "#4CAF50", fontWeight: 500 }}>
                  Base image loaded ✓
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 20, marginBottom: 8, color: "#666" }}>□</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Drop image or click to upload
                </div>
                <div style={{ fontSize: 10, color: "#666" }}>
                  Optional - Add text overlay to your image
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Text Fields */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#888",
          marginBottom: 8,
          letterSpacing: "0.05em"
        }}>
          MAIN TITLE
        </label>
        <input
          type="text"
          value={mainTitle}
          onChange={e => setMainTitle(e.target.value)}
          placeholder="Enter your main headline..."
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "#111",
            border: "1px solid #333",
            borderRadius: "8px",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            outline: "none",
            marginBottom: 8
          }}
        />

        {mainTitle && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Position
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["top", "center", "bottom"] as const).map(position => (
                <button
                  key={position}
                  onClick={() => setMainTitlePosition(position)}
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                    background: mainTitlePosition === position ? "#8B5CF6" : "#222",
                    color: mainTitlePosition === position ? "#fff" : "#888",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    textTransform: "capitalize"
                  }}
                >
                  {position}
                </button>
              ))}
            </div>
          </div>
        )}

        <label style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#888",
          marginBottom: 8,
          letterSpacing: "0.05em"
        }}>
          SUBTITLE
        </label>
        <input
          type="text"
          value={subtitle}
          onChange={e => setSubtitle(e.target.value)}
          placeholder="Enter subtitle or description..."
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "#111",
            border: "1px solid #333",
            borderRadius: "8px",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            outline: "none",
            marginBottom: 8
          }}
        />

        {subtitle && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Position
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["top", "center", "bottom"] as const).map(position => (
                <button
                  key={position}
                  onClick={() => setSubtitlePosition(position)}
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                    background: subtitlePosition === position ? "#8B5CF6" : "#222",
                    color: subtitlePosition === position ? "#fff" : "#888",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    textTransform: "capitalize"
                  }}
                >
                  {position}
                </button>
              ))}
            </div>
          </div>
        )}

        <label style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#888",
          marginBottom: 8,
          letterSpacing: "0.05em"
        }}>
          CALL TO ACTION
        </label>
        <input
          type="text"
          value={callToAction}
          onChange={e => setCallToAction(e.target.value)}
          placeholder="Enter call to action text..."
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "#111",
            border: "1px solid #333",
            borderRadius: "8px",
            color: "#fff",
            fontSize: 14,
            fontWeight: 500,
            outline: "none",
            marginBottom: 8
          }}
        />

        {callToAction && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Position
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["top", "center", "bottom"] as const).map(position => (
                <button
                  key={position}
                  onClick={() => setCallToActionPosition(position)}
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                    background: callToActionPosition === position ? "#8B5CF6" : "#222",
                    color: callToActionPosition === position ? "#fff" : "#888",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    textTransform: "capitalize"
                  }}
                >
                  {position}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Background Style */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#888",
          marginBottom: 8,
          letterSpacing: "0.05em"
        }}>
          BACKGROUND STYLE
        </label>
        <div style={{ marginTop: 6 }}>
          {(["gradient", "solid", "minimal"] as const).map(style => (
            <button
              key={style}
              onClick={() => setBackgroundStyle(style)}
              style={{
                marginRight: 8,
                marginBottom: 4,
                padding: "8px 12px",
                background: backgroundStyle === style ? "#8B5CF6" : "#222",
                color: backgroundStyle === style ? "#fff" : "#eee",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                transition: "all 0.2s ease",
                textTransform: "capitalize"
              }}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Logo Upload */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "#888",
          marginBottom: 8,
          letterSpacing: "0.05em"
        }}>
          LOGO (PNG)
        </label>
        <div style={{
          position: "relative",
          border: "2px dashed #333",
          borderRadius: "12px",
          padding: "20px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
          transition: "all 0.2s ease"
        }}>
          <input
            type="file"
            accept="image/png"
            onChange={(e) => handleLogoSelect(e.target.files)}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer"
            }}
          />
          <div style={{ textAlign: "center" }}>
            {logoPreview ? (
              <div>
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  style={{
                    maxWidth: 80,
                    maxHeight: 80,
                    marginBottom: 8,
                    borderRadius: 4
                  }}
                />
                <div style={{ fontSize: 12, color: "#4CAF50", fontWeight: 500 }}>
                  Logo cargado ✓
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 20, marginBottom: 8, color: "#666" }}>○</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Drop PNG logo or click to upload
                </div>
                <div style={{ fontSize: 10, color: "#666" }}>
                  Optional - for brand integration
                </div>
              </div>
            )}
          </div>
        </div>

        {logoFile && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Logo Position
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map(position => (
                <button
                  key={position}
                  onClick={() => setLogoPosition(position)}
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                    background: logoPosition === position ? "#8B5CF6" : "#222",
                    color: logoPosition === position ? "#fff" : "#888",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    textTransform: "capitalize"
                  }}
                >
                  {position.replace("-", " ")}
                </button>
              ))}
            </div>
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
              fontWeight: 600,
              color: "#888",
              letterSpacing: "0.05em"
            }}>
              GENERANDO DISEÑO
            </span>
            <span style={{
              fontSize: 11,
              color: "#666"
            }}>
              {Math.round(progress)}%
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
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateImage}
        disabled={isProcessing || (!baseImageFile && !mainTitle && !subtitle && !callToAction)}
        style={{
          width: "100%",
          padding: "16px 24px",
          borderRadius: "12px",
          background: (isProcessing || (!baseImageFile && !mainTitle && !subtitle && !callToAction)) ?
            "linear-gradient(135deg, #333 0%, #444 100%)" :
            "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
          color: (isProcessing || (!baseImageFile && !mainTitle && !subtitle && !callToAction)) ? "#666" : "#fff",
          border: "none",
          cursor: (isProcessing || (!baseImageFile && !mainTitle && !subtitle && !callToAction)) ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.02em",
          transition: "all 0.2s ease",
          marginBottom: 16
        }}
      >
        {isProcessing ? "GENERATING DESIGN..." : baseImageFile ? "ADD TEXT OVERLAY" : "GENERATE TEXT OVERLAY"}
      </button>

      {/* Clear Button */}
      <button
        onClick={clearAll}
        style={{
          width: "100%",
          padding: "12px 24px",
          borderRadius: "8px",
          background: "transparent",
          color: "#666",
          border: "1px solid #333",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.02em",
          transition: "all 0.2s ease",
          marginBottom: 32
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
        CLEAR ALL
      </button>

      {/* Features Info */}
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
          <div style={{ marginBottom: 8 }}>• AI-powered text layout and typography</div>
          <div style={{ marginBottom: 8 }}>• Smart logo integration and placement</div>
          <div style={{ marginBottom: 8 }}>• Multiple social media format presets</div>
          <div>• Professional design generation with Seedream AI</div>
        </div>
      </div>
    </div>
  );
}