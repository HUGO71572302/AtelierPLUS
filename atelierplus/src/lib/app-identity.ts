/**
 * Application identity and author signature.
 * Centralised so the footer, the about panel and the manifest stay consistent.
 * The author is never printed on receipts: they belong to the workshop.
 */
export const APP_IDENTITY = {
  name: "AtelierPLUS",
  tagline: "LE GESTE BIEN GÉRÉ",
  version: "1.0.0",

  author: {
    fullName: "Atissoli KABRAME",
    role: "FabManager",
    photo: "/images/auteur.jpg",
    phones: [
      { label: "Ligne principale", value: "+228 96933893" },
      { label: "Autre ligne", value: "+228 71572302" },
    ],
  },

} as const;
