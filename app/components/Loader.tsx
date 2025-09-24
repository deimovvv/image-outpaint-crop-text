"use client";

import { useEffect, useState } from "react";

export default function Loader() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Hide loader after 2 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#0A0A0A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24
      }}>
        {/* Animated Logo/Icon */}
        <div style={{
          width: 80,
          height: 80,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          {/* Outer spinning ring */}
          <div style={{
            position: "absolute",
            width: 80,
            height: 80,
            border: "3px solid transparent",
            borderTop: "3px solid #DFBBFE",
            borderRight: "3px solid #DFBBFE",
            borderRadius: "50%",
            animation: "spin 2s linear infinite"
          }} />

          {/* Inner pulsing circle */}
          <div style={{
            width: 40,
            height: 40,
            background: "linear-gradient(135deg, #DFBBFE 0%, #C8A2FE 100%)",
            borderRadius: "50%",
            animation: "pulse 1.5s ease-in-out infinite",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20
          }}>
            ✨
          </div>
        </div>

        {/* Loading text */}
        <div style={{
          textAlign: "center"
        }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            margin: 0,
            color: "#EAE8E4",
            letterSpacing: "-0.02em",
            marginBottom: 8
          }}>
            AI IMAGE STUDIO
          </h1>
          <div style={{
            fontSize: 12,
            color: "#DFBBFE",
            fontWeight: 500,
            letterSpacing: "0.1em",
            opacity: 0.8
          }}>
            LOADING...
          </div>
        </div>

        {/* Loading dots */}
        <div style={{
          display: "flex",
          gap: 8,
          alignItems: "center"
        }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                background: "#DFBBFE",
                borderRadius: "50%",
                animation: `bounce 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.16}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}