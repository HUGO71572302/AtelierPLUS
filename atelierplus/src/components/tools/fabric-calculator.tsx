"use client";

import { useMemo, useState } from "react";

type GarmentKey = "robe_midi" | "robe_longue" | "jupe" | "chemise" | "chemisier" | "pantalon" | "boubou" | "ensemble" | "veste";

const GARMENTS: { key: GarmentKey; label: string; base: number; note: string }[] = [
  { key: "robe_midi", label: "Robe midi", base: 3.5, note: "De la taille aux genoux, avec ourlets" },
  { key: "robe_longue", label: "Robe longue", base: 4.2, note: "De l’épaule à la cheville" },
  { key: "jupe", label: "Jupe", base: 1.8, note: "Jupe droite ou évasée" },
  { key: "chemise", label: "Chemise homme", base: 2.2, note: "Avec manches longues et poignets" },
  { key: "chemisier", label: "Chemisier", base: 1.8, note: "Corsage femme avec manches" },
  { key: "pantalon", label: "Pantalon", base: 2.4, note: "Avec ceinture et bas" },
  { key: "boubou", label: "Boubou / Grand boubou", base: 5.5, note: "Pièce large avec emmanchures amples" },
  { key: "ensemble", label: "Ensemble deux pièces", base: 4.5, note: "Haut + bas assortis" },
  { key: "veste", label: "Veste / Blazer", base: 2.8, note: "Avec doublure recommandée" },
];

const SIZES = [
  { key: "S", label: "S", factor: 0.95 },
  { key: "M", label: "M", factor: 1 },
  { key: "L", label: "L", factor: 1.08 },
  { key: "XL", label: "XL", factor: 1.18 },
  { key: "XXL", label: "XXL", factor: 1.3 },
];

const WIDTHS = [90, 110, 140, 150, 160];

function formatMetres(value: number) {
  return `${value.toFixed(2).replace(".", ",")} m`;
}

/** Practical fabric estimate used by tailors: base metres × size × fabric width + allowances. */
export function FabricCalculator() {
  const [garment, setGarment] = useState<GarmentKey>("robe_midi");
  const [size, setSize] = useState("M");
  const [width, setWidth] = useState(150);
  const [patterned, setPatterned] = useState(false);
  const [reserve, setReserve] = useState(true);
  const [lining, setLining] = useState(false);

  const result = useMemo(() => {
    const definition = GARMENTS.find((item) => item.key === garment) ?? GARMENTS[0];
    const sizeFactor = SIZES.find((item) => item.key === size)?.factor ?? 1;
    const widthFactor = 150 / width;
    const raw = definition.base * sizeFactor * widthFactor;
    const patternExtra = patterned ? raw * 0.12 : 0;
    const liningExtra = lining ? raw * 0.6 : 0;
    const reserveExtra = reserve ? 0.5 : 0;
    const total = raw + patternExtra + liningExtra + reserveExtra;
    // Tailors buy in quarters of a metre.
    const rounded = Math.ceil(total * 4) / 4;
    return { definition, raw, patternExtra, liningExtra, reserveExtra, total, rounded };
  }, [garment, size, width, patterned, reserve, lining]);

  return (
    <div className="tools-view">
      <p className="tool-lead">
        Estimez le métrage à acheter pour une pièce, selon la largeur du tissu et la taille du client.
      </p>

      <div className="calc-grid">
        <div className="calc-result">
          <small>MÉTRAGE RECOMMANDÉ</small>
          <strong>{formatMetres(result.rounded)}</strong>
          <span>
            Pour une {result.definition.label.toLowerCase()} en taille {size}, tissu largeur {width} cm.
          </span>
          <div className="calc-breakdown">
            <div><span>Base de la pièce</span><b>{formatMetres(result.raw)}</b></div>
            {result.patternExtra > 0 && <div><span>Marge pour motif</span><b>+ {formatMetres(result.patternExtra)}</b></div>}
            {result.liningExtra > 0 && <div><span>Doublure</span><b>+ {formatMetres(result.liningExtra)}</b></div>}
            {result.reserveExtra > 0 && <div><span>Réserves &amp; ourlets</span><b>+ {formatMetres(result.reserveExtra)}</b></div>}
          </div>
        </div>

        <div className="calc-tips">
          <div className="calc-tip"><b>Pourquoi arrondir au quart de mètre ?</b> Les revendeurs coupent au quart de mètre près. Mieux vaut avoir un peu trop que de manquer un ourlet.</div>
          <div className="calc-tip"><b>Largeur du tissu.</b> Un tissu étroit (90 cm) demande beaucoup plus de longueur qu’un tissu de 150 cm : la consommation double presque.</div>
          <div className="calc-tip"><b>Les motifs qui se répètent</b> (imprimés, wax, rayures) nécessitent 10 à 15 % de plus pour raccorder les dessins.</div>
          <div className="calc-tip"><b>Une retouche de sécurité.</b> Gardez toujours un coupon de 20 à 30 cm pour les retouches de dernière minute.</div>
        </div>
      </div>

      <div className="stat-block">
        <h3>Vêtement à réaliser</h3>
        <div className="calc-choice" role="group" aria-label="Type de vêtement">
          {GARMENTS.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`calc-chip ${garment === item.key ? "calc-chip-active" : ""}`}
              onClick={() => setGarment(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="tool-lead" style={{ marginTop: 12 }}>{result.definition.note}</p>
      </div>

      <div className="stat-block">
        <h3>Taille du client</h3>
        <div className="calc-choice" role="group" aria-label="Taille">
          {SIZES.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`calc-chip ${size === item.key ? "calc-chip-active" : ""}`}
              onClick={() => setSize(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-block">
        <h3>Largeur du tissu</h3>
        <div className="calc-choice" role="group" aria-label="Largeur du tissu">
          {WIDTHS.map((value) => (
            <button
              type="button"
              key={value}
              className={`calc-chip ${width === value ? "calc-chip-active" : ""}`}
              onClick={() => setWidth(value)}
            >
              {value} cm
            </button>
          ))}
        </div>
      </div>

      <div className="stat-block">
        <h3>Options</h3>
        <div className="calc-choice" role="group" aria-label="Options">
          <button type="button" className={`calc-chip ${patterned ? "calc-chip-active" : ""}`} onClick={() => setPatterned(!patterned)}>
            {patterned ? "✓ " : ""}Tissu à motif
          </button>
          <button type="button" className={`calc-chip ${lining ? "calc-chip-active" : ""}`} onClick={() => setLining(!lining)}>
            {lining ? "✓ " : ""}Avec doublure
          </button>
          <button type="button" className={`calc-chip ${reserve ? "calc-chip-active" : ""}`} onClick={() => setReserve(!reserve)}>
            {reserve ? "✓ " : ""}Réserves pour ourlets
          </button>
        </div>
      </div>
    </div>
  );
}
