import {
  Angle,
  ANGLES,
  CTAType,
  PageFeatures,
  PageSpec,
  Section,
  SectionKind,
} from "./types";

// The exploration design: a set of synthetic page-feature points where the
// factors we want to learn — message angle, CTA, social proof, specificity,
// length — vary INDEPENDENTLY. This is what lets the regression separate (say)
// the CTA effect from the angle effect, which the 5 showcase pages cannot do
// because there CTA is collinear with angle.
//
// 5 primary angles × 3 CTAs × a resolution-III fraction of (proof, spec, length)
// = 60 design points. Each scalar factor stays balanced and ~orthogonal.

const CTA_STRENGTH: Record<CTAType, number> = { demo: 1.0, trial: 0.8, soft: 0.5 };

// (proof, specificity, length) corners — each factor balanced hi/lo across rows.
const SCALAR_COMBOS: { proof: number; spec: number; length: number }[] = [
  { proof: 0.3, spec: 0.3, length: 5 },
  { proof: 0.85, spec: 0.85, length: 5 },
  { proof: 0.85, spec: 0.3, length: 8 },
  { proof: 0.3, spec: 0.85, length: 8 },
];

const CTAS: CTAType[] = ["demo", "trial", "soft"];

// Concentrated blend: most weight on the lead angle, some on a complement, and
// only a thin spread on the rest (kept identical in lib/variant.ts so the
// optimizer never scores a profile the model didn't see).
export function blendWeights(primary: Angle, secondary: Angle): Record<Angle, number> {
  const w: Record<Angle, number> = {
    roi: 0,
    pain: 0,
    personalization: 0,
    research: 0,
    speed: 0,
  };
  const rest = (1 - 0.68 - 0.24) / 3;
  for (const a of ANGLES) w[a] = rest;
  w[primary] = 0.68;
  w[secondary] = 0.24;
  return w;
}

function templateSections(primary: Angle, secondary: Angle, length: number): Section[] {
  const kinds: SectionKind[] = ["hero", "solution", "features", "how_it_works", "social_proof", "metrics"];
  const out: Section[] = [];
  for (let i = 0; i < length - 1; i++) {
    const angle = i === 0 ? primary : i % 2 === 1 ? secondary : primary;
    out.push({
      kind: kinds[Math.min(i, kinds.length - 1)],
      angle,
      heading: `exploration ${i}`,
      body: "exploration design point — not rendered",
    });
  }
  out.push({ kind: "cta", angle: primary, heading: "exploration cta", body: "" });
  return out;
}

function buildDesignPage(
  id: string,
  primary: Angle,
  secondary: Angle,
  cta: CTAType,
  proof: number,
  spec: number,
  length: number
): PageSpec {
  const features: PageFeatures = {
    angleWeights: blendWeights(primary, secondary),
    ctaType: cta,
    ctaStrength: CTA_STRENGTH[cta],
    socialProof: proof,
    specificity: spec,
    visualDensity: 0.6,
    length,
  };
  return {
    id,
    name: `design-${id}`,
    origin: "seed",
    primaryAngle: primary,
    secondaryAngle: secondary,
    cta: { type: cta, label: cta },
    headline: "",
    subhead: "",
    sections: templateSections(primary, secondary, length),
    features,
    accent: "violet",
  };
}

export function buildExplorationDesign(): PageSpec[] {
  const pages: PageSpec[] = [];
  ANGLES.forEach((primary, ai) => {
    const secondary = ANGLES[(ai + 1) % ANGLES.length];
    for (const cta of CTAS) {
      SCALAR_COMBOS.forEach((c, ci) => {
        const id = `D-${primary}-${cta}-${ci}`;
        pages.push(buildDesignPage(id, primary, secondary, cta, c.proof, c.spec, c.length));
      });
    }
  });
  return pages;
}
