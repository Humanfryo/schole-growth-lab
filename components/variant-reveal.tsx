"use client";

import { useState } from "react";
import { ANGLE_COLORS } from "@/lib/colors";
import { ANGLE_LABEL, CTA_LABEL, PageSpec } from "@/lib/types";
import LandingPagePreview from "./LandingPagePreview";
import { Pill, pctText } from "./ui";

export interface VariantMeta {
  source: "llm" | "fallback";
  model?: string;
  prompt?: { system: string; user: string };
  raw?: string;
  reason?: string;
}

export function VariantReveal({
  variant,
  meta,
  lift,
  baselineName,
}: {
  variant: PageSpec;
  meta: VariantMeta;
  lift?: { variantRate: number; baselineRate: number };
  baselineName?: string;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const c = ANGLE_COLORS[variant.primaryAngle];
  const liftPct =
    lift && lift.baselineRate > 0
      ? ((lift.variantRate - lift.baselineRate) / lift.baselineRate) * 100
      : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      {/* left: the generated page */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Pill className="bg-zinc-900 text-white">GENERATED · {variant.id}</Pill>
          <Pill className={`${c.bgSoft} ${c.text}`}>
            {ANGLE_LABEL[variant.primaryAngle]} × {ANGLE_LABEL[variant.secondaryAngle!]}
          </Pill>
          <Pill className={`${c.bgSoft} ${c.text}`}>CTA: {CTA_LABEL[variant.cta.type]}</Pill>
          {meta.source === "llm" ? (
            <Pill className="bg-violet-600 text-white">✨ Copy by {meta.model}</Pill>
          ) : (
            <Pill className="bg-zinc-200 text-zinc-600">cached copy (no LLM key)</Pill>
          )}
        </div>
        <LandingPagePreview page={variant} />
      </div>

      {/* right: what changed and why */}
      <div className="space-y-4">
        {liftPct !== null && lift && (
          <div className={`rounded-2xl border ${c.border} ${c.bgSoft} p-5`}>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Synthesized variant vs. {baselineName ?? "best original"}
                </div>
                <div className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">
                  {pctText(lift.variantRate)}{" "}
                  <span className="text-base font-medium text-zinc-400">
                    vs {pctText(lift.baselineRate)}
                  </span>
                </div>
              </div>
              <div className={`text-right text-2xl font-bold ${c.text}`}>
                {liftPct >= 0 ? "+" : ""}
                {liftPct.toFixed(0)}%
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h4 className="mb-3 text-sm font-bold text-zinc-900">What changed, and why</h4>
          <ol className="space-y-3">
            {(variant.rationale ?? []).map((note, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[13px] font-semibold text-zinc-800">{note.change}</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{note.why}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {meta.prompt && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <button
              onClick={() => setShowPrompt((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-bold text-zinc-900"
            >
              <span>LLM transparency — the exact prompt {meta.source === "llm" ? "& output" : ""}</span>
              <span className="text-zinc-400">{showPrompt ? "−" : "+"}</span>
            </button>
            {showPrompt && (
              <div className="mt-3 space-y-3">
                {meta.source === "fallback" && meta.reason && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
                    Using cached copy: {meta.reason}. The page strategy below is still 100%
                    data-derived — only the wording differs.
                  </p>
                )}
                <Block label="System prompt" text={meta.prompt.system} />
                <Block label="User prompt (the learned brief)" text={meta.prompt.user} />
                {meta.raw && <Block label="Raw model output" text={meta.raw} />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <pre className="scroll-slim max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-600">
        {text}
      </pre>
    </div>
  );
}
