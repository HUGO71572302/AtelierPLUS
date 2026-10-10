"use client";

import { useEffect } from "react";

/** Last-resort app error screen. It replaces the browser/platform generic error page. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AtelierPLUS] application error", error);
  }, [error]);

  return (
    <main className="app-error-shell">
      <section className="app-error-card">
        <span className="app-error-mark">✂</span>
        <p className="eyebrow">ATELIERPLUS</p>
        <h1>Cette section a rencontré un problème.</h1>
        <p>
          Vos données déjà enregistrées ne sont pas effacées. Réessayez : l’application recharge uniquement cette page.
        </p>
        <div className="app-error-actions">
          <button type="button" className="button button-primary" onClick={reset}>
            Réessayer
          </button>
          <button type="button" className="button button-light" onClick={() => window.location.assign("/")}>
            Retourner à l’accueil
          </button>
        </div>
        <small>Si le problème revient, ouvrez « Plus d’options » puis essayez un seul outil à la fois.</small>
      </section>
    </main>
  );
}
