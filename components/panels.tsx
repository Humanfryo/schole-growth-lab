import { EvolutionResult } from "@/lib/lab";
import { Insights } from "@/lib/insights";
import { ANGLE_COLORS } from "@/lib/colors";
import { PERSONAS } from "@/lib/personas";
import { ANGLE_LABEL, CTA_LABEL, PageSpec, PageStat } from "@/lib/types";
import { Card, Pill, pctText } from "./ui";

function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ---------------------------------------------------------------------------
// Leaderboard — conversion rate with Wilson bands + significance state.
// ---------------------------------------------------------------------------
export function Leaderboard({
  pages,
  stats,
  bestId,
  significant,
  pBest,
}: {
  pages: PageSpec[];
  stats: PageStat[];
  bestId: string;
  significant?: boolean;
  pBest?: Record<string, number>;
}) {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const sorted = [...stats].sort((a, b) => b.convRate - a.convRate);
  const max = Math.max(...sorted.map((s) => s.ci[1]), 0.01);

  return (
    <div className="space-y-2.5">
      {sorted.map((s, i) => {
        const p = byId.get(s.pageId);
        if (!p) return null;
        const c = ANGLE_COLORS[p.primaryAngle];
        const isBest = s.pageId === bestId;
        const winProb = pBest?.[s.pageId];
        return (
          <div
            key={s.pageId}
            className={`rounded-xl border p-3.5 ${
              isBest ? `${c.border} ${c.bgSoft}` : "border-zinc-200 bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-4 text-sm font-bold text-zinc-400">{i + 1}</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
                {s.pageId}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-zinc-900">{p.name}</span>
                  {p.origin === "generated" && <Pill className="bg-zinc-900 text-white">NEW</Pill>}
                  {isBest && significant && <Pill className={`${c.bg} text-white`}>WINNER ✓ sig</Pill>}
                  {isBest && significant === false && (
                    <Pill className="bg-amber-100 text-amber-700">leading · not yet sig</Pill>
                  )}
                  {isBest && significant === undefined && (
                    <Pill className={`${c.bg} text-white`}>WINNER</Pill>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold tabular-nums text-zinc-900">{pctText(s.convRate)}</div>
                <div className="text-[10px] tabular-nums text-zinc-400">
                  95% CI {pctText(s.ci[0])}–{pctText(s.ci[1])}
                </div>
              </div>
            </div>
            <div className="mt-2.5 ml-[3.4rem] mr-1">
              <div className="relative h-2 rounded-full bg-zinc-100">
                <div
                  className="absolute inset-y-0 rounded-full opacity-30"
                  style={{
                    left: `${(s.ci[0] / max) * 100}%`,
                    width: `${((s.ci[1] - s.ci[0]) / max) * 100}%`,
                    backgroundColor: c.hex,
                  }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(s.convRate / max) * 100}%`, backgroundColor: c.hex }}
                />
              </div>
            </div>
            <div className="mt-2 ml-[3.4rem] flex flex-wrap gap-4 text-[11px] text-zinc-500">
              <span>scroll {pctText(s.avgScrollDepth, 0)}</span>
              <span>time {s.avgTimeOnPage.toFixed(0)}s</span>
              <span>bounce {pctText(s.bounceRate, 0)}</span>
              {winProb !== undefined && (
                <span className="font-medium text-zinc-600">P(best) {pctText(winProb, 0)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coefficient plot — the fitted response model's effect sizes with 95% CIs.
// This is the honest "what converts, and how confident."
// ---------------------------------------------------------------------------
interface CoefRow {
  label: string;
  coef: number;
  ci: [number, number];
  hex: string;
}

function CoefficientPlot({ title, rows, note }: { title: string; rows: CoefRow[]; note?: string }) {
  const scale = Math.max(0.1, ...rows.flatMap((r) => [Math.abs(r.ci[0]), Math.abs(r.ci[1]), Math.abs(r.coef)]));
  const pos = (x: number) => 50 + (x / scale) * 48; // % position, 50% = zero
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h4>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const zero = pos(0);
          const cLo = pos(r.ci[0]);
          const cHi = pos(r.ci[1]);
          const pt = pos(r.coef);
          const sig = r.ci[0] > 0 || r.ci[1] < 0;
          return (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-[12px] font-medium text-zinc-700">{r.label}</span>
              <div className="relative h-5 flex-1">
                {/* zero line */}
                <div className="absolute inset-y-0 w-px bg-zinc-300" style={{ left: `${zero}%` }} />
                {/* CI whisker */}
                <div
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                  style={{ left: `${Math.min(cLo, cHi)}%`, width: `${Math.abs(cHi - cLo)}%`, backgroundColor: hexToRgba(r.hex, 0.4) }}
                />
                {/* point estimate */}
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                  style={{ left: `${pt}%`, backgroundColor: r.hex }}
                  title={`${r.coef.toFixed(2)} [${r.ci[0].toFixed(2)}, ${r.ci[1].toFixed(2)}]`}
                />
              </div>
              <span className={`w-16 shrink-0 text-right text-[11px] tabular-nums ${sig ? "font-semibold text-zinc-800" : "text-zinc-400"}`}>
                {r.coef >= 0 ? "+" : ""}
                {r.coef.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
      {note && <p className="mt-3 text-[11px] text-zinc-400">{note}</p>}
    </div>
  );
}

export function InsightsPanel({ insights }: { insights: Insights }) {
  const angleRows: CoefRow[] = insights.angleCoefs.map((a) => ({
    label: ANGLE_LABEL[a.angle],
    coef: a.coef,
    ci: a.ci,
    hex: ANGLE_COLORS[a.angle].hex,
  }));
  const leverRows: CoefRow[] = [
    { label: `CTA: ${CTA_LABEL.demo}`, coef: insights.ctaCoefs.find((c) => c.type === "demo")!.coef, ci: insights.ctaCoefs.find((c) => c.type === "demo")!.ci, hex: "#3f3f46" },
    { label: `CTA: ${CTA_LABEL.trial}`, coef: insights.ctaCoefs.find((c) => c.type === "trial")!.coef, ci: insights.ctaCoefs.find((c) => c.type === "trial")!.ci, hex: "#3f3f46" },
    { label: "Social proof", coef: insights.proofCoef.value, ci: insights.proofCoef.ci, hex: "#0f766e" },
    { label: "Specificity (numbers)", coef: insights.specCoef.value, ci: insights.specCoef.ci, hex: "#0f766e" },
    { label: "Page length", coef: insights.lengthCoef.value, ci: insights.lengthCoef.ci, hex: "#b45309" },
  ];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CoefficientPlot
          title="Message angle — fitted effect on conversion (log-odds)"
          rows={angleRows}
          note="Coefficients from a logistic model fit on the exploration design (CTA baseline = soft). Dots are point estimates; bars are 95% CIs. Bold = significant."
        />
      </Card>
      <Card>
        <CoefficientPlot
          title="Page levers — fitted effect (vs soft-CTA baseline)"
          rows={leverRows}
          note="CTA effect is identified independently of angle because the design varies them separately. Length is normalized; negative = longer pages convert worse."
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Behavior heatmap — per-section dwell.
// ---------------------------------------------------------------------------
export function BehaviorHeatmap({ pages, stats }: { pages: PageSpec[]; stats: PageStat[] }) {
  const byId = new Map(stats.map((s) => [s.pageId, s]));
  const maxDwell = Math.max(1, ...stats.flatMap((s) => s.sectionDwellAll));
  return (
    <div className="space-y-3">
      {pages.map((p) => {
        const s = byId.get(p.id);
        if (!s) return null;
        return (
          <div key={p.id} className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-bold text-white">
              {p.id}
            </span>
            <div className="flex flex-1 gap-1">
              {p.sections.map((sec, i) => {
                const d = s.sectionDwellAll[i] ?? 0;
                const c = ANGLE_COLORS[sec.angle];
                return (
                  <div
                    key={i}
                    title={`${sec.heading} — ${ANGLE_LABEL[sec.angle]} · ${d.toFixed(1)}s avg`}
                    className="flex h-9 flex-1 items-center justify-center rounded-md border border-white text-[10px] font-semibold text-white/80"
                    style={{ backgroundColor: hexToRgba(c.hex, 0.25 + 0.75 * (d / maxDwell)) }}
                  >
                    {d.toFixed(0)}s
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-zinc-400">Average dwell per section; darker = more attention.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment × page conversion matrix.
// ---------------------------------------------------------------------------
export function SegmentMatrix({ pages, stats }: { pages: PageSpec[]; stats: PageStat[] }) {
  const statById = new Map(stats.map((s) => [s.pageId, s]));
  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-[11px] font-semibold text-zinc-400">Segment ╲ Page</th>
            {pages.map((p) => (
              <th key={p.id} className="px-1 py-1 text-center">
                <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-bold text-white">
                  {p.id}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERSONAS.map((persona) => {
            const rowVals = pages.map((p) => statById.get(p.id)?.bySegment[persona.id]?.convRate ?? 0);
            const rowMax = Math.max(...rowVals, 0.001);
            return (
              <tr key={persona.id}>
                <td className="px-2 py-1 text-left">
                  <div className="text-[13px] font-semibold text-zinc-800">{persona.name}</div>
                  <div className="text-[10px] text-zinc-400">{pctText(persona.share, 0)} of traffic</div>
                </td>
                {pages.map((p, i) => {
                  const v = rowVals[i];
                  const isMax = v === rowMax && v > 0;
                  const c = ANGLE_COLORS[p.primaryAngle];
                  return (
                    <td key={p.id} className="p-0">
                      <div
                        className={`flex h-12 items-center justify-center rounded-md text-[12px] font-bold ${
                          isMax ? "text-white ring-2 ring-zinc-900" : "text-zinc-700"
                        }`}
                        style={{ backgroundColor: hexToRgba(c.hex, 0.12 + 0.88 * (v / rowMax)) }}
                      >
                        {pctText(v, 0)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evolution panel — frontier across rounds, with accept/reject.
// ---------------------------------------------------------------------------
export function EvolutionPanel({ evolution }: { evolution: EvolutionResult }) {
  const maxRate = Math.max(
    ...evolution.rounds.flatMap((r) => [r.observedRate, r.incumbentRate, r.frontier]),
    0.01
  );
  return (
    <div className="space-y-3">
      {evolution.rounds.map((r) => {
        const c = ANGLE_COLORS[r.variant.primaryAngle];
        return (
          <div key={r.round} className="rounded-xl border border-zinc-200 bg-white p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-bold text-white">
                {r.round}
              </span>
              <span className="text-[13px] font-semibold text-zinc-800">
                Candidate: lead with {ANGLE_LABEL[r.variant.primaryAngle]}
              </span>
              {r.accepted ? (
                <Pill className="bg-emerald-600 text-white">ACCEPTED ✓</Pill>
              ) : (
                <Pill className="bg-zinc-200 text-zinc-600">rejected — didn&apos;t beat incumbent</Pill>
              )}
              <span className="ml-auto text-[11px] text-zinc-400">
                predicted {pctText(r.predictedConv)}
              </span>
            </div>
            <div className="ml-8 space-y-1.5">
              <Bar label="this candidate" value={r.observedRate} max={maxRate} hex={c.hex} />
              <Bar label="incumbent best" value={r.incumbentRate} max={maxRate} hex="#a1a1aa" />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-zinc-400">
        Each round optimizes the next-best hypothesis against the fitted model and tests it live. Only
        a variant that beats the incumbent is kept — the frontier rises, then plateaus as the design
        space is exhausted.
      </p>
    </div>
  );
}

function Bar({ label, value, max, hex }: { label: string; value: number; max: number; hex: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] text-zinc-500">{label}</span>
      <div className="relative h-4 flex-1 rounded bg-zinc-100">
        <div
          className="flex h-4 items-center justify-end rounded px-1.5"
          style={{ width: `${Math.max(6, (value / max) * 100)}%`, backgroundColor: hex }}
        >
          <span className="text-[10px] font-bold text-white">{pctText(value)}</span>
        </div>
      </div>
    </div>
  );
}
