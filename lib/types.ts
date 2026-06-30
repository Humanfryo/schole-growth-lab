// Shared domain types for the Self-Improving Landing Page Lab.

export const ANGLES = [
  "roi",
  "pain",
  "personalization",
  "research",
  "speed",
] as const;

export type Angle = (typeof ANGLES)[number];

export const ANGLE_LABEL: Record<Angle, string> = {
  roi: "ROI & Proof",
  pain: "Adoption-Gap Pain",
  personalization: "Role Personalization",
  research: "Research Credibility",
  speed: "Speed / Micro-learning",
};

export type CTAType = "demo" | "trial" | "soft";

export const CTA_LABEL: Record<CTAType, string> = {
  demo: "Book a demo",
  trial: "Try it now",
  soft: "Learn more",
};

export type SectionKind =
  | "hero"
  | "problem"
  | "solution"
  | "features"
  | "metrics"
  | "social_proof"
  | "research"
  | "how_it_works"
  | "founders"
  | "cta";

export interface Section {
  kind: SectionKind;
  angle: Angle;
  heading: string;
  body: string;
  bullets?: string[];
}

// Numeric feature vector the (hidden) behavior model reads. Angle weights are
// derived from the page's sections; the scalar features are authored per page.
export interface PageFeatures {
  angleWeights: Record<Angle, number>; // sums to ~1
  ctaType: CTAType;
  ctaStrength: number; // 0..1, how high-commitment the CTA is
  socialProof: number; // 0..1 prominence of logos / testimonials
  specificity: number; // 0..1 density of concrete numbers
  visualDensity: number; // 0..1
  length: number; // number of sections
}

export interface PageSpec {
  id: string; // "A".."E" for seeds, "V1"... for generated
  name: string;
  origin: "seed" | "generated";
  primaryAngle: Angle;
  secondaryAngle?: Angle;
  cta: { type: CTAType; label: string };
  headline: string;
  subhead: string;
  sections: Section[];
  features: PageFeatures;
  accent: string; // tailwind color token for the rendered page
  generatedFor?: string; // segment id, if a targeted variant
  rationale?: ChangeNote[]; // "what changed and why", for generated pages
}

export interface ChangeNote {
  change: string;
  why: string;
}

// One simulated visit's observable signals (what the optimizer is allowed
// to see). The persona is exposed only as an opaque "segment" tag, the way a
// real funnel knows traffic source via UTM but not a user's true preferences.
export interface Visit {
  pageId: string;
  segment: string; // persona id, treated as observable traffic segment
  sectionDwell: number[]; // seconds per section, 0 if never viewed
  scrollDepth: number; // 0..1
  timeOnPage: number; // seconds
  bounced: boolean;
  converted: boolean; // CTA click
}

export interface PageStat {
  pageId: string;
  visits: number;
  conversions: number;
  convRate: number;
  ci: [number, number];
  avgScrollDepth: number;
  avgTimeOnPage: number;
  bounceRate: number;
  // average dwell per section index, all visitors vs converters only
  sectionDwellAll: number[];
  sectionDwellConverters: number[];
  bySegment: Record<string, { visits: number; conversions: number; convRate: number }>;
}
