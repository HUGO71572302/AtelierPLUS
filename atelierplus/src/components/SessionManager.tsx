"use client";

import { useEffect } from "react";
import { getStoredToken, saveStoredToken, clearStoredToken } from "@/lib/api-client";

const BROADCAST_CHANNEL = "atelierplus-session";

/**
 * Manages session synchronization across tabs using BroadcastChannel.
 * Also recovers tokens from URL parameters (when opened in new tab).
 *
 * Listens for messages from api-client.ts and broadcasts back when other
 * tabs request the token.
 */
export function SessionManager() {
  useEffect(() => {
    // 1. Recover token from URL if present (new tab scenario)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const urlToken = url.searchParams.get("__session_token");
      if (urlToken) {
        console.log("[SessionManager] Recovering token from URL");
        saveStoredToken(urlToken);
        // Clean up URL
        url.searchParams.delete("__session_token");
        window.history.replaceState({}, "", url.toString());
      }
    }

    // 2. Set up cross-tab sync using the SAME channel as api-client.ts
    if (typeof BroadcastChannel === "undefined") {
      console.log("[SessionManager] BroadcastChannel not supported");
      return;
    }

    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL);
    } catch (error) {
      console.log("[SessionManager] Failed to open channel:", error);
      return;
    }

    channel.onmessage = (event) => {
      const message = event.data;
      switch (message?.type) {
        case "token_updated":
          console.log("[SessionManager] Token updated from another tab");
          // Save to all storage layers in this tab
          const currentToken = getStoredToken();
          if (currentToken !== message.token) {
            saveStoredToken(message.token);
            window.dispatchEvent(new CustomEvent("session-token-updated"));
          }
          break;

        case "token_cleared":
          console.log("[SessionManager] Token cleared from another tab");
          if (getStoredToken()) {
            clearStoredToken();
            window.dispatchEvent(new CustomEvent("session-token-cleared"));
          }
          break;

        case "request_token": {
          // Another tab is asking for the token
          const myToken = getStoredToken();
          if (myToken) {
            console.log("[SessionManager] Sharing token with requesting tab");
            channel.postMessage({ type: "token_updated", token: myToken });
          }
          break;
        }
      }
    };

    // 3. Request token from other tabs if we don't have one
    const currentToken = getStoredToken();
    if (!currentToken) {
      console.log("[SessionManager] No token, requesting from other tabs");
      try {
        channel.postMessage({ type: "request_token" });
      } catch {
        // Channel might be closed
      }
    }

    return () => {
      try {
        channel.close();
      } catch {
        // Already closed
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
}
