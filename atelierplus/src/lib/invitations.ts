import { createHash, randomBytes } from "node:crypto";

// No 0/O/1/I/L to avoid confusion when a code is read aloud or copied by hand.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITATION_LIFETIME_DAYS = 7;

export function generateInvitationCode(): string {
  const bytes = randomBytes(10);
  let code = "";
  for (let index = 0; index < bytes.length; index += 1) {
    code += ALPHABET[bytes[index] % ALPHABET.length];
    if (index === 4) code += "-";
  }
  return code;
}

export function normalizeInvitationCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashInvitationCode(value: string): string {
  return createHash("sha256").update(normalizeInvitationCode(value)).digest("hex");
}
