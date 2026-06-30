import { ResponseModel } from "./learn";
import { PERSONA_BY_ID } from "./personas";
import { Coefficient, FitResult } from "./regression";
import { Angle, ANGLES, CTAType, PageSpec, PageStat } from "./types";

export interface AngleCoef {
  angle: Angle;
  coef: number;
  ci: [number, number];
}

export interface CTACoef {
  type: CTAType;
  coef: number;
  ci: [number, number];
}

// A human-readable summary of one fitted response model (population or segment).
export interface FitSummary {
  angleCoefs: AngleCoef[]; // sorted desc
  ctaCoefs: CTACoef[]; // sorted desc; soft is the 0 baseline
  proofCoef: Coefficient;
  specCoef: Coefficient;
  lengthCoef: Coefficient;
  winningAngle: Angle;
  secondAngle: Angle;
  losingAngle: Angle;
  bestCTA: CTAType;
}

export function summarizeFit(fit: FitResult): FitSummary {
  const cb = fit.coefByName;
  const angleCoefs: AngleCoef[] = ANGLES.map((angle) => ({
    angle,
    coef: cb[angle].value,
    ci: cb[angle].ci,
  })).sort((a, b) => b.coef - a.coef);

  const ctaCoefs: CTACoef[] = [
    { type: "demo" as CTAType, coef: cb.cta_demo.value, ci: cb.cta_demo.ci },
    { type: "trial" as CTAType, coef: cb.cta_trial.value, ci: cb.cta_trial.ci },
    { type: "soft" as CTAType, coef: 0, ci: [0, 0] as [number, number] },
  ].sort((a, b) => b.coef - a.coef);

  return {
    angleCoefs,
    ctaCoefs,
    proofCoef: cb.socialProof,
    specCoef: cb.specificity,
    lengthCoef: cb.lengthNorm,
    winningAngle: angleCoefs[0].angle,
    secondAngle: angleCoefs[1].angle,
    losingAngle: angleCoefs[angleCoefs.length - 1].angle,
    bestCTA: ctaCoefs[0].type,
  };
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
  convDwell: number;
  allDwell: number;
  lift: number;
}

export interface Insights extends FitSummary {
  overallWinner: string;
  overallWinnerName: string;
  hotAngles: AngleDwell[];
  coldAngles: AngleDwell[];
  segmentWinners: SegmentWinner[];
  segmentsDiffer: boolean;
  model: ResponseModel;
}

export function computeInsights(
  showcasePages: PageSpec[],
  showcaseStats: PageStat[],
  model: ResponseModel
): Insights {
  const byId = new Map(showcasePages.map((p) => [p.id, p]));
  const summary = summarizeFit(model.population);

  const sortedStats = [...showcaseStats].sort((a, b) => b.convRate - a.convRate);
  const overallWinner = sortedStats[0]?.pageId ?? showcasePages[0].id;

  // attention (dwell) from showcase pages, all visitors vs converters
  const dwellAgg: Record<Angle, { convSum: number; convW: number; allSum: number; allW: number }> =
    Object.fromEntries(
      ANGLES.map((a) => [a, { convSum: 0, convW: 0, allSum: 0, allW: 0 }])
    ) as Record<Angle, { convSum: number; convW: number; allSum: number; allW: number }>;
  for (const s of showcaseStats) {
    const p = byId.get(s.pageId);
    if (!p) continue;
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

  const segmentWinners: SegmentWinner[] = Object.keys(PERSONA_BY_ID).map((seg) => {
    let best = { pageId: "", convRate: -1, visits: 0 };
    for (const s of showcaseStats) {
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
      pageId: best.pageId || "—",
      pageName: page?.name ?? "—",
      convRate: best.convRate < 0 ? 0 : best.convRate,
      visits: best.visits,
      topAngle: page?.primaryAngle ?? summary.winningAngle,
    };
  });
  const segmentsDiffer = new Set(segmentWinners.map((s) => s.pageId)).size > 1;

  return {
    ...summary,
    overallWinner,
    overallWinnerName: byId.get(overallWinner)?.name ?? overallWinner,
    hotAngles,
    coldAngles,
    segmentWinners,
    segmentsDiffer,
    model,
  };
}
