"use client";

import { useState } from "react";

type RecoveryCodeCardProps = {
  code: string;
  title?: string;
  note?: string;
};

/**
 * Shows a recovery code once, with a large copy button.
 * The code is never stored in clear on the server, so it cannot be displayed again.
 */
export function RecoveryCodeCard({
  code,
  title = "Votre code de secours",
  note = "Gardez ce code en lieu sûr (papier, carnet). Il vous permet de retrouver votre accès si vous oubliez votre mot de passe. Il ne sera plus affiché ensuite.",
}: RecoveryCodeCardProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the code is selectable on screen (user-select: all).
      setCopied(false);
    }
  }

  return (
    <section className="recovery-card" aria-label={title}>
      <p className="recovery-kicker">À NOTER MAINTENANT</p>
      <h3 className="recovery-title">{title}</h3>
      <p className="recovery-note">{note}</p>
      <div className="recovery-code">{code}</div>
      <button type="button" className="button button-primary recovery-copy" onClick={() => void copy()}>
        {copied ? "Code copié ✔" : "Copier le code"}
      </button>
    </section>
  );
}
