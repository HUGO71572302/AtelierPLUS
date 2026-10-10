"use client";

import { APP_IDENTITY } from "@/lib/app-identity";

function Glyph({ children, size = 20 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** About panel: who built the application, how to reach the author, and what is stored where. */
export function AboutPanel({ userRole }: { userRole: "owner" | "member" }) {
  const isOwner = userRole === "owner";
  const { author } = APP_IDENTITY;

  return (
    <div className="tools-view about-view">
      <section className="about-hero">
        <div className="about-mark"><Glyph size={30}><path d="M19 5 5 19M14.5 3.5l6 6M6 4l14 16M5 18l1 1" /><circle cx="16" cy="6" r="1" /></Glyph></div>
        <h2>{APP_IDENTITY.name}</h2>
        <p className="about-tagline">{APP_IDENTITY.tagline}</p>
        <span className="about-version">Version {APP_IDENTITY.version} · Application installable</span>
      </section>

      <section className="stat-block about-signature">
        <p className="catalog-eyebrow">CONÇU ET DÉVELOPPÉ PAR</p>
        <div className="signature-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="signature-photo" src={author.photo} alt={`Photo de ${author.fullName}`} width={72} height={72} />
          <div className="signature-identity">
            <h3>{author.fullName}</h3>
            <span className="signature-role">{author.role}</span>
            <div className="signature-phones">
              {author.phones.map((phone) => (
                <a key={phone.value} className="signature-phone" href={`tel:${phone.value}`}>
                  <Glyph size={15}><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM10 17h4" /></Glyph>
                  <span>
                    <b>{phone.value}</b>
                    <small>{phone.label}</small>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
        <p className="about-signature-note">
          Cette application a été pensée pour les ateliers de couture d’Afrique francophone : simple, en français, utilisable hors-ligne et adaptée aux montants en FCFA.
        </p>
      </section>

      <section className="stat-block about-section">
        <h3>Vos données, simplement</h3>
        <ul className="about-list">
          <li>Vos clients, commandes et mesures sont enregistrés sur le serveur de votre atelier.</li>
          <li>L’application garde aussi une copie sur l’appareil pour fonctionner sans internet.</li>
          <li>Chaque saisie hors-ligne est envoyée automatiquement dès le retour du réseau.</li>
          <li>Le patron peut exporter une sauvegarde complète à tout moment.</li>
        </ul>
      </section>

      <section className="stat-block about-section">
        <h3>Accès et confidentialité</h3>
        <ul className="about-list">
          <li>Le patron voit l’ensemble de l’atelier : commandes, soldes et dépenses.</li>
          <li>Les membres saisissent commandes, mesures et paiements, sans accès aux finances.</li>
          <li>Les mots de passe sont stockés sous forme sécurisée et ne sont jamais affichés.</li>
          <li>La synchronisation est protégée : chaque opération est vérifiée côté serveur.</li>
        </ul>
      </section>

      {!isOwner && (
        <p className="about-member-note">
          Vous utilisez un compte membre. Pour la gestion des accès, des finances et des sauvegardes, rapprochez-vous du patron de l’atelier.
        </p>
      )}

      <footer className="about-footer">
        <span>{APP_IDENTITY.name} · {APP_IDENTITY.tagline}</span>
        <span>© {new Date().getFullYear()} {author.fullName} — {author.role}</span>
      </footer>
    </div>
  );
}
