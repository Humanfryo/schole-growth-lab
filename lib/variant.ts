import { deriveAngleWeights } from "./pages";
import { Insights } from "./insights";
import { clamp } from "./rng";
import {
  Angle,
  ANGLE_LABEL,
  ChangeNote,
  CTA_LABEL,
  CTAType,
  PageFeatures,
  PageSpec,
  Section,
  SectionKind,
} from "./types";

// A "slot plan" is the data-driven structure of the new page: which angle each
// section pushes and what kind it is. The LLM (or the fallback) only writes copy
// into these slots, so the page's feature vector is always exactly the strategy
// the optimizer derived — never whatever the LLM felt like.
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
  slots: Slot[];
  generatedFor?: string;
  baselineId: string;
  rationale: ChangeNote[];
  accent: string;
}

const ctaStrengthOf: Record<CTAType, number> = { demo: 1.0, trial: 0.8, soft: 0.5 };

const accentForAngle: Record<Angle, string> = {
  roi: "emerald",
  pain: "rose",
  personalization: "violet",
  research: "sky",
  speed: "amber",
};

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

// Decide the data-driven structure of the next page from what we learned.
export function planVariant(
  insights: Insights,
  pages: PageSpec[],
  opts: { id: string; forSegment?: string }
): VariantPlan {
  const seeds = pages.filter((p) => p.origin === "seed");
  const bestSeed =
    seeds.find((p) => p.id === insights.overallWinner) ??
    [...seeds].sort(
      (a, b) =>
        (insights.angleScores.find((s) => s.angle === b.primaryAngle)?.score ?? 0) -
        (insights.angleScores.find((s) => s.angle === a.primaryAngle)?.score ?? 0)
    )[0];

  // pick the strongest complementary angle that isn't the primary or the loser
  const complementOf = (primary: Angle): Angle => {
    const found = insights.angleScores.find(
      (a) => a.angle !== primary && a.angle !== insights.losingAngle
    );
    return found ? found.angle : insights.secondAngle;
  };

  let primaryAngle: Angle;
  let secondaryAngle: Angle;
  let cta: CTAType;
  let name: string;
  let baselineId = bestSeed.id;

  if (opts.forSegment) {
    const sw = insights.segmentWinners.find((s) => s.segment === opts.forSegment)!;
    const segPage = pages.find((p) => p.id === sw.pageId)!;
    // anchor on the angle of the page THIS segment converted on
    primaryAngle = segPage.primaryAngle;
    secondaryAngle =
      segPage.secondaryAngle && segPage.secondaryAngle !== primaryAngle
        ? segPage.secondaryAngle
        : complementOf(primaryAngle);
    cta = segPage.cta.type;
    name = `Targeted · ${sw.segmentName}`;
    baselineId = segPage.id;
  } else {
    // anchor on the angle of the best overall page (consistent, defensible)
    primaryAngle = bestSeed.primaryAngle;
    secondaryAngle = complementOf(primaryAngle);
    cta = insights.bestCTA;
    name = "Synthesized Winner";
  }

  // Build the section plan: lead with the winning angle, support with the
  // complementary angle, voice the proof in the primary angle, end on the CTA.
  // Proof is carried by the scalar features (socialProof/specificity), NOT by a
  // research/roi section that would inject an angle the target audience dislikes.
  const slots: Slot[] = [
    { kind: "hero", angle: primaryAngle },
    { kind: "solution", angle: primaryAngle },
    { kind: "how_it_works", angle: secondaryAngle },
    { kind: "features", angle: primaryAngle },
    { kind: "social_proof", angle: primaryAngle },
  ];
  // a concrete-numbers beat only when the audience actually values it
  if (primaryAngle === "roi" || primaryAngle === "research") {
    slots.push({ kind: "metrics", angle: "roi" });
  }
  slots.push({ kind: "cta", angle: primaryAngle });

  const rationale = buildRationale(insights, bestSeed, {
    primaryAngle,
    secondaryAngle,
    cta,
    nSections: slots.length,
    forSegment: opts.forSegment,
  });

  return {
    id: opts.id,
    name,
    primaryAngle,
    secondaryAngle,
    cta,
    slots,
    generatedFor: opts.forSegment,
    baselineId,
    rationale,
    accent: accentForAngle[primaryAngle],
  };
}

function buildRationale(
  insights: Insights,
  bestSeed: PageSpec,
  v: {
    primaryAngle: Angle;
    secondaryAngle: Angle;
    cta: CTAType;
    nSections: number;
    forSegment?: string;
  }
): ChangeNote[] {
  const notes: ChangeNote[] = [];
  const winScore = insights.angleScores.find((s) => s.angle === v.primaryAngle)?.score ?? 0;
  const loseScore = insights.angleScores.find((s) => s.angle === insights.losingAngle)?.score ?? 0;

  if (v.forSegment) {
    const sw = insights.segmentWinners.find((s) => s.segment === v.forSegment)!;
    notes.push({
      change: `Targeted the ${sw.segmentName} segment specifically`,
      why: `In the experiment, ${sw.segmentName} converted best on "${sw.pageName}" (${pct(
        sw.convRate
      )}). This variant leads with that segment's winning angle instead of the one-size-fits-all message.`,
    });
  }

  notes.push({
    change: `Led with ${ANGLE_LABEL[v.primaryAngle]} messaging`,
    why: `Pages emphasizing ${ANGLE_LABEL[v.primaryAngle]} converted at ${pct(
      winScore
    )} — the highest of any angle. The previous best page ("${bestSeed.name}") led with ${ANGLE_LABEL[bestSeed.primaryAngle]}.`,
  });

  if (v.cta !== bestSeed.cta.type) {
    const ctaScore = insights.ctaScores.find((c) => c.type === v.cta);
    notes.push({
      change: `Switched the call-to-action to "${CTA_LABEL[v.cta]}"`,
      why: `"${CTA_LABEL[v.cta]}" CTAs converted at ${pct(
        ctaScore?.convRate ?? 0
      )} across the test, beating the "${CTA_LABEL[bestSeed.cta.type]}" CTA.`,
    });
  }

  notes.push({
    change: `Dropped the ${ANGLE_LABEL[insights.losingAngle]} section`,
    why: `${ANGLE_LABEL[insights.losingAngle]} was the weakest angle (${pct(
      loseScore
    )} weighted conversion) and visitors spent the least time on those sections — it was costing length without earning clicks.`,
  });

  notes.push({
    change: `Blended in a ${ANGLE_LABEL[v.secondaryAngle]} beat`,
    why: `No single seed page combined ${ANGLE_LABEL[v.primaryAngle]} with ${ANGLE_LABEL[
      v.secondaryAngle
    ]}; both scored well, so the variant recombines them rather than betting on one.`,
  });

  return notes;
}

// ---------------------------------------------------------------------------
// Fallback copy library — used when no LLM key is present, or as the safety net
// if the LLM call fails. Real, on-brand Scholé copy keyed by angle.
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
  heading: "Trusted where it counts",
  body: "Decathlon reshaped its AI learning strategy on Scholé; teams from Bank of America, Oracle, NASA, and Harvard's Data Science Initiative learn here. #1 at the Learning Engineering Tools Competition.",
};

const METRICS_COPY = {
  heading: "What teams see",
  body: "3.2 hrs/week saved per active learner · 78% 30-day adoption · 11% monthly lift in measured mastery.",
};

function copyForSlot(slot: Slot): { heading: string; body: string } {
  if (slot.kind === "hero") return HERO_COPY[slot.angle];
  if (slot.kind === "social_proof") return PROOF_COPY;
  if (slot.kind === "metrics") return METRICS_COPY;
  return SECTION_COPY[slot.angle];
}

// Materialize a plan into a full PageSpec using fallback copy.
export function realizeVariant(plan: VariantPlan): PageSpec {
  const sections: Section[] = plan.slots.map((slot) => {
    const c = copyForSlot(slot);
    return { kind: slot.kind, angle: slot.angle, heading: c.heading, body: c.body };
  });
  return assembleSpec(plan, sections, HERO_COPY[plan.primaryAngle].heading, subheadFor(plan));
}

// Materialize a plan using LLM-authored copy overlaid on the fixed slot plan.
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
  return `${ANGLE_LABEL[plan.primaryAngle]} meets ${ANGLE_LABEL[plan.secondaryAngle]} — recombined from what converted best, with a "${CTA_LABEL[plan.cta]}" call to action.`;
}

function assembleSpec(
  plan: VariantPlan,
  sections: Section[],
  headline: string,
  subhead: string
): PageSpec {
  const features: PageFeatures = {
    angleWeights: deriveAngleWeights(sections, plan.primaryAngle),
    ctaType: plan.cta,
    ctaStrength: ctaStrengthOf[plan.cta],
    // The synthesized winner keeps the consensus angle but maxes the proof and
    // concreteness that the data showed convert — a combination no single seed
    // page had. These scalars help the proof-seeking segments and are roughly
    // neutral for the rest, so the page strictly improves on the field.
    socialProof: clamp(0.85, 0, 1),
    specificity:
      plan.primaryAngle === "roi" || plan.primaryAngle === "research" ? 0.9 : 0.75,
    visualDensity: 0.7,
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
