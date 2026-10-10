import { GARMENT_TEMPLATES } from "@/lib/atelier-types";

export type GarmentValue = (typeof GARMENT_TEMPLATES)[number]["value"];
export type CatalogFamily = "robes" | "hauts" | "jupes" | "pantalons" | "boubous" | "ensembles" | "caftans" | "kabas";
export type CatalogAudience = "Femme" | "Homme" | "Mixte";
export type CatalogOccasion = "Quotidien" | "Travail" | "Cérémonie";
export type ModelOrderDetails = { model: string; notes: string };

export type CatalogModel = {
  id: string;
  title: string;
  description: string;
  image: string;
  visual: "generated" | "sketch";
  garment: GarmentValue;
  family: CatalogFamily;
  audience: CatalogAudience;
  occasion: CatalogOccasion;
  level: "Accessible" | "Intermédiaire" | "Avancé";
  fabric: string;
  codes: string[];
  advice: string;
  isNew?: boolean;
  reference?: { title: string; url: string };
};

export const CATALOG_FAMILIES: { value: "all" | CatalogFamily; label: string }[] = [
  { value: "all", label: "Tous les modèles" },
  { value: "robes", label: "Robes" },
  { value: "hauts", label: "Chemises & hauts" },
  { value: "jupes", label: "Jupes" },
  { value: "pantalons", label: "Pantalons" },
  { value: "boubous", label: "Boubous" },
  { value: "ensembles", label: "Ensembles" },
];

/**
 * Editorial catalogue, available to every atelier without importing private data.
 * Pinterest references were located by web research and opened for consultation.
 * They are external references, not image licences. No Pinterest image is copied
 * or hotlinked: all local visuals are original generated illustrations or SVG sketches.
 * Sewing advice is our own practical guidance, not a graded pattern or a guaranteed yardage.
 */
export const INSPIRATION_CATALOG: CatalogModel[] = [
  {
    id: "robe-sirene-indigo",
    title: "Robe sirène indigo",
    description: "Une silhouette ajustée, des découpes princesse et un évasement souple sous le genou pour une entrée remarquée.",
    image: "/images/robe-sirene-indigo.jpg",
    visual: "generated",
    garment: "robe_femme", family: "robes", audience: "Femme", occasion: "Cérémonie", level: "Avancé",
    fabric: "Wax souple ou crêpe doublé",
    codes: ["LR", "P", "T", "BS", "HP", "E"],
    advice: "Faites une toile du corsage et vérifiez l’aisance à la marche. Repérez la hauteur du genou à l’essayage avant de placer les godets. Validez l’ourlet avec les chaussures prévues.",
    isNew: true,
    reference: { title: "Pinterest · Robe sirène en pagne", url: "https://fr.pinterest.com/ideas/robe-sir%C3%A8ne-en-pagne/935962593755/" },
  },
  {
    id: "robe-portefeuille-wax",
    title: "Robe portefeuille en wax",
    description: "Un devant croisé, une ceinture à nouer et une jupe midi évasée : une coupe confortable, facile à personnaliser.",
    image: "/images/robe-portefeuille-wax.jpg",
    visual: "generated",
    garment: "robe_femme", family: "robes", audience: "Femme", occasion: "Quotidien", level: "Intermédiaire",
    fabric: "Wax léger ou coton souple",
    codes: ["LR", "P", "T", "BS", "E", "LM"],
    advice: "Prévoyez un croisement suffisant pour rester couvert en position assise. Stabilisez l’encolure et placez les liens après un essayage. Alignez les grands motifs sur les deux pans.",
    isNew: true,
    reference: { title: "Pinterest · Robe portefeuille", url: "https://fr.pinterest.com/ideas/robe-portefeuille/941416335703/" },
  },
  {
    id: "boubou-indigo-brode",
    title: "Grand boubou indigo",
    description: "Du volume, un tombé ample et une broderie géométrique discrète autour de l’encolure : l’esprit cérémonie.",
    image: "/images/boubou-indigo-brode.jpg",
    visual: "generated",
    garment: "boubou", family: "boubous", audience: "Homme", occasion: "Cérémonie", level: "Avancé",
    fabric: "Bazin ou coton damassé",
    codes: ["LR", "P", "EN", "LM", "TM"],
    advice: "Validez d’abord la longueur et l’ampleur avec le client. Faites la broderie avant l’assemblage définitif et renforcez sa zone si nécessaire. Le pantalon assorti demande un relevé et une coupe séparés.",
    isNew: true,
    reference: { title: "Pinterest · Ensemble homme, boubou et broderie", url: "https://www.pinterest.com/baf78/ensemble-homme/" },
  },
  {
    id: "jupe-plis-wax",
    title: "Jupe midi à plis creux",
    description: "Une taille haute, de beaux plis réguliers et des poches discrètes pour une pièce aussi pratique qu’élégante.",
    image: "/images/jupe-plis-wax.jpg",
    visual: "generated",
    garment: "jupe_femme", family: "jupes", audience: "Femme", occasion: "Quotidien", level: "Intermédiaire",
    fabric: "Wax structuré ou coton de tenue moyenne",
    codes: ["LJ", "T", "BS"],
    advice: "Calculez la profondeur et le nombre de plis sur le patron, pas uniquement sur le tour de taille. Répartissez les motifs avant de couper et stabilisez la ceinture pour éviter qu’elle se détende.",
    isNew: true,
    reference: { title: "Pinterest · Jupe à plis creux, patron", url: "https://www.pinterest.com/ideas/jupe-%C3%A0-plis-creux-patron/904488368793/" },
  },
  {
    id: "chemisier-manches-ballon",
    title: "Chemisier manches ballon",
    description: "Un col rond, des manches froncées et une ligne souple pour donner du caractère à un haut du quotidien.",
    image: "/images/chemisier-manches-ballon.jpg",
    visual: "generated",
    garment: "chemisier_femme", family: "hauts", audience: "Femme", occasion: "Travail", level: "Intermédiaire",
    fabric: "Popeline, coton léger ou lin lavé",
    codes: ["LC", "E", "EN", "P", "LM", "TM", "TP"],
    advice: "Répartissez les fronces de façon symétrique et contrôlez l’aisance au bras. Pour une manche courte, mesurez son ouverture à la hauteur choisie : le tour de poignet ne convient qu’à une manche longue.",
    isNew: true,
    reference: { title: "Pinterest · Chemisier manche bouffante", url: "https://fr.pinterest.com/ideas/chemisier-manche-bouffante/933616492485/" },
  },
  {
    id: "chemise-col-officier",
    title: "Chemise à col officier",
    description: "Un petit col droit, une patte de boutonnage nette et des poignets soignés. Une base masculine intemporelle.",
    image: "/images/chemise-officier.jpg",
    visual: "generated",
    garment: "chemise_homme", family: "hauts", audience: "Homme", occasion: "Travail", level: "Intermédiaire",
    fabric: "Lin, chambray ou coton uni",
    codes: ["LC", "E", "CA", "EN", "P", "LM", "TM", "TP"],
    advice: "Vérifiez le confort du col fermé avant de fixer sa hauteur. Entoilez légèrement col et poignets, et soignez la symétrie de la patte centrale. Prélavez le lin avant la coupe.",
    isNew: true,
    reference: { title: "Pinterest · Chemise col officier homme", url: "https://fr.pinterest.com/ideas/chemise-col-officier-homme/929664575832/" },
  },
  {
    id: "pantalon-palazzo",
    title: "Pantalon palazzo fluide",
    description: "Des jambes larges, des plis devant et une taille haute pour une silhouette élancée sans sacrifier le confort.",
    image: "/images/pantalon-palazzo.jpg",
    visual: "generated",
    garment: "pantalon", family: "pantalons", audience: "Femme", occasion: "Travail", level: "Intermédiaire",
    fabric: "Crêpe, viscose ou lin souple",
    codes: ["LP", "T", "BS", "EJ", "C", "B"],
    advice: "Contrôlez la fourche assise et debout à l’essayage. Prévoyez l’ampleur sur le patron, puis mesurez l’ourlet avec les chaussures du client. Laissez reposer un tissu très fluide avant l’ourlet final.",
    isNew: true,
    reference: { title: "Pinterest · Pantalons palazzo", url: "https://fr.pinterest.com/ideas/pantalons-palazzo/911874719816/" },
  },
  {
    id: "ensemble-peplum",
    title: "Ensemble péplum & jupe",
    description: "Un corsage cintré à basque et une jupe droite assortie. Deux pièces qui mettent en valeur le dessin du pagne.",
    image: "/images/ensemble-peplum.jpg",
    visual: "generated",
    garment: "ensemble", family: "ensembles", audience: "Femme", occasion: "Cérémonie", level: "Avancé",
    fabric: "Wax ou coton structuré",
    codes: ["LC", "LJ", "P", "T", "BS", "HP", "LM", "E"],
    advice: "Ajustez le corsage avant de monter la basque. Faites coïncider les motifs du haut et de la jupe et prévoyez une fente de marche sur une jupe étroite. Vérifiez le confort en position assise.",
    isNew: true,
    reference: { title: "Pinterest · Ensemble jupe et corsage en pagne", url: "https://fr.pinterest.com/ideas/ensemble-jupe-et-corsage-en-pagne/946455228161/" },
  },
  {
    id: "caftan-perle-rose",
    title: "Caftan perlé rose",
    description: "Un caftan long en satin, encolure perlée et manches amples : la pièce des grandes occasions.",
    image: "/images/caftan-perle-rose.jpg",
    visual: "generated",
    garment: "boubou", family: "caftans", audience: "Femme", occasion: "Cérémonie", level: "Avancé",
    fabric: "Satin, brocard ou bazin riche",
    codes: ["LR", "P", "EN", "LM", "TM"],
    advice: "Cousez les perles à la main sur l’entoilage avant l’assemblage, jamais sur la pièce seule. Prévoyez une doublure légère pour protéger la peau du satin et testez l’aisance des manches bras levés.",
    isNew: true,
    reference: { title: "Pinterest · Caftan sans manche et caftans brodés", url: "https://fr.pinterest.com/ideas/caftan-sans-manche/928648976047/" },
  },
  {
    id: "ensemble-taille-basse-wax",
    title: "Ensemble taille basse",
    description: "Un haut court et une jupe midi posée sur les hanches : une coupe jeune, facile à porter tous les jours.",
    image: "/images/ensemble-taille-basse.jpg",
    visual: "generated",
    garment: "ensemble", family: "ensembles", audience: "Femme", occasion: "Quotidien", level: "Accessible",
    fabric: "Wax ou coton de tenue moyenne",
    codes: ["LC", "LJ", "T", "BS", "E"],
    advice: "Mesurez le tour des hanches à l’endroit réel de la ceinture, pas à la taille naturelle. Renforcez la ceinture et vérifiez en position assise que le haut couvre toujours le bas du dos.",
    isNew: true,
    reference: { title: "Pinterest · Taille basse wax", url: "https://fr.pinterest.com/pin/568579521731516594/" },
  },
  {
    id: "kaba-vert-maternite",
    title: "Kaba vert ample",
    description: "Un volume généreux depuis les épaules, confortable à chaque étape de la grossesse et élégant au quotidien.",
    image: "/images/kaba-maternite.jpg",
    visual: "generated",
    garment: "robe_femme", family: "kabas", audience: "Femme", occasion: "Quotidien", level: "Accessible",
    fabric: "Coton souple, pagne léger ou bazin",
    codes: ["LR", "P", "BS", "LM", "TM"],
    advice: "Travaillez l’ampleur sur le patron et non sur les coutures. Gardez la longueur à deux doigts du sol et privilégiez une ouverture de poitrine confortable pour l’allaitement si le client le souhaite.",
    isNew: true,
    reference: { title: "Pinterest · Robe pagne et kaba", url: "https://fr.pinterest.com/ideas/robe-plaqu%C3%A9e-en-pagne/906335314450/" },
  },
  {
    id: "tunique-teal-homme",
    title: "Tunique droite homme",
    description: "Une tunique au col Mao, poche poitrine discrète et pantalon assorti : l’élégance sans complication.",
    image: "/images/tunique-homme.jpg",
    visual: "generated",
    garment: "chemise_homme", family: "hauts", audience: "Homme", occasion: "Cérémonie", level: "Intermédiaire",
    fabric: "Coton, lin ou bazin léger",
    codes: ["LC", "E", "CA", "EN", "P", "LM", "TM"],
    advice: "Vérifiez la longueur genoux debout et assis avant de couper. Le col Mao demande un entoilage net ; contrôlez le passage de tête et prévoyez le pantalon séparément avec ses propres mensurations.",
    isNew: true,
    reference: { title: "Pinterest · Boubou et tunique homme", url: "https://fr.pinterest.com/ideas/boubou-africain-homme/947385650675/" },
  },
  {
    id: "robe-soiree-wax",
    title: "Robe de soirée en wax",
    description: "Une robe ample qui laisse respirer le tissu et met en valeur l’imprimé.",
    image: "/images/robe-soiree-wax.jpg", visual: "generated",
    garment: "robe_femme", family: "robes", audience: "Femme", occasion: "Cérémonie", level: "Intermédiaire",
    fabric: "Wax souple",
    codes: ["LR", "P", "T", "BS", "O", "HP"],
    advice: "Validez l’ampleur et la longueur à l’essayage. Déterminez le métrage à partir du patron, de la laize et du raccord des motifs ; réservez du tissu pour les finitions.",
  },
  {
    id: "boubou-ivoire",
    title: "Boubou brodé ivoire",
    description: "Une pièce de cérémonie généreuse, où la broderie et la lumière du tissu font toute la différence.",
    image: "/images/boubou-ivoire.jpg", visual: "generated",
    garment: "boubou", family: "boubous", audience: "Mixte", occasion: "Cérémonie", level: "Avancé",
    fabric: "Bazin ou coton damassé",
    codes: ["LR", "P", "LM", "EN", "TM"],
    advice: "Placez et testez les motifs de broderie sur une chute avant de travailler la pièce principale. Gardez une marge de sécurité et vérifiez le tombé du vêtement porté.",
  },
  {
    id: "chemise-lin-sauge",
    title: "Chemise homme sur mesure",
    description: "Une coupe nette, un col bien monté et des manches à la bonne longueur.",
    image: "/images/chemise-lin-sauge.jpg", visual: "generated",
    garment: "chemise_homme", family: "hauts", audience: "Homme", occasion: "Quotidien", level: "Intermédiaire",
    fabric: "Lin ou coton léger",
    codes: ["LC", "E", "CA", "EN", "P", "LM", "TM", "TP"],
    advice: "La carrure fait la différence : relevez-la dans le dos et vérifiez que les bras peuvent bouger librement. Prélavez le tissu et contrôlez la longueur de manche avec le bras légèrement fléchi.",
  },
  {
    id: "ensemble-terracotta",
    title: "Ensemble jupe et chemisier",
    description: "Deux pièces assorties, à porter ensemble ou séparément au quotidien.",
    image: "/images/ensemble-terracotta.jpg", visual: "generated",
    garment: "ensemble", family: "ensembles", audience: "Femme", occasion: "Quotidien", level: "Intermédiaire",
    fabric: "Coton uni ou lin mélangé",
    codes: ["LC", "LJ", "P", "T", "BS", "LM"],
    advice: "Coupez les deux pièces dans le même coupon pour conserver la teinte. Déterminez séparément l’aisance du haut et du bas et faites un essayage de l’ensemble avant les ourlets.",
  },
];

export function catalogOrderDetails(item: CatalogModel): ModelOrderDetails {
  return {
    model: item.title,
    notes: [
      item.description,
      `Tissu conseillé : ${item.fabric}.`,
      `Mesures à vérifier : ${item.codes.join(", ")}.`,
      `Confection : ${item.advice}`,
      item.reference ? `Piste Pinterest : ${item.reference.url}` : "",
      "Adapter le modèle aux souhaits du client et valider à l’essayage.",
    ].filter(Boolean).join("\n"),
  };
}

/** Accent-insensitive French search across names, style, fabric and audience. */
export function catalogSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
}

export function filterCatalog({
  query = "", family = "all", occasion = "all",
}: { query?: string; family?: "all" | CatalogFamily; occasion?: "all" | CatalogOccasion }): CatalogModel[] {
  const words = catalogSearchText(query).trim().split(/\s+/).filter(Boolean);
  return INSPIRATION_CATALOG.filter((item) => {
    if (family !== "all" && item.family !== family) return false;
    if (occasion !== "all" && item.occasion !== occasion) return false;
    const haystack = catalogSearchText(`${item.title} ${item.description} ${item.fabric} ${item.audience} ${item.occasion} ${item.codes.join(" ")}`);
    return words.every((word) => haystack.includes(word));
  });
}
