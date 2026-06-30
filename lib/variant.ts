import { blendWeights } from "./design";
import { FitSummary, Insights, summarizeFit } from "./insights";
import { Coefficient, featurizeParams, FitResult } from "./regression";
import {
  Angle,
  ANGLE_LABEL,
  ANGLES,
  ChangeNote,
  CTA_LABEL,
  CTAType,
  PageFeatures,
  PageSpec,
  Section,
  SectionKind,
} from "./types";

// The explored ranges (must match lib/design.ts) so the optimizer never
// extrapolates beyond what the model actually saw.
const PROOF_HI = 0.85;
const PROOF_LO = 0.3;
const SPEC_HI = 0.85;
const SPEC_LO = 0.3;
const LEN_SHORT = 5;
const LEN_LONG = 8;

const CTAS: CTAType[] = ["demo", "trial", "soft"];

export interface Slot {
  kind: SectionKind;
  angle: Angle;
}

export interface VariantPlan {
  id: string;
  name: string;
  primaryAngle: Angle;
  secondaryAngle: Angle;
  cta: CTAType;
  angleWeights: Record<Angle, number>;
  socialProof: number;
  specificity: number;
  lengthTarget: number;
  slots: Slot[];
  predictedConv: number; // the fitted model's prediction for this page
  rationale: ChangeNote[];
  baselineId: string;
  accent: string;
  generatedFor?: string;
}

const accentForAngle: Record<Angle, string> = {
  roi: "emerald",
  pain: "rose",
  personalization: "violet",
  research: "sky",
  speed: "amber",
};

const ctaStrengthOf: Record<CTAType, number> = { demo: 1.0, trial: 0.8, soft: 0.5 };

// The scalar levers are monotonic in the model, so the conversion-maximizing
// choice within the explored range is simply the endpoint matching each
// coefficient's sign. These come from DATA, not from a hand-picked constant.
function chooseScalars(s: FitSummary) {
  return {
    socialProof: s.proofCoef.value >= 0 ? PROOF_HI : PROOF_LO,
    specificity: s.specCoef.value >= 0 ? SPEC_HI : SPEC_LO,
    lengthTarget: s.lengthCoef.value < 0 ? LEN_SHORT : LEN_LONG,
  };
}

interface Candidate {
  primary: Angle;
  secondary: Angle;
  cta: CTAType;
  predicted: number;
}

// For each primary angle, the best (secondary, CTA) combo under the fitted
// model, ranked by predicted conversion. One candidate per primary keeps the
// evolution rounds visibly distinct (different lead angles).
function candidatesByPrimary(fit: FitResult, s: FitSummary): Candidate[] {
  const scalars = chooseScalars(s);
  const out: Candidate[] = [];
  for (const primary of ANGLES) {
    let best: Candidate | null = null;
    for (const secondary of ANGLES) {
      if (secondary === primary) continue;
      for (const cta of CTAS) {
        const x = featurizeParams({
          angleWeights: blendWeights(primary, secondary),
          cta,
          socialProof: scalars.socialProof,
          specificity: scalars.specificity,
          length: scalars.lengthTarget,
        });
        const predicted = fit.predict(x);
        if (!best || predicted > best.predicted) best = { primary, secondary, cta, predicted };
      }
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.predicted - a.predicted);
}

function buildSlots(primary: Angle, secondary: Angle, lengthTarget: number): Slot[] {
  const slots: Slot[] = [
    { kind: "hero", angle: primary },
    { kind: "solution", angle: primary },
    { kind: "how_it_works", angle: secondary },
    { kind: "social_proof", angle: primary },
    { kind: "cta", angle: primary },
  ];
  if (lengthTarget >= 6) slots.splice(3, 0, { kind: "features", angle: primary });
  if (lengthTarget >= 7) {
    slots.splice(4, 0, {
      kind: primary === "roi" || primary === "research" ? "metrics" : "how_it_works",
      angle: primary === "roi" || primary === "research" ? "roi" : secondary,
    });
  }
  return slots;
}

function fmtCoef(value: number, ci: [number, number]): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} (95% CI ${ci[0].toFixed(2)}–${ci[1].toFixed(2)})`;
}

function sig(c: Coefficient): boolean {
  return c.ci[0] > 0 || c.ci[1] < 0;
}

function buildRationale(
  s: FitSummary,
  pick: Candidate,
  scalars: { socialProof: number; specificity: number; lengthTarget: number },
  baseline: PageSpec | undefined,
  segName?: string
): ChangeNote[] {
  const notes: ChangeNote[] = [];
  const angleCoef = s.angleCoefs.find((a) => a.angle === pick.primary)!;
  const ctaCoef = s.ctaCoefs.find((c) => c.type === pick.cta)!;
  const isTop = s.angleCoefs[0].angle === pick.primary;

  if (segName) {
    notes.push({
      change: `Tuned to the ${segName} segment's own fitted model`,
      why: `Optimized against the response model fit on ${segName} traffic only — its strongest angle is ${ANGLE_LABEL[s.winningAngle]} (coef ${fmtCoef(s.angleCoefs[0].coef, s.angleCoefs[0].ci)}).`,
    });
  }

  notes.push({
    change: `Led with ${ANGLE_LABEL[pick.primary]} messaging`,
    why: `In the fitted model, ${ANGLE_LABEL[pick.primary]} has a coefficient of ${fmtCoef(angleCoef.coef, angleCoef.ci)}${
      isTop ? " — the highest-converting angle" : ""
    }. The previous best page ("${baseline?.name ?? "best original"}") led with ${
      baseline ? ANGLE_LABEL[baseline.primaryAngle] : "a single angle"
    }.`,
  });

  notes.push({
    change: `Chose the "${CTA_LABEL[pick.cta]}" call-to-action`,
    why:
      pick.cta === "soft"
        ? `Soft CTA is the baseline; the model found the other CTAs no better for this audience.`
        : `"${CTA_LABEL[pick.cta]}" carries a coefficient of ${fmtCoef(ctaCoef.coef, ctaCoef.ci)} versus the soft-CTA baseline — measured independently of the message angle.`,
  });

  const proofMaxed = scalars.socialProof >= PROOF_HI;
  notes.push({
    change: `${proofMaxed ? "Maximized" : "Minimized"} social proof and ${
      scalars.specificity >= SPEC_HI ? "kept concrete numbers high" : "kept copy light on numbers"
    }`,
    why: `Social-proof coefficient ${fmtCoef(s.proofCoef.value, s.proofCoef.ci)}${sig(s.proofCoef) ? " (significant)" : " (directional)"}, specificity ${fmtCoef(
      s.specCoef.value,
      s.specCoef.ci
    )}. The optimizer set each lever to the conversion-maximizing end of the tested range — not a hand-picked value.`,
  });

  notes.push({
    change: `Targeted a ${scalars.lengthTarget <= LEN_SHORT ? "shorter" : "longer"} page`,
    why: `Length coefficient ${fmtCoef(s.lengthCoef.value, s.lengthCoef.ci)} — ${
      s.lengthCoef.value < 0 ? "longer pages convert worse, so the page is trimmed" : "more sections helped, so the page is fuller"
    }.`,
  });

  notes.push({
    change: `Dropped the ${ANGLE_LABEL[s.losingAngle]} angle`,
    why: `It was the weakest angle in the fit (coef ${fmtCoef(
      s.angleCoefs[s.angleCoefs.length - 1].coef,
      s.angleCoefs[s.angleCoefs.length - 1].ci
    )}).`,
  });

  return notes;
}

// Optimize a new page as the argmax of the fitted response model. `rank` selects
// the rank-th best primary-angle candidate (used by the evolution loop to try
// successively weaker hypotheses).
export function optimizeVariant(
  insights: Insights,
  showcasePages: PageSpec[],
  opts: { id: string; forSegment?: string; rank?: number; segName?: string }
): VariantPlan {
  const fit = opts.forSegment ? insights.model.bySegment[opts.forSegment] : insights.model.population;
  const s = summarizeFit(fit);
  const scalars = chooseScalars(s);
  const candidates = candidatesByPrimary(fit, s);
  const pick = candidates[Math.min(opts.rank ?? 0, candidates.length - 1)];

  const baseline = showcasePages.find((p) => p.id === insights.overallWinner) ?? showcasePages[0];
  const rationale = buildRationale(s, pick, scalars, baseline, opts.segName);

  const rank = opts.rank ?? 0;
  const name = opts.forSegment
    ? `Targeted · ${opts.segName ?? opts.forSegment}`
    : rank === 0
      ? "Synthesized Winner"
      : `Candidate ${rank + 1} (${ANGLE_LABEL[pick.primary]})`;

  return {
    id: opts.id,
    name,
    primaryAngle: pick.primary,
    secondaryAngle: pick.secondary,
    cta: pick.cta,
    angleWeights: blendWeights(pick.primary, pick.secondary),
    socialProof: scalars.socialProof,
    specificity: scalars.specificity,
    lengthTarget: scalars.lengthTarget,
    slots: buildSlots(pick.primary, pick.secondary, scalars.lengthTarget),
    predictedConv: pick.predicted,
    rationale,
    baselineId: baseline.id,
    accent: accentForAngle[pick.primary],
    generatedFor: opts.forSegment,
  };
}

// ---------------------------------------------------------------------------
// Copy library (fallback, or as the safety net if the LLM fails) + realization.
// ---------------------------------------------------------------------------

const HERO_COPY: Record<Angle, { heading: string; body: string }> = {
  roi: {
    heading: "Prove your AI training pays for itself.",
    body: "Scholé turns AI upskilling into adoption, mastery, and hours-saved numbers you can defend to leadership — personalized to every role.",
  },
  pain: {
    heading: "Your team has AI tools. Scholé makes them use them.",
    body: "Access isn't adoption. We close the gap between the licenses you bought and the work your team actually does with them.",
  },
  personalization: {
    heading: "AI training that adapts to every role on your team.",
    body: "One generic course teaches no one. Scholé builds a different two-minute path for each person, grounded in their real tools and tasks.",
  },
  research: {
    heading: "AI upskilling, built on a decade of learning science.",
    body: "A multi-agent pedagogical engine from EPFL and UC Berkeley research — adaptive, measured, and free of hype.",
  },
  speed: {
    heading: "Real AI skills, personalized, in two-minute lessons.",
    body: "No 40-minute modules. One practical, role-specific AI move you can use in the next hour.",
  },
};

const SECTION_COPY: Record<Angle, { heading: string; body: string }> = {
  roi: {
    heading: "Numbers leadership actually asks for",
    body: "Adoption, mastery lift, and hours saved per team — reported in the language your CFO already speaks.",
  },
  pain: {
    heading: "Close the quiet adoption gap",
    body: "People don't announce that they're not using AI; they just don't. Short, role-specific nudges turn curiosity into habit before it fades.",
  },
  personalization: {
    heading: "Adaptive by role, by tool, by task",
    body: "Lessons adjust in real time to what someone does all day and how fast they're learning — with Ask Olé answering in their context.",
  },
  research: {
    heading: "Grounded in real pedagogy",
    body: "Spaced practice, mastery checks, and self-regulated learning — methods that hold up under study, from EPFL ML-for-Education PhDs.",
  },
  speed: {
    heading: "Micro by design",
    body: "Two-minute lessons, mobile-friendly, right in the flow of work. Momentum is the curriculum.",
  },
};

const PROOF_COPY = {
  heading: "Trusted by teams putting AI to work",
  body: "Used across enterprise pilots to lift adoption and prove impact (illustrative proof points for this demo).",
};

const METRICS_COPY = {
  heading: "What teams see",
  body: "3.2 hrs/week saved per active learner · 78% 30-day adoption · 11% monthly lift in measured mastery (illustrative).",
};

function copyForSlot(slot: Slot): { heading: string; body: string } {
  if (slot.kind === "hero") return HERO_COPY[slot.angle];
  if (slot.kind === "social_proof") return PROOF_COPY;
  if (slot.kind === "metrics") return METRICS_COPY;
  return SECTION_COPY[slot.angle];
}

export function realizeVariant(plan: VariantPlan): PageSpec {
  const sections: Section[] = plan.slots.map((slot) => {
    const c = copyForSlot(slot);
    return { kind: slot.kind, angle: slot.angle, heading: c.heading, body: c.body };
  });
  return assembleSpec(plan, sections, HERO_COPY[plan.primaryAngle].heading, subheadFor(plan));
}

export function realizeVariantWithCopy(
  plan: VariantPlan,
  copy: { headline: string; subhead: string; sections: { heading: string; body: string }[] }
): PageSpec {
  const sections: Section[] = plan.slots.map((slot, i) => {
    const c = copy.sections[i] ?? copyForSlot(slot);
    return {
      kind: slot.kind,
      angle: slot.angle,
      heading: c.heading?.slice(0, 120) || copyForSlot(slot).heading,
      body: c.body?.slice(0, 400) || copyForSlot(slot).body,
    };
  });
  return assembleSpec(
    plan,
    sections,
    copy.headline?.slice(0, 120) || HERO_COPY[plan.primaryAngle].heading,
    copy.subhead?.slice(0, 240) || subheadFor(plan)
  );
}

function subheadFor(plan: VariantPlan): string {
  return `${ANGLE_LABEL[plan.primaryAngle]} meets ${ANGLE_LABEL[plan.secondaryAngle]} — features chosen by the fitted response model, with a "${CTA_LABEL[plan.cta]}" call to action.`;
}

// The variant's feature vector is exactly what the optimizer scored — angle
// blend, model-chosen scalars, actual length — so the simulated result and the
// model's prediction stay consistent.
function assembleSpec(
  plan: VariantPlan,
  sections: Section[],
  headline: string,
  subhead: string
): PageSpec {
  const features: PageFeatures = {
    angleWeights: plan.angleWeights,
    ctaType: plan.cta,
    ctaStrength: ctaStrengthOf[plan.cta],
    socialProof: plan.socialProof,
    specificity: plan.specificity,
    visualDensity: 0.65,
    length: sections.length,
  };
  return {
    id: plan.id,
    name: plan.name,
    origin: "generated",
    primaryAngle: plan.primaryAngle,
    secondaryAngle: plan.secondaryAngle,
    cta: { type: plan.cta, label: CTA_LABEL[plan.cta] },
    headline,
    subhead,
    sections,
    features,
    accent: plan.accent,
    generatedFor: plan.generatedFor,
    rationale: plan.rationale,
  };
}
