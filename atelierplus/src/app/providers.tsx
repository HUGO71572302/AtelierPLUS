"use client";

import type { ReactNode } from "react";
import { EnvironmentGuard } from "@/components/EnvironmentGuard";
import { SessionManager } from "@/components/SessionManager";
import { PrintProvider } from "@/components/print/print-document";

/**
 * Persistent client providers shared by every route and modal.
 * Printing is unconditional: never mount it inside an individual screen,
 * authentication branch, or tool. Merely importing PrintProvider is not enough.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PrintProvider>
      <EnvironmentGuard>
        <SessionManager />
        {children}
      </EnvironmentGuard>
    </PrintProvider>
  );
}
