import { PERSONA_BY_ID } from "./personas";
import { Angle, ANGLES, ANGLE_LABEL, CTAType, PageSpec, PageStat } from "./types";

export interface AngleScore {
  angle: Angle;
  score: number; // emphasis-weighted conversion rate
}

export interface SegmentWinner {
  segment: string;
  segmentName: string;
  pageId: string;
  pageName: string;
  convRate: number;
  visits: number;
  topAngle: Angle;
}

export interface AngleDwell {
  angle: Angle;
  convDwell: number; // avg dwell on this angle's sections among converters
  allDwell: number; // avg dwell among all visitors
  lift: number; // convDwell - allDwell
}

export interface Insights {
  overallWinner: string;
  overallWinnerName: string;
  angleScores: AngleScore[];
  winningAngle: Angle;
  secondAngle: Angle;
  losingAngle: Angle;
  ctaScores: { type: CTAType; convRate: number; visits: number }[];
  bestCTA: CTAType;
  hotAngles: AngleDwell[];
  coldAngles: AngleDwell[];
  segmentWinners: SegmentWinner[];
  segmentsDiffer: boolean;
}

// Turn raw experiment output into the patterns the optimizer "learned":
// which angle wins, which CTA converts, which sections converters dwell on,
// and crucially which page wins for which traffic segment.
export function computeInsights(pages: PageSpec[], stats: PageStat[]): Insights {
  const byId = new Map(pages.map((p) => [p.id, p]));

  // --- overall winner ---
  const sorted = [...stats].sort((a, b) => b.convRate - a.convRate);
  const overallWinner = sorted[0].pageId;

  // --- angle credit assignment ---
  // weighted average of page conversion rates, weighted by how much each page
  // emphasizes the angle. Independent of how the bandit split traffic.
  const angleScores: AngleScore[] = ANGLES.map((angle) => {
    let num = 0;
    let den = 0;
    for (const s of stats) {
      const p = byId.get(s.pageId)!;
      const w = p.features.angleWeights[angle];
      num += w * s.convRate;
      den += w;
    }
    return { angle, score: den > 0 ? num / den : 0 };
  }).sort((a, b) => b.score - a.score);

  // --- CTA credit ---
  const ctaAgg: Record<CTAType, { visits: number; conv: number }> = {
    demo: { visits: 0, conv: 0 },
    trial: { visits: 0, conv: 0 },
    soft: { visits: 0, conv: 0 },
  };
  for (const s of stats) {
    const p = byId.get(s.pageId)!;
    ctaAgg[p.cta.type].visits += s.visits;
    ctaAgg[p.cta.type].conv += s.conversions;
  }
  const ctaScores = (Object.keys(ctaAgg) as CTAType[])
    .map((type) => ({
      type,
      visits: ctaAgg[type].visits,
      convRate: ctaAgg[type].visits ? ctaAgg[type].conv / ctaAgg[type].visits : 0,
    }))
    .filter((c) => c.visits > 0)
    .sort((a, b) => b.convRate - a.convRate);

  // --- section dwell credit (hot / cold sections by angle) ---
  const dwellAgg: Record<Angle, { convSum: number; convW: number; allSum: number; allW: number }> =
    Object.fromEntries(
      ANGLES.map((a) => [a, { convSum: 0, convW: 0, allSum: 0, allW: 0 }])
    ) as Record<Angle, { convSum: number; convW: number; allSum: number; allW: number }>;

  for (const s of stats) {
    const p = byId.get(s.pageId)!;
    p.sections.forEach((sec, i) => {
      const d = dwellAgg[sec.angle];
      d.convSum += (s.sectionDwellConverters[i] ?? 0) * s.conversions;
      d.convW += s.conversions;
      d.allSum += (s.sectionDwellAll[i] ?? 0) * s.visits;
      d.allW += s.visits;
    });
  }
  const angleDwell: AngleDwell[] = ANGLES.map((angle) => {
    const d = dwellAgg[angle];
    const convDwell = d.convW ? d.convSum / d.convW : 0;
    const allDwell = d.allW ? d.allSum / d.allW : 0;
    return { angle, convDwell, allDwell, lift: convDwell - allDwell };
  });
  const hotAngles = [...angleDwell].sort((a, b) => b.lift - a.lift).slice(0, 2);
  const coldAngles = [...angleDwell].sort((a, b) => a.allDwell - b.allDwell).slice(0, 2);

  // --- segment winners (the targeting story) ---
  const segmentWinners: SegmentWinner[] = Object.keys(PERSONA_BY_ID).map((seg) => {
    let best = { pageId: "", convRate: -1, visits: 0 };
    for (const s of stats) {
      const sek = s.bySegment[seg];
      if (!sek || sek.visits < 1) continue;
      if (sek.convRate > best.convRate) {
        best = { pageId: s.pageId, convRate: sek.convRate, visits: sek.visits };
      }
    }
    const page = byId.get(best.pageId);
    return {
      segment: seg,
      segmentName: PERSONA_BY_ID[seg].name,
      pageId: best.pageId,
      pageName: page?.name ?? "—",
      convRate: best.convRate < 0 ? 0 : best.convRate,
      visits: best.visits,
      topAngle: page?.primaryAngle ?? "personalization",
    };
  });
  const winnerPages = new Set(segmentWinners.map((s) => s.pageId));
  const segmentsDiffer = winnerPages.size > 1;

  void ANGLE_LABEL;

  return {
    overallWinner,
    overallWinnerName: byId.get(overallWinner)?.name ?? overallWinner,
    angleScores,
    winningAngle: angleScores[0].angle,
    secondAngle: angleScores[1].angle,
    losingAngle: angleScores[angleScores.length - 1].angle,
    ctaScores,
    bestCTA: ctaScores[0]?.type ?? "demo",
    hotAngles,
    coldAngles,
    segmentWinners,
    segmentsDiffer,
  };
}
