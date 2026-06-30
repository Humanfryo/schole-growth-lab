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
// Leaderboard — conversion rate with Wilson confidence bands.
// ---------------------------------------------------------------------------
export function Leaderboard({
  pages,
  stats,
  bestId,
}: {
  pages: PageSpec[];
  stats: PageStat[];
  bestId: string;
}) {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const sorted = [...stats].sort((a, b) => b.convRate - a.convRate);
  const max = Math.max(...sorted.map((s) => s.ci[1]), 0.01);

  return (
    <div className="space-y-2.5">
      {sorted.map((s, i) => {
        const p = byId.get(s.pageId)!;
        const c = ANGLE_COLORS[p.primaryAngle];
        const isBest = s.pageId === bestId;
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
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-zinc-900">{p.name}</span>
                  {p.origin === "generated" && (
                    <Pill className="bg-zinc-900 text-white">NEW</Pill>
                  )}
                  {isBest && <Pill className={`${c.bg} text-white`}>WINNER</Pill>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold tabular-nums text-zinc-900">
                  {pctText(s.convRate)}
                </div>
                <div className="text-[10px] tabular-nums text-zinc-400">
                  95% CI {pctText(s.ci[0])}–{pctText(s.ci[1])}
                </div>
              </div>
            </div>
            {/* conversion bar with CI whisker */}
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
            <div className="mt-2 ml-[3.4rem] flex gap-4 text-[11px] text-zinc-500">
              <span>scroll {pctText(s.avgScrollDepth, 0)}</span>
              <span>time {s.avgTimeOnPage.toFixed(0)}s</span>
              <span>bounce {pctText(s.bounceRate, 0)}</span>
              <span>{s.visits.toLocaleString()} visits</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Behavior heatmap — per-section dwell time, the raw "where attention goes".
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
                    className="group relative h-9 flex-1 rounded-md border border-white"
                    style={{ backgroundColor: hexToRgba(c.hex, 0.18 + 0.82 * (d / maxDwell)) }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/0 group-hover:text-white">
                      {d.toFixed(0)}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-zinc-400">
        Each cell is a section; darker = more average dwell time. Hover for detail.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment × page conversion matrix — the targeting money-shot. Different
// audiences light up different pages.
// ---------------------------------------------------------------------------
export function SegmentMatrix({ pages, stats }: { pages: PageSpec[]; stats: PageStat[] }) {
  const statById = new Map(stats.map((s) => [s.pageId, s]));
  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-[11px] font-semibold text-zinc-400">
              Segment ╲ Page
            </th>
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
            const rowVals = pages.map(
              (p) => statById.get(p.id)?.bySegment[persona.id]?.convRate ?? 0
            );
            const rowMax = Math.max(...rowVals, 0.001);
            return (
              <tr key={persona.id}>
                <td className="px-2 py-1 text-left">
                  <div className="text-[13px] font-semibold text-zinc-800">{persona.name}</div>
                  <div className="text-[10px] text-zinc-400">
                    {pctText(persona.share, 0)} of traffic
                  </div>
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
                        style={{
                          backgroundColor: hexToRgba(c.hex, 0.12 + 0.88 * (v / rowMax)),
                        }}
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
// Insights panel — what the optimizer learned: angle credit, CTA, hot/cold.
// ---------------------------------------------------------------------------
function RankBars({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; hex: string }[];
}) {
  const max = Math.max(...items.map((i) => i.value), 0.001);
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h4>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-[13px] font-medium text-zinc-700">
              {it.label}
            </span>
            <div className="relative h-5 flex-1 rounded-md bg-zinc-100">
              <div
                className="flex h-5 items-center justify-end rounded-md px-2"
                style={{
                  width: `${Math.max(8, (it.value / max) * 100)}%`,
                  backgroundColor: it.hex,
                }}
              >
                <span className="text-[10px] font-bold text-white">{pctText(it.value)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsightsPanel({ insights }: { insights: Insights }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <RankBars
          title="Which message angle converts"
          items={insights.angleScores.map((a) => ({
            label: ANGLE_LABEL[a.angle],
            value: a.score,
            hex: ANGLE_COLORS[a.angle].hex,
          }))}
        />
      </Card>
      <Card>
        <RankBars
          title="Which call-to-action converts"
          items={insights.ctaScores.map((c) => ({
            label: CTA_LABEL[c.type],
            value: c.convRate,
            hex: "#3f3f46",
          }))}
        />
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
              Hot sections
            </div>
            <div className="mt-1 text-[13px] text-zinc-700">
              {insights.hotAngles.map((a) => ANGLE_LABEL[a.angle]).join(", ")}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Ignored sections
            </div>
            <div className="mt-1 text-[13px] text-zinc-700">
              {insights.coldAngles.map((a) => ANGLE_LABEL[a.angle]).join(", ")}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
