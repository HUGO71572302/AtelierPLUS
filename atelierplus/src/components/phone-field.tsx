"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES, DEFAULT_COUNTRY_ISO, buildPhone, findCountry, flagEmoji, parseInternational } from "@/lib/countries";

type PhoneFieldProps = {
  /** Full international number such as "+22890123456", or "" when empty. */
  value: string;
  onChange: (phone: string) => void;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
};

/**
 * Country selector + national number. Togo is selected by default.
 * Emits a compact international number; pasting "+228 90 12 34 56" also switches the country.
 */
export function PhoneField({ value, onChange, disabled, required, autoFocus, placeholder = "90 12 34 56" }: PhoneFieldProps) {
  const initial = value ? parseInternational(value) : null;
  const [iso, setIso] = useState(initial?.iso ?? DEFAULT_COUNTRY_ISO);
  const [national, setNational] = useState(initial?.national ?? "");
  const lastEmitted = useRef(value);

  // The parent may reset or replace the value (after saving a form, for example).
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (!value) {
      setNational("");
      return;
    }
    const parsed = parseInternational(value);
    if (parsed) {
      setIso(parsed.iso);
      setNational(parsed.national);
    }
  }, [value]);

  function emit(nextIso: string, nextNational: string) {
    const next = buildPhone(nextIso, nextNational);
    lastEmitted.current = next;
    onChange(next);
  }

  function changeNational(raw: string) {
    const pasted = parseInternational(raw);
    if (pasted) {
      setIso(pasted.iso);
      setNational(pasted.national);
      emit(pasted.iso, pasted.national);
      return;
    }
    const cleaned = raw.replace(/[^\d\s.-]/g, "");
    setNational(cleaned);
    emit(iso, cleaned);
  }

  function changeCountry(nextIso: string) {
    setIso(nextIso);
    emit(nextIso, national);
  }

  const country = findCountry(iso);
  return (
    <div className="phone-field">
      <div className="phone-country">
        <span aria-hidden="true">{flagEmoji(country.iso)} +{country.dial} ▾</span>
        <select aria-label="Pays du numéro" value={iso} onChange={(event) => changeCountry(event.target.value)} disabled={disabled}>
          {COUNTRIES.map((item) => (
            <option key={item.iso} value={item.iso}>{flagEmoji(item.iso)} {item.name} (+{item.dial})</option>
          ))}
        </select>
      </div>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        value={national}
        onChange={(event) => changeNational(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-label="Numéro de téléphone"
      />
    </div>
  );
}
