import { Angle, CTAType } from "./types";

// The HIDDEN model. The optimizer never sees these vectors — it only observes
// behavior. Each persona is a buyer archetype with latent angle affinities and
// preferences. Traffic is a mixture over these personas.

export interface Persona {
  id: string;
  name: string;
  blurb: string;
  share: number; // mixture weight (sums to 1 across personas)
  anglePrefs: Record<Angle, number>; // -1..1, how much this buyer likes each angle
  ctaPref: CTAType;
  specificityPref: number; // 0..1 appetite for concrete numbers
  socialProofPref: number; // 0..1
  lengthTolerance: number; // 0..1, high = will read a long page
  baseLogit: number; // baseline conversion propensity (logit)
}

export const PERSONAS: Persona[] = [
  {
    id: "cfo",
    name: "Skeptical Exec",
    blurb:
      "VP/CFO-type evaluating spend. Wants proof and numbers, allergic to fluff and long pages. Will book a demo if the ROI is credible.",
    share: 0.3,
    anglePrefs: {
      roi: 0.95,
      pain: 0.3,
      personalization: 0.1,
      research: 0.7,
      speed: -0.35,
    },
    ctaPref: "demo",
    specificityPref: 0.95,
    socialProofPref: 0.7,
    lengthTolerance: 0.3,
    baseLogit: -5.4,
  },
  {
    id: "lnd",
    name: "L&D / People Lead",
    blurb:
      "Owns enablement. Feels the adoption-gap pain and cares that training fits every role. Reads carefully, values social proof.",
    share: 0.4,
    anglePrefs: {
      roi: 0.3,
      pain: 0.8,
      personalization: 0.95,
      research: 0.35,
      speed: 0.2,
    },
    ctaPref: "demo",
    specificityPref: 0.4,
    socialProofPref: 0.85,
    lengthTolerance: 0.75,
    baseLogit: -5.2,
  },
  {
    id: "ic",
    name: "Hands-on IC",
    blurb:
      "Practitioner who'll actually take the lessons. Wants speed and relevance, distrusts corporate proof and research framing. Prefers to just try it.",
    share: 0.3,
    anglePrefs: {
      roi: -0.2,
      pain: 0.3,
      personalization: 0.7,
      research: -0.3,
      speed: 0.95,
    },
    ctaPref: "trial",
    specificityPref: 0.3,
    socialProofPref: 0.2,
    lengthTolerance: 0.4,
    baseLogit: -5.0,
  },
];

export const PERSONA_BY_ID: Record<string, Persona> = Object.fromEntries(
  PERSONAS.map((p) => [p.id, p])
);
