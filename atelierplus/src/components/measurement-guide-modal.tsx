"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { MEASUREMENT_DETAILS } from "@/lib/measurements-guide";
import { MEASUREMENT_CATALOG } from "@/lib/atelier-types";

type CategoryFilter = "all" | "haut" | "bas" | "robe_jupe" | "specifique";
export function MeasurementGuideView({ onSelectCode }: { onSelectCode?: (code: string) => void }) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedCode, setSelectedCode] = useState<string>("P");

  const filteredItems = useMemo(() => {
    return MEASUREMENT_CATALOG.filter((item) => {
      if (category === "all") return true;
      const detail = MEASUREMENT_DETAILS[item.code];
      return detail?.category === category;
    });
  }, [category]);

  const activeDetail = MEASUREMENT_DETAILS[selectedCode] ?? MEASUREMENT_DETAILS.P;

  function select(code: string) {
    setSelectedCode(code);
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
              <b>Guide illustré de la prise de mesures</b>
              <small>Vues de face, de profil et de dos avec les principaux repères.</small>
            </div>
          </div>

          <div className="measurement-infographic">
            <Image
              src="/images/guide-mesure.png"
              alt="Guide de mensurations illustré avec vues de face, de profil et de dos, et les principaux tours et longueurs à relever"
              width={1214}
              height={1295}
              sizes="(max-width: 1000px) 100vw, 560px"
              priority
            />
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
