"use client";

import { useRef, useState } from "react";

type Point = { x: number; y: number };

const CALIBRATION_PRESETS = [
  { label: "Carte bancaire", cm: 8.56 },
  { label: "Feuille A4 (largeur)", cm: 21 },
  { label: "Règle 30 cm", cm: 30 },
  { label: "Mètre ruban", cm: 100 },
];

function distance(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function angle(a: Point, b: Point) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function percent(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

/**
 * Estimation of a body measurement from a photo.
 * The user calibrates the photo with an object of known length (bank card,
 * ruler), then taps two points: pixels are converted to centimetres.
 * Everything runs in the browser, offline: no photo is ever uploaded.
 */
export function PhotoMeasure() {
  const [image, setImage] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  /** Endpoints of the reference object. Two points = calibration complete. */
  const [referencePoints, setReferencePoints] = useState<Point[]>([]);
  const [referenceCm, setReferenceCm] = useState<number>(CALIBRATION_PRESETS[0].cm);
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [result, setResult] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const imageRef = useRef<HTMLImageElement | null>(null);

  const calibrationDone = referencePoints.length === 2;

  function measure(points: Point[]) {
    if (points.length !== 2 || referencePoints.length !== 2) {
      setResult(null);
      return;
    }
    const referencePx = distance(referencePoints[0], referencePoints[1]);
    const measuredPx = distance(points[0], points[1]);
    setResult(referencePx > 0 ? (measuredPx / referencePx) * referenceCm : null);
  }

  function pickPoint(event: React.MouseEvent<HTMLImageElement>) {
    const element = imageRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const point: Point = {
      x: ((event.clientX - rect.left) / rect.width) * naturalSize.width,
      y: ((event.clientY - rect.top) / rect.height) * naturalSize.height,
    };

    if (!calibrationDone) {
      setReferencePoints((current) => [...current, point].slice(-2));
      setMeasurePoints([]);
      setResult(null);
      return;
    }

    const points = [...measurePoints, point].slice(-2);
    setMeasurePoints(points);
    measure(points);
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setReferencePoints([]);
      setMeasurePoints([]);
      setResult(null);
      setNote("");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function resetAll() {
    setImage(null);
    setReferencePoints([]);
    setMeasurePoints([]);
    setResult(null);
    setNote("");
  }

  function markerStyle(point: Point): React.CSSProperties {
    return {
      left: percent(point.x, naturalSize.width),
      top: percent(point.y, naturalSize.height),
    };
  }

  function lineStyle(a: Point, b: Point, color: string): React.CSSProperties {
    return {
      left: percent(a.x, naturalSize.width),
      top: percent(a.y, naturalSize.height),
      width: percent(distance(a, b), naturalSize.width),
      transform: `rotate(${angle(a, b)}deg)`,
      background: color,
    };
  }

  return (
    <div className="tools-view">
      <p className="tool-lead">
        Mesurez une longueur sur une photo en la calibrant d’abord avec un objet de taille connue.
        <b> La photo reste sur votre téléphone</b> : aucune image n’est envoyée sur internet.
      </p>

      <div className="photo-hint">
        <b>Comment faire ?</b> Photographiez le client de face, à bonne distance. Cliquez sur les deux extrémités
        d’un objet connu (carte bancaire, règle), puis sur les deux points à mesurer.
      </div>

      {image ? (
        <>
          <div className="photo-stage">
            {/* A browser-generated data URL cannot go through the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={image}
              alt="Photo utilisée pour la mesure"
              onClick={pickPoint}
              onLoad={(event) => {
                const element = event.currentTarget;
                setNaturalSize({ width: element.naturalWidth || 1, height: element.naturalHeight || 1 });
              }}
            />

            {[...referencePoints, ...measurePoints].map((point, index) => (
              <span key={index} className="photo-marker" style={markerStyle(point)} />
            ))}

            {calibrationDone && (
              <>
                <span className="photo-line" style={lineStyle(referencePoints[0], referencePoints[1], "rgba(156, 76, 41, 0.9)")} />
                <span
                  className="photo-marker-label"
                  style={{
                    left: percent((referencePoints[0].x + referencePoints[1].x) / 2, naturalSize.width),
                    top: percent((referencePoints[0].y + referencePoints[1].y) / 2, naturalSize.height),
                  }}
                >
                  Réf. {referenceCm} cm
                </span>
              </>
            )}

            {measurePoints.length === 2 && (
              <span className="photo-line" style={lineStyle(measurePoints[0], measurePoints[1], "#2f4438")} />
            )}
          </div>

          {!calibrationDone ? (
            <div className="photo-hint">
              <b>Étape 1 — Calibrage.</b> Cliquez sur les deux extrémités d’un objet dont vous connaissez la taille
              exacte ({referencePoints.length}/2 posé{referencePoints.length === 1 ? "" : "s"}).
            </div>
          ) : (
            <>
              <div className="stat-block">
                <h3>Objet de référence</h3>
                <div className="calc-choice" role="group" aria-label="Objet de référence">
                  {CALIBRATION_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      className={`calc-chip ${referenceCm === preset.cm ? "calc-chip-active" : ""}`}
                      onClick={() => {
                        setReferenceCm(preset.cm);
                        setResult(null);
                        setMeasurePoints([]);
                      }}
                    >
                      {preset.label} · {preset.cm} cm
                    </button>
                  ))}
                  <button
                    type="button"
                    className="calc-chip"
                    onClick={() => {
                      setReferencePoints([]);
                      setMeasurePoints([]);
                      setResult(null);
                    }}
                  >
                    ↺ Refaire le calibrage
                  </button>
                </div>
              </div>

              {result !== null ? (
                <div className="photo-readout">
                  <div>
                    <small>ESTIMATION</small>
                    <strong>{result.toFixed(1).replace(".", ",")} cm</strong>
                  </div>
                  <span>À confirmer au mètre ruban avant la coupe.</span>
                </div>
              ) : (
                <div className="photo-hint">
                  <b>Étape 2 — Mesure.</b> Cliquez sur les deux points à mesurer
                  ({measurePoints.length}/2 posé{measurePoints.length === 1 ? "" : "s"}).
                </div>
              )}
            </>
          )}

          <div className="settings-row">
            <button type="button" className="button button-light" onClick={resetAll}>
              Choisir une autre photo
            </button>
            {result !== null && (
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  const text = `${result.toFixed(1).replace(".", ",")} cm${note ? ` — ${note}` : ""}`;
                  void navigator.clipboard?.writeText(text);
                }}
              >
                Copier la mesure
              </button>
            )}
          </div>

          {result !== null && (
            <label className="field-label">
              Note (facultatif)
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ex. Tour de poitrine de Mme Fadiga"
              />
            </label>
          )}
        </>
      ) : (
        <>
          <div className="photo-stage">
            <div className="photo-empty">
              <span aria-hidden="true">📷</span>
              <b>Prenez ou choisissez une photo</b>
              <small>La photo est traitée entièrement sur votre téléphone et n’est jamais envoyée sur internet.</small>
            </div>
          </div>
          <label className="button button-primary" style={{ alignSelf: "flex-start", cursor: "pointer" }}>
            Ouvrir l’appareil photo
            <input type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: "none" }} />
          </label>
        </>
      )}

      <div className="photo-hint">
        <b>Limites à connaître.</b> Cette estimation dépend de la qualité de la photo et de la justesse du calibrage.
        Elle sert de repère rapide : confirmez toujours la mesure au mètre ruban avant de couper le tissu.
      </div>
    </div>
  );
}
