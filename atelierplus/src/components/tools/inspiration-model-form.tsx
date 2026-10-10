"use client";

import { useState } from "react";
import { GARMENT_TEMPLATES, MEASUREMENT_CATALOG } from "@/lib/atelier-types";
import type { InspirationModelDraft } from "@/lib/atelier-types";

function makeId() {
  return globalThis.crypto.randomUUID();
}

/** Compresses a customer-selected photo locally before it goes to IndexedDB/Postgres. */
async function compressImage(file: File): Promise<{ data: string; name: string }> {
  if (!file.type.startsWith("image/")) throw new Error("Choisissez une image (JPEG, PNG ou WebP).");
  if (file.size > 12_000_000) throw new Error("Cette photo dépasse 12 Mo. Choisissez une image plus légère.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Impossible de lire cette photo."));
      element.src = objectUrl;
    });

    let maxSide = 1280;
    let quality = 0.82;
    let result = "";
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const canvas = window.document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Votre appareil ne peut pas compresser cette photo.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      result = canvas.toDataURL("image/jpeg", quality);
      const bytes = Math.ceil((result.length - result.indexOf(",") - 1) * 0.75);
      if (bytes <= 900_000) break;
      maxSide = Math.round(maxSide * 0.76);
      quality -= 0.1;
    }
    const finalBytes = Math.ceil((result.length - result.indexOf(",") - 1) * 0.75);
    if (finalBytes > 1_050_000) throw new Error("La photo reste trop lourde après compression. Recadrez-la puis réessayez.");
    return { data: result, name: file.name.slice(0, 120) };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function InspirationModelForm({
  onSave,
  onCancel,
}: {
  onSave: (draft: InspirationModelDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [garment, setGarment] = useState<string>(GARMENT_TEMPLATES[0].value);
  const [description, setDescription] = useState("");
  const [advice, setAdvice] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleCode(code: string) {
    setCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  async function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    setError("");
    try {
      const compressed = await compressImage(file);
      setImageData(compressed.data);
      setImageName(compressed.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de préparer cette photo.");
    } finally {
      setImageBusy(false);
      event.target.value = "";
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 2) return;
    setBusy(true);
    try {
      await onSave({
      id: makeId(),
      title: title.trim(),
      garment,
      description: description.trim() || null,
      advice: advice.trim() || null,
      imageData,
      imageName,
      measureCodes: codes,
      createdAt: new Date().toISOString(),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le modèle n’a pas pu être enregistré. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="app-form inspiration-form" onSubmit={submit}>
      <div className="inspiration-upload">
        {imageData ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageData} alt="Aperçu du modèle" />
            <button type="button" className="button button-light button-sm" onClick={() => { setImageData(null); setImageName(null); }}>
              Retirer la photo
            </button>
          </>
        ) : (
          <label className="inspiration-upload-drop">
            <span>📷</span>
            <b>{imageBusy ? "Compression de la photo…" : "Ajouter une photo (facultatif)"}</b>
            <small>JPEG, PNG ou WebP · compressée sur votre téléphone · max 12 Mo avant compression</small>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} disabled={imageBusy} />
          </label>
        )}
      </div>

      <label className="field-label">Nom du modèle *
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Robe sirène brodée" required minLength={2} maxLength={100} />
      </label>
      <label className="field-label">Type de vêtement *
        <select value={garment} onChange={(event) => setGarment(event.target.value)}>
          {GARMENT_TEMPLATES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="field-label">Description
        <textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex. Taille cintrée, manches ballon, fente arrière…" maxLength={1200} />
      </label>
      <label className="field-label">Conseil de confection
        <textarea rows={2} value={advice} onChange={(event) => setAdvice(event.target.value)} placeholder="Ex. Prévoir une doublure et faire un essayage intermédiaire." maxLength={1200} />
      </label>
      <fieldset className="model-measure-picker">
        <legend>Mesures utiles au modèle</legend>
        <p>Facultatif : sélectionnez les codes que vous voulez rappeler pour ce modèle.</p>
        <div>
          {MEASUREMENT_CATALOG.map((measure) => (
            <button key={measure.code} type="button" className={`model-code-toggle ${codes.includes(measure.code) ? "model-code-active" : ""}`} onClick={() => toggleCode(measure.code)}>
              {measure.code}
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p className="recover-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button button-quiet" onClick={onCancel}>Annuler</button>
        <button type="submit" className="button button-primary" disabled={busy || imageBusy || title.trim().length < 2}>
          {busy ? "Ajout…" : "Ajouter au catalogue"}
        </button>
      </div>
    </form>
  );
}

