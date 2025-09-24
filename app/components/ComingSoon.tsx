"use client";

interface ComingSoonProps {
  onResults: (results: string[]) => void;
  onProcessingChange: (isProcessing: boolean) => void;
}

export default function ComingSoon({ onResults, onProcessingChange }: ComingSoonProps) {
  return (
    <div style={{
      padding: 32,
      background: "#000",
      color: "#fff",
      minHeight: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        textAlign: "center",
        maxWidth: 400
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 24,
          opacity: 0.3
        }}>
          ⏳
        </div>
        <h2 style={{
          fontSize: 24,
          fontWeight: 300,
          marginBottom: 12,
          color: "#fff",
          letterSpacing: "0.02em"
        }}>
          Coming Soon
        </h2>
        <p style={{
          fontSize: 14,
          color: "#666",
          margin: 0,
          lineHeight: 1.6,
          fontWeight: 300
        }}>
          Text overlay functionality is currently in development.
          Stay tuned for intelligent text placement and styling options.
        </p>
      </div>
    </div>
  );
}