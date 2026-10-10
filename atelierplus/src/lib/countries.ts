/**
 * Countries offered by the phone fields. Togo is the default everywhere.
 * Pure helpers only (no browser or Node API) so the server can reuse them.
 */
export type Country = { iso: string; name: string; dial: string };

export const DEFAULT_COUNTRY_ISO = "TG";

export const COUNTRIES: Country[] = [
  // Togo first, then its neighbours, then the rest of Africa, then the rest of the world.
  { iso: "TG", name: "Togo", dial: "228" },
  { iso: "BJ", name: "Bénin", dial: "229" },
  { iso: "GH", name: "Ghana", dial: "233" },
  { iso: "BF", name: "Burkina Faso", dial: "226" },
  { iso: "CI", name: "Côte d’Ivoire", dial: "225" },
  { iso: "NE", name: "Niger", dial: "227" },
  { iso: "NG", name: "Nigeria", dial: "234" },
  { iso: "ML", name: "Mali", dial: "223" },
  { iso: "SN", name: "Sénégal", dial: "221" },
  { iso: "GN", name: "Guinée", dial: "224" },
  { iso: "GM", name: "Gambie", dial: "220" },
  { iso: "GW", name: "Guinée-Bissau", dial: "245" },
  { iso: "LR", name: "Libéria", dial: "231" },
  { iso: "SL", name: "Sierra Leone", dial: "232" },
  { iso: "MR", name: "Mauritanie", dial: "222" },
  { iso: "CV", name: "Cap-Vert", dial: "238" },
  { iso: "CM", name: "Cameroun", dial: "237" },
  { iso: "GA", name: "Gabon", dial: "241" },
  { iso: "CG", name: "Congo", dial: "242" },
  { iso: "CD", name: "RD Congo", dial: "243" },
  { iso: "TD", name: "Tchad", dial: "235" },
  { iso: "CF", name: "Centrafrique", dial: "236" },
  { iso: "GQ", name: "Guinée équatoriale", dial: "240" },
  { iso: "ST", name: "São Tomé-et-Príncipe", dial: "239" },
  { iso: "AO", name: "Angola", dial: "244" },
  { iso: "BI", name: "Burundi", dial: "257" },
  { iso: "RW", name: "Rwanda", dial: "250" },
  { iso: "DJ", name: "Djibouti", dial: "253" },
  { iso: "KM", name: "Comores", dial: "269" },
  { iso: "MG", name: "Madagascar", dial: "261" },
  { iso: "MU", name: "Maurice", dial: "230" },
  { iso: "KE", name: "Kenya", dial: "254" },
  { iso: "ET", name: "Éthiopie", dial: "251" },
  { iso: "TZ", name: "Tanzanie", dial: "255" },
  { iso: "UG", name: "Ouganda", dial: "256" },
  { iso: "ZA", name: "Afrique du Sud", dial: "27" },
  { iso: "MA", name: "Maroc", dial: "212" },
  { iso: "DZ", name: "Algérie", dial: "213" },
  { iso: "TN", name: "Tunisie", dial: "216" },
  { iso: "LY", name: "Libye", dial: "218" },
  { iso: "EG", name: "Égypte", dial: "20" },
  { iso: "FR", name: "France", dial: "33" },
  { iso: "BE", name: "Belgique", dial: "32" },
  { iso: "CH", name: "Suisse", dial: "41" },
  { iso: "DE", name: "Allemagne", dial: "49" },
  { iso: "GB", name: "Royaume-Uni", dial: "44" },
  { iso: "ES", name: "Espagne", dial: "34" },
  { iso: "IT", name: "Italie", dial: "39" },
  { iso: "PT", name: "Portugal", dial: "351" },
  { iso: "NL", name: "Pays-Bas", dial: "31" },
  { iso: "CA", name: "Canada", dial: "1" },
  { iso: "US", name: "États-Unis", dial: "1" },
  { iso: "HT", name: "Haïti", dial: "509" },
  { iso: "BR", name: "Brésil", dial: "55" },
  { iso: "AE", name: "Émirats arabes unis", dial: "971" },
  { iso: "SA", name: "Arabie saoudite", dial: "966" },
  { iso: "LB", name: "Liban", dial: "961" },
  { iso: "TR", name: "Turquie", dial: "90" },
  { iso: "IN", name: "Inde", dial: "91" },
  { iso: "CN", name: "Chine", dial: "86" },
];

const BY_DIAL_LENGTH = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

export function findCountry(iso: string | null | undefined): Country {
  return COUNTRIES.find((country) => country.iso === iso) ?? COUNTRIES[0];
}

/** Flag emoji built from the ISO code. */
export function flagEmoji(iso: string): string {
  if (!/^[A-Z]{2}$/.test(iso)) return "🌐";
  return String.fromCodePoint(...[...iso].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

function matchDial(digitsWithDial: string): Country | null {
  return BY_DIAL_LENGTH.find((country) => digitsWithDial.startsWith(country.dial)) ?? null;
}

/** "+22890123456" or "0022890123456" → country + national number. Null when not international. */
export function parseInternational(value: string): { iso: string; national: string } | null {
  const raw = value.trim();
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);
  else if (!raw.startsWith("+")) return null;
  const country = matchDial(digits);
  if (!country) return null;
  return { iso: country.iso, national: digits.slice(country.dial.length) };
}

/** Compact international number, e.g. TG + "90 12 34 56" → "+22890123456". Empty when no digits. */
export function buildPhone(iso: string, national: string): string {
  const digits = national.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return `+${findCountry(iso).dial}${digits}`;
}

/** Togo numbers have exactly 8 digits; other countries accept 6 to 13 national digits. */
export function isPhoneComplete(phone: string): boolean {
  const parsed = parseInternational(phone);
  if (!parsed) return phone.replace(/\D/g, "").length >= 6;
  if (parsed.iso === "TG") return parsed.national.length === 8;
  return parsed.national.length >= 6 && parsed.national.length <= 13;
}

/**
 * Values under which the same number may already be stored. Accounts created before the
 * country selector existed kept Togolese numbers without "+228", so Togo also matches them.
 */
export function phoneVariants(normalized: string): string[] {
  const variants = new Set([normalized]);
  const parsed = parseInternational(normalized);
  if (parsed?.iso === DEFAULT_COUNTRY_ISO) variants.add(parsed.national);
  return [...variants];
}

/**
 * Digits to pass to WhatsApp (country code included), or null when the number is unusable.
 * An 8-digit number without country code is a Togolese number typed before the selector existed.
 */
export function whatsappDigits(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") || raw.startsWith("00")) {
    if (raw.startsWith("00")) digits = digits.slice(2);
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }
  const national = digits.replace(/^0+/, "");
  if (national.length === 8) return `228${national}`;
  return digits.length >= 11 && digits.length <= 15 && !digits.startsWith("0") ? digits : null;
}
