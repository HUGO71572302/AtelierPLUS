"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { MEASUREMENT_DETAILS } from "@/lib/measurements-guide";
import { MEASUREMENT_CATALOG } from "@/lib/atelier-types";

type CategoryFilter = "all" | "haut" | "bas" | "robe_jupe" | "specifique";
type ViewSide = "front" | "back" | "both";

type HumanMarker = {
  code: string;
  side: "front" | "back";
  x: number;
  y: number;
  label: string;
};

/**
 * Pixel positions on the two real human bodies in guide-corps-humain.png.
 * Left body = face, right body = dos. A measurement can have a marker on both
 * views where the explanation benefits from it (ex. shoulder/carrure).
 */
const HUMAN_MARKERS: HumanMarker[] = [
  { code: "LC", side: "front", x: 29, y: 45, label: "Du cou à l’ourlet" },
  { code: "E", side: "front", x: 24, y: 29, label: "Pointe d’épaule" },
  { code: "E", side: "back", x: 68, y: 29, label: "Pointe d’épaule" },
  { code: "CA", side: "back", x: 69, y: 35, label: "Carrure dos" },
  { code: "EN", side: "front", x: 30, y: 24, label: "Base du cou" },
  { code: "P", side: "front", x: 30, y: 38, label: "Point fort poitrine" },
  { code: "T", side: "front", x: 30, y: 50, label: "Creux de la taille" },
  { code: "BS", side: "front", x: 30, y: 60, label: "Point fort hanches" },
  { code: "LM", side: "front", x: 18, y: 44, label: "Milieu de manche" },
  { code: "TM", side: "front", x: 21, y: 36, label: "Tour de bras" },
  { code: "TP", side: "front", x: 16, y: 57, label: "Poignet" },
  { code: "LP", side: "front", x: 36, y: 81, label: "Longueur jambe" },
  { code: "EJ", side: "front", x: 29, y: 72, label: "Entrejambe" },
  { code: "C", side: "front", x: 25, y: 68, label: "Tour de cuisse" },
  { code: "GE", side: "front", x: 25, y: 80, label: "Tour de genou" },
  { code: "B", side: "front", x: 25, y: 94, label: "Bas de pantalon" },
  { code: "LJ", side: "front", x: 33, y: 72, label: "Longueur jupe" },
  { code: "LR", side: "front", x: 32, y: 72, label: "Longueur robe" },
  { code: "O", side: "front", x: 30, y: 47, label: "Nombril" },
  { code: "HP", side: "front", x: 28, y: 34, label: "Hauteur poitrine" },
];

function markersFor(code: string) {
  return HUMAN_MARKERS.filter((marker) => marker.code === code);
}

export function MeasurementGuideView({ onSelectCode }: { onSelectCode?: (code: string) => void }) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedCode, setSelectedCode] = useState<string>("P");
  const [view, setView] = useState<ViewSide>("both");

  const filteredItems = useMemo(() => {
    return MEASUREMENT_CATALOG.filter((item) => {
      if (category === "all") return true;
      const detail = MEASUREMENT_DETAILS[item.code];
      return detail?.category === category;
    });
  }, [category]);

  const activeDetail = MEASUREMENT_DETAILS[selectedCode] ?? MEASUREMENT_DETAILS.P;
  const activeMarkers = markersFor(selectedCode);

  function select(code: string) {
    setSelectedCode(code);
    const nextMarkers = markersFor(code);
    if (nextMarkers.length === 1) setView(nextMarkers[0].side);
    if (onSelectCode) onSelectCode(code);
  }

  return (
    <div className="guide-layout">
      <div className="guide-categories">
        <button type="button" className={`guide-cat-btn ${category === "all" ? "guide-cat-active" : ""}`} onClick={() => setCategory("all")}>Toutes (19)</button>
        <button type="button" className={`guide-cat-btn ${category === "haut" ? "guide-cat-active" : ""}`} onClick={() => setCategory("haut")}>Haut du corps</button>
        <button type="button" className={`guide-cat-btn ${category === "bas" ? "guide-cat-active" : ""}`} onClick={() => setCategory("bas")}>Bas & pantalon</button>
        <button type="button" className={`guide-cat-btn ${category === "robe_jupe" ? "guide-cat-active" : ""}`} onClick={() => setCategory("robe_jupe")}>Robe & jupe</button>
        <button type="button" className={`guide-cat-btn ${category === "specifique" ? "guide-cat-active" : ""}`} onClick={() => setCategory("specifique")}>Spécifiques</button>
      </div>

      <div className="guide-main-grid">
        <section className="guide-human-card">
          <div className="human-guide-header">
            <div>
              <b>Repères sur un vrai corps humain</b>
              <small>Face à gauche · Dos à droite · touchez un point ou une mesure</small>
            </div>
            <div className="guide-view-toggle" role="group" aria-label="Vue du corps">
              <button type="button" className={view === "front" ? "guide-view-active" : ""} onClick={() => setView("front")}>Face</button>
              <button type="button" className={view === "both" ? "guide-view-active" : ""} onClick={() => setView("both")}>Les deux</button>
              <button type="button" className={view === "back" ? "guide-view-active" : ""} onClick={() => setView("back")}>Dos</button>
            </div>
          </div>

          <div className={`human-guide-photo human-guide-${view}`}>
            <Image
              src="/images/guide-corps-humain.png"
              alt="Corps humain de face et de dos pour les repères de mensuration"
              fill
              sizes="(max-width: 1000px) 100vw, 440px"
              priority
            />
            <div className="guide-side-label guide-side-front">FACE</div>
            <div className="guide-side-label guide-side-back">DOS</div>

            {HUMAN_MARKERS.filter((marker) => view === "both" || view === marker.side).map((marker, index) => {
              const isActive = marker.code === selectedCode;
              return (
                <button
                  key={`${marker.code}-${marker.side}-${index}`}
                  type="button"
                  className={`human-marker ${isActive ? "human-marker-active" : ""}`}
                  style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                  onClick={() => select(marker.code)}
                  title={`${marker.code} · ${marker.label}`}
                  aria-label={`${marker.code} : ${marker.label}`}
                >
                  <span>{marker.code}</span>
                </button>
              );
            })}

            {activeMarkers.filter((marker) => view === "both" || view === marker.side).map((marker, index) => (
              <span key={`label-${index}`} className="human-marker-caption" style={{ left: `${marker.x}%`, top: `${marker.y}%` }}>
                {marker.label}
              </span>
            ))}
          </div>

          <div className="active-measure-callout active-measure-human">
            <div className="callout-code-badge">{activeDetail.code}</div>
            <div>
              <strong>{activeDetail.name}</strong>
              <p>{activeDetail.hint}</p>
              <div className="callout-tags">
                <span>Pour :</span>
                {activeDetail.commonGarments.map((garment) => <small key={garment}>{garment}</small>)}
              </div>
            </div>
          </div>
          <p className="guide-accuracy-note"><b>Bon geste :</b> gardez le ruban plat, sans serrer. Pour une coupe précise, la mesure au mètre ruban reste la référence.</p>
        </section>

        <div className="guide-list-scroll">
          {filteredItems.map((item) => {
            const detail = MEASUREMENT_DETAILS[item.code] ?? { code: item.code, name: item.name, hint: item.hint, commonGarments: [] };
            const isSelected = selectedCode === item.code;
            return (
              <button type="button" key={item.code} className={`guide-card-item ${isSelected ? "guide-card-active" : ""}`} onClick={() => select(item.code)}>
                <div className="guide-card-top">
                  <span className="guide-code-chip">{item.code}</span>
                  <strong>{item.name}</strong>
                </div>
                <p className="guide-hint-text">{item.hint}</p>
                {detail.commonGarments.length > 0 && (
                  <div className="guide-garment-pills">
                    {detail.commonGarments.map((garment) => <span key={garment}>{garment}</span>)}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
