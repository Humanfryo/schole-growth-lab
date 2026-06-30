import { PERSONAS } from "./personas";
import { featurize, FitResult, fitLogistic } from "./regression";
import { PageSpec, Visit } from "./types";

// A fitted model of user behavior: one population-level logistic response model
// plus one per observable traffic segment. This is the "system learning from
// behavior" — coefficients (with CIs) for what drives conversion, learned only
// from observed visits, never from the hidden persona vectors.
export interface ResponseModel {
  population: FitResult;
  bySegment: Record<string, FitResult>;
  designPoints: number;
  visits: number;
}

export function fitResponseModel(
  designPages: PageSpec[],
  visits: Visit[],
  opts: { ridge?: number } = {}
): ResponseModel {
  const byId = new Map(designPages.map((p) => [p.id, p]));

  const Xall: number[][] = [];
  const yall: number[] = [];
  const xBySeg: Record<string, number[][]> = {};
  const yBySeg: Record<string, number[]> = {};
  for (const p of PERSONAS) {
    xBySeg[p.id] = [];
    yBySeg[p.id] = [];
  }

  for (const v of visits) {
    const page = byId.get(v.pageId);
    if (!page) continue;
    const x = featurize(page);
    const y = v.converted ? 1 : 0;
    Xall.push(x);
    yall.push(y);
    if (xBySeg[v.segment]) {
      xBySeg[v.segment].push(x);
      yBySeg[v.segment].push(y);
    }
  }

  const population = fitLogistic(Xall, yall, { ridge: opts.ridge ?? 1.0 });
  const bySegment: Record<string, FitResult> = {};
  for (const p of PERSONAS) {
    bySegment[p.id] = fitLogistic(xBySeg[p.id], yBySeg[p.id], { ridge: opts.ridge ?? 1.0 });
  }

  return {
    population,
    bySegment,
    designPoints: designPages.length,
    visits: visits.length,
  };
}
