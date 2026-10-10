"use client";

import { useEffect, useState } from "react";
import { detectEnvironment } from "@/lib/environment-detector";
import { getStoredToken, saveStoredToken } from "@/lib/api-client";

const BROADCAST_CHANNEL = "atelierplus-session";

interface EnvironmentGuardProps {
  children: React.ReactNode;
}

export function EnvironmentGuard({ children }: EnvironmentGuardProps) {
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const env = detectEnvironment();
    console.log("[EnvironmentGuard] Environment:", env);

    // Check URL for token first (new tab scenario)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const urlToken = url.searchParams.get("__session_token");
      if (urlToken) {
        console.log("[EnvironmentGuard] Token found in URL, saving");
        saveStoredToken(urlToken);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBlocked(false);
        setChecking(false);
        return;
      }
    }

    // If we have a token already, we're good
    const existingToken = getStoredToken();
    if (existingToken) {
      console.log("[EnvironmentGuard] Token already available");
      setBlocked(false);
      setChecking(false);
      return;
    }

    // Try to recover token from other tabs via BroadcastChannel
    if (typeof BroadcastChannel !== "undefined" && !existingToken) {
      let channel: BroadcastChannel;
      try {
        channel = new BroadcastChannel(BROADCAST_CHANNEL);
      } catch {
        // BroadcastChannel unavailable
        if (env.isBlockedEnvironment) {
          setBlocked(true);
        }
        setChecking(false);
        return;
      }

      const timeout = setTimeout(() => {
        try {
          channel.close();
        } catch {
          // Already closed
        }
        // Check if we got a token
        const token = getStoredToken();
        if (token) {
          setBlocked(false);
        } else if (env.isBlockedEnvironment) {
          setBlocked(true);
        }
        setChecking(false);
      }, 600);

      channel.onmessage = (event) => {
        const message = event.data;
        if (message?.type === "token_updated" && message.token) {
          console.log("[EnvironmentGuard] Token recovered from another tab");
          saveStoredToken(message.token);
          clearTimeout(timeout);
          try {
            channel.close();
          } catch {
            // Already closed
          }
          setBlocked(false);
          setChecking(false);
        }
      };

      // Request token from other tabs
      try {
        channel.postMessage({ type: "request_token" });
      } catch {
        clearTimeout(timeout);
        try {
          channel.close();
        } catch {
          // Already closed
        }
        if (env.isBlockedEnvironment) {
          setBlocked(true);
        }
        setChecking(false);
      }
    } else {
      if (env.isBlockedEnvironment) {
        setBlocked(true);
      }
      setChecking(false);
    }
  }, []);

  const handleOpenNewTab = () => {
    const token = getStoredToken();
    const url = new URL(window.location.href);
    if (token) {
      url.searchParams.set("__session_token", token);
    }
    const newWindow = window.open(url.toString(), "_blank");
    if (!newWindow) {
      // Popup blocked - show manual instructions
      const fallbackUrl = url.toString();
      prompt(
        "Votre navigateur a bloqué l\u2019ouverture du nouvel onglet. Copiez ce lien et collez-le dans un nouvel onglet :",
        fallbackUrl,
      );
    }
  };

  if (checking) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "linear-gradient(135deg, #f7f8f4 0%, #e9ebe4 100%)",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            fontSize: "48px",
            marginBottom: "16px",
            display: "inline-block",
            animation: "spin 2s linear infinite",
          }}>✂️</div>
          <div style={{ fontSize: "18px", color: "#26322d", fontWeight: "600" }}>
            Préparation de votre atelier...
          </div>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (blocked) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        padding: "24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "linear-gradient(135deg, #2f4438 0%, #26322d 100%)",
      }}>
        <div style={{
          maxWidth: "520px",
          background: "white",
          borderRadius: "20px",
          padding: "44px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "72px",
            marginBottom: "20px",
            display: "inline-block",
            animation: "bounce 2s ease-in-out infinite",
          }}>🧵</div>
          <style>{`
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }
          `}</style>
          <h1 style={{
            fontSize: "30px",
            fontWeight: "bold",
            marginBottom: "16px",
            color: "#26322d",
            letterSpacing: "-0.5px",
          }}>
            Un coup de pouce pour votre atelier
          </h1>
          <p style={{
            fontSize: "16px",
            lineHeight: "1.7",
            color: "#4a5568",
            marginBottom: "32px",
          }}>
            Votre navigateur restreint l\u2019exécution d\u2019AtelierPLUS dans cette fenêtre.
            Ouvrez-le dans un nouvel onglet pour profiter de toutes les fonctionnalités.
          </p>
          <button
            onClick={handleOpenNewTab}
            style={{
              background: "linear-gradient(135deg, #c9ea7b 0%, #9cb865 100%)",
              color: "#26322d",
              border: "none",
              borderRadius: "14px",
              padding: "18px 36px",
              fontSize: "18px",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 6px 16px rgba(156, 184, 101, 0.4)",
              transition: "transform 0.2s, box-shadow 0.2s",
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 22px rgba(156, 184, 101, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(156, 184, 101, 0.4)";
            }}
          >
            <span>Ouvrir dans un nouvel onglet</span>
            <span style={{ fontSize: "22px" }}>↗</span>
          </button>
          <div style={{
            marginTop: "28px",
            padding: "16px",
            background: "#f7f9f3",
            borderRadius: "12px",
            fontSize: "14px",
            color: "#4a5568",
            textAlign: "left",
            lineHeight: "1.6",
            border: "1px solid #e9ebe4",
          }}>
            <strong style={{ color: "#26322d" }}>💡 Pourquoi ?</strong>
            <br />
            Certains navigateurs bloquent la mémorisation de votre connexion dans les fenêtres intégrées.
            Dans un nouvel onglet, tout fonctionne normalement.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
