import {
  Angle,
  ANGLES,
  CTAType,
  PageFeatures,
  PageSpec,
  Section,
} from "./types";

// Derive angle weights from a page's sections so the numeric features the model
// reads always reflect the actual content. The hero and the primary angle carry
// extra emphasis, mirroring how a headline dominates first impressions.
export function deriveAngleWeights(
  sections: Section[],
  primaryAngle: Angle
): Record<Angle, number> {
  const w: Record<Angle, number> = {
    roi: 0,
    pain: 0,
    personalization: 0,
    research: 0,
    speed: 0,
  };
  for (const s of sections) {
    w[s.angle] += s.kind === "hero" ? 2.5 : 1;
  }
  w[primaryAngle] += 1; // headline emphasis
  const sum = ANGLES.reduce((a, k) => a + w[k], 0) || 1;
  for (const k of ANGLES) w[k] /= sum;
  return w;
}

const ctaStrengthOf: Record<CTAType, number> = {
  demo: 1.0,
  trial: 0.8,
  soft: 0.5,
};

interface SeedInput {
  id: string;
  name: string;
  primaryAngle: Angle;
  secondaryAngle?: Angle;
  cta: CTAType;
  ctaLabel: string;
  headline: string;
  subhead: string;
  accent: string;
  sections: Section[];
  // scalar features authored per page
  socialProof: number;
  specificity: number;
  visualDensity: number;
}

function buildPage(s: SeedInput): PageSpec {
  const features: PageFeatures = {
    angleWeights: deriveAngleWeights(s.sections, s.primaryAngle),
    ctaType: s.cta,
    ctaStrength: ctaStrengthOf[s.cta],
    socialProof: s.socialProof,
    specificity: s.specificity,
    visualDensity: s.visualDensity,
    length: s.sections.length,
  };
  return {
    id: s.id,
    name: s.name,
    origin: "seed",
    primaryAngle: s.primaryAngle,
    secondaryAngle: s.secondaryAngle,
    cta: { type: s.cta, label: s.ctaLabel },
    headline: s.headline,
    subhead: s.subhead,
    sections: s.sections,
    features,
    accent: s.accent,
  };
}

// ---------------------------------------------------------------------------
// The five seed pages. Same product (Scholé), five distinct GTM strategies.
// ---------------------------------------------------------------------------

export const SEED_PAGES: PageSpec[] = [
  // A — ROI / Proof. Exec & finance buyer. Numbers everywhere. Book a demo.
  buildPage({
    id: "A",
    name: "ROI & Proof",
    primaryAngle: "roi",
    secondaryAngle: "research",
    cta: "demo",
    ctaLabel: "Book a demo",
    accent: "emerald",
    headline: "Measure AI adoption. Prove the ROI.",
    subhead:
      "Scholé turns AI training spend into a number you can take to the board — adoption, mastery, and hours saved, per team.",
    socialProof: 0.7,
    specificity: 0.95,
    visualDensity: 0.6,
    sections: [
      {
        kind: "hero",
        angle: "roi",
        heading: "Measure AI adoption. Prove the ROI.",
        body: "Most AI training is a cost with no proof. Scholé makes it a measurable line item: adoption rates, mastery scores, and hours saved per role.",
      },
      {
        kind: "metrics",
        angle: "roi",
        heading: "The numbers leadership asks for",
        body: "Every cohort reports back in the language your CFO already speaks.",
        bullets: [
          "3.2 hrs/week saved per active learner",
          "78% 30-day adoption across pilot teams",
          "11% lift in measured task mastery per month",
        ],
      },
      {
        kind: "problem",
        angle: "pain",
        heading: "AI spend you can't defend",
        body: "Seats for ChatGPT and Copilot show up on the invoice. The impact never shows up in a report. That gap is where budgets get cut.",
      },
      {
        kind: "solution",
        angle: "roi",
        heading: "An adoption dashboard, not a course catalog",
        body: "Track who is actually using AI, on which tasks, and what it returns — by team, by role, over time.",
      },
      {
        kind: "research",
        angle: "research",
        heading: "Grounded in learning science",
        body: "The measurement model comes out of 10+ years of EPFL and UC Berkeley research on what actually moves competency.",
      },
      {
        kind: "social_proof",
        angle: "roi",
        heading: "Trusted where ROI is non-negotiable",
        body: "Decathlon reshaped its AI learning strategy on Scholé; teams from Bank of America, Oracle, and NASA learn on the platform.",
      },
      {
        kind: "cta",
        angle: "roi",
        heading: "See your team's AI ROI",
        body: "We'll model the return for your org on a 20-minute call.",
      },
    ],
  }),

  // B — Adoption-gap pain. Problem-led. Visceral opening. Book a demo.
  buildPage({
    id: "B",
    name: "Adoption-Gap Pain",
    primaryAngle: "pain",
    secondaryAngle: "personalization",
    cta: "demo",
    ctaLabel: "Fix the adoption gap",
    accent: "rose",
    headline: "Your team has ChatGPT. They still don't use it.",
    subhead:
      "Tool access isn't adoption. Scholé closes the gap between buying AI and your team actually working with it.",
    socialProof: 0.45,
    specificity: 0.4,
    visualDensity: 0.5,
    sections: [
      {
        kind: "hero",
        angle: "pain",
        heading: "Your team has ChatGPT. They still don't use it.",
        body: "You rolled out the licenses. Six weeks later, most of your team is back to doing it the old way. Access was never the problem.",
      },
      {
        kind: "problem",
        angle: "pain",
        heading: "The adoption gap is quiet and expensive",
        body: "People don't say 'I don't know how to use this.' They just quietly don't. The spend stays; the productivity never arrives.",
      },
      {
        kind: "solution",
        angle: "personalization",
        heading: "Training that meets people inside their real work",
        body: "Scholé maps AI to the tools and tasks each person already touches — Excel, Slack, Notion — so the first win happens on day one.",
      },
      {
        kind: "how_it_works",
        angle: "pain",
        heading: "From 'I should try AI' to 'I can't work without it'",
        body: "Short, role-specific nudges turn curiosity into habit before the novelty wears off.",
      },
      {
        kind: "social_proof",
        angle: "pain",
        heading: "Teams that crossed the gap",
        body: "Decathlon went from scattered AI curiosity to a reshaped, measured learning strategy.",
      },
      {
        kind: "cta",
        angle: "pain",
        heading: "Close your adoption gap",
        body: "Show us your stack; we'll show you where adoption is leaking.",
      },
    ],
  }),

  // C — Role personalization. Scholé's core thesis. Book a demo.
  buildPage({
    id: "C",
    name: "Role Personalization",
    primaryAngle: "personalization",
    secondaryAngle: "pain",
    cta: "demo",
    ctaLabel: "Personalize for my team",
    accent: "violet",
    headline: "One AI course for everyone teaches no one.",
    subhead:
      "Scholé adapts every lesson to the learner's role, tools, and skill level — so training fits the job instead of the other way around.",
    socialProof: 0.55,
    specificity: 0.5,
    visualDensity: 0.7,
    sections: [
      {
        kind: "hero",
        angle: "personalization",
        heading: "One AI course for everyone teaches no one.",
        body: "A finance analyst and a store manager don't need the same AI lesson. Scholé builds a different path for each, automatically.",
      },
      {
        kind: "solution",
        angle: "personalization",
        heading: "Adaptive by role, by tool, by task",
        body: "Lessons adjust in real time to what someone does all day and how fast they're picking it up — grounded in your own materials.",
      },
      {
        kind: "features",
        angle: "personalization",
        heading: "Meet Ask Olé",
        body: "A built-in AI tutor that answers in the context of each learner's role, not a generic FAQ.",
      },
      {
        kind: "problem",
        angle: "pain",
        heading: "Why one-size-fits-all fails",
        body: "Generic courses get a click-through and a shrug. Relevance is what turns a lesson into a behavior change.",
      },
      {
        kind: "how_it_works",
        angle: "personalization",
        heading: "Two-minute lessons that follow the learner",
        body: "Difficulty, format, and examples shift as the learner progresses — no two paths look the same.",
      },
      {
        kind: "social_proof",
        angle: "personalization",
        heading: "Built for real org complexity",
        body: "Used by teams from Decathlon to Oracle, across roles from frontline to finance.",
      },
      {
        kind: "cta",
        angle: "personalization",
        heading: "See a path built for your roles",
        body: "Tell us your team shape; we'll show role-specific paths on a quick call.",
      },
    ],
  }),

  // D — Research credibility. Anti-hype. Soft CTA (learn more).
  buildPage({
    id: "D",
    name: "Research Credibility",
    primaryAngle: "research",
    secondaryAngle: "roi",
    cta: "soft",
    ctaLabel: "Read the research",
    accent: "sky",
    headline: "AI upskilling, built on a decade of learning science.",
    subhead:
      "Scholé is a spin-out of EPFL and UC Berkeley research labs — pedagogy first, hype never.",
    socialProof: 0.85,
    specificity: 0.8,
    visualDensity: 0.4,
    sections: [
      {
        kind: "hero",
        angle: "research",
        heading: "AI upskilling, built on a decade of learning science.",
        body: "Most AI training is content thrown at a wall. Scholé is a multi-agent pedagogical engine grounded in peer-reviewed research.",
      },
      {
        kind: "research",
        angle: "research",
        heading: "From the lab, not the hype cycle",
        body: "Founded by EPFL ML-for-Education PhDs whose work scaled UC Berkeley's data science course from 100 to 1,700 students a semester.",
      },
      {
        kind: "research",
        angle: "research",
        heading: "Pedagogy that adapts, measured properly",
        body: "Spaced practice, mastery checks, and self-regulated learning — the methods that hold up under study, not just under a demo.",
      },
      {
        kind: "metrics",
        angle: "roi",
        heading: "Recognized work",
        body: "#1 at the Learning Engineering Tools Competition; named by Forbes among the best ways to learn AI agents in 2026.",
      },
      {
        kind: "founders",
        angle: "research",
        heading: "Who's behind it",
        body: "Dr. Vinitra Swamy (ex-Microsoft AI) and Dr. Paola Mejia, both EPFL ML-for-Education PhDs with 10+ years in AI for learning.",
      },
      {
        kind: "social_proof",
        angle: "research",
        heading: "Where the research is in production",
        body: "Learners from Harvard's Data Science Initiative, Apple, and Microsoft use Scholé today.",
      },
      {
        kind: "cta",
        angle: "research",
        heading: "Dig into the approach",
        body: "Read how the pedagogy works before you ever talk to us.",
      },
    ],
  }),

  // E — Speed / micro-learning. IC / practitioner. Try it now.
  buildPage({
    id: "E",
    name: "Speed / Micro-learning",
    primaryAngle: "speed",
    secondaryAngle: "personalization",
    cta: "trial",
    ctaLabel: "Try a 2-minute lesson",
    accent: "amber",
    headline: "Real AI skills, in two-minute lessons.",
    subhead:
      "No 40-minute modules. Scholé teaches the one AI move that helps your actual job, today, before your coffee's cold.",
    socialProof: 0.3,
    specificity: 0.55,
    visualDensity: 0.8,
    sections: [
      {
        kind: "hero",
        angle: "speed",
        heading: "Real AI skills, in two-minute lessons.",
        body: "Learning AI shouldn't mean blocking your afternoon. Each Scholé lesson is one practical move you can use in the next hour.",
      },
      {
        kind: "features",
        angle: "speed",
        heading: "Micro by design",
        body: "Two-minute lessons, mobile-friendly, right in the flow of work via a browser extension.",
      },
      {
        kind: "how_it_works",
        angle: "personalization",
        heading: "Tuned to what you do",
        body: "Tell it your role once; every micro-lesson after that is about your tools and your tasks.",
      },
      {
        kind: "features",
        angle: "speed",
        heading: "Streaks, not syllabi",
        body: "A daily two-minute habit beats a course you'll never finish. Momentum is the curriculum.",
      },
      {
        kind: "cta",
        angle: "speed",
        heading: "Try one right now",
        body: "Pick your role and take a single two-minute lesson — no signup wall.",
      },
    ],
  }),
];

export const SEED_PAGE_IDS = SEED_PAGES.map((p) => p.id);

export function pageById(pages: PageSpec[], id: string): PageSpec | undefined {
  return pages.find((p) => p.id === id);
}
