import { Angle, ANGLE_LABEL, CTA_LABEL, CTAType } from "./types";
import { VariantPlan } from "./variant";

export interface VariantCopy {
  headline: string;
  subhead: string;
  sections: { heading: string; body: string }[];
}

// Only the fields the prompt actually needs — a slim, serializable payload the
// client can POST without dragging the fitted model (which holds functions).
export interface PromptInsights {
  winningAngle: Angle;
  bestCTA: CTAType;
  losingAngle: Angle;
  segmentWinners: { segmentName: string; topAngle: Angle }[];
}

// The LLM's job is deliberately narrow: write the COPY for a page structure the
// optimizer already decided from data. It never picks the strategy — that keeps
// the feature vector honest and the experiment reproducible.
export function buildVariantPrompt(
  plan: VariantPlan,
  insights: PromptInsights
): { system: string; user: string } {
  const system = [
    "You are a senior growth copywriter for Scholé, an AI-native, role-based upskilling platform for enterprises (adaptive 2-minute lessons, an AI tutor called Ask Olé, HR adoption dashboards, built on EPFL + UC Berkeley learning-science research).",
    "You write tight, concrete, anti-hype B2B landing-page copy. No buzzword salad, no exclamation spam.",
    "You will be given the data-driven STRUCTURE of a new landing page (already decided by an experimentation system) and must only write the words for each slot.",
    "Return ONLY valid minified JSON, no markdown fences, matching exactly:",
    '{"headline": string, "subhead": string, "sections": [{"heading": string, "body": string}]}',
    "The sections array MUST have exactly the same length and order as the slots given, one object per slot.",
    "Headlines <= 12 words. Section bodies <= 45 words.",
  ].join("\n");

  const learned = [
    `- Highest-converting message angle: ${ANGLE_LABEL[insights.winningAngle]}.`,
    `- Best-performing call-to-action: "${CTA_LABEL[insights.bestCTA]}".`,
    `- Weakest angle (being dropped): ${ANGLE_LABEL[insights.losingAngle]}.`,
    `- Segments converted differently: ${insights.segmentWinners
      .map((s) => `${s.segmentName}→${ANGLE_LABEL[s.topAngle]}`)
      .join(", ")}.`,
  ].join("\n");

  const slotList = plan.slots
    .map(
      (s, i) =>
        `  ${i + 1}. [${s.kind}] angle="${ANGLE_LABEL[s.angle]}"` +
        (s.kind === "hero" ? " (this is the hero; headline+subhead live here)" : "") +
        (s.kind === "cta" ? ` (closing CTA for "${CTA_LABEL[plan.cta]}")` : "")
    )
    .join("\n");

  const target = plan.generatedFor
    ? `This is a TARGETED variant for the "${plan.name}" audience segment.`
    : `This is the primary synthesized winner for the general audience.`;

  const user = [
    target,
    "",
    "What the experiment learned:",
    learned,
    "",
    `Lead angle: ${ANGLE_LABEL[plan.primaryAngle]}. Supporting angle: ${ANGLE_LABEL[plan.secondaryAngle]}. CTA: "${CTA_LABEL[plan.cta]}".`,
    "",
    "Write copy for these slots, in order:",
    slotList,
    "",
    "Return the JSON now.",
  ].join("\n");

  return { system, user };
}

// Robustly pull a VariantCopy out of a raw model response (handles stray code
// fences or prose around the JSON).
export function parseVariantCopy(raw: string, expectedSections: number): VariantCopy | null {
  if (!raw) return null;
  let text = raw.trim();
  // strip code fences if present
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  // grab the outermost JSON object
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (typeof obj.headline !== "string" || !Array.isArray(obj.sections)) return null;
    const sections = obj.sections
      .slice(0, expectedSections)
      .map((s: { heading?: unknown; body?: unknown }) => ({
        heading: String(s?.heading ?? ""),
        body: String(s?.body ?? ""),
      }));
    return {
      headline: String(obj.headline),
      subhead: String(obj.subhead ?? ""),
      sections,
    };
  } catch {
    return null;
  }
}
