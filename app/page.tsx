"use client";

import { useMemo, useState } from "react";
import { banditLiftPct, PhaseResult, runPhase1, runPhase2, statForPage } from "@/lib/lab";
import { SEED_PAGES } from "@/lib/pages";
import { PERSONAS } from "@/lib/personas";
import { sampleBehavior } from "@/lib/simulate";
import { ANGLE_LABEL, PageSpec, PageStat } from "@/lib/types";
import { planVariant, realizeVariant, realizeVariantWithCopy } from "@/lib/variant";
import { AllocationChart, ConversionChart } from "@/components/charts";
import { VariantGallery } from "@/components/gallery";
import { LoopDiagram } from "@/components/loop";
import {
  BehaviorHeatmap,
  InsightsPanel,
  Leaderboard,
  SegmentMatrix,
} from "@/components/panels";
import { Card, Pill, SectionLabel, Stat } from "@/components/ui";
import { VariantMeta, VariantReveal } from "@/components/variant-reveal";

export default function Home() {
  const [phase1, setPhase1] = useState<PhaseResult | null>(null);
  const [variant, setVariant] = useState<PageSpec | null>(null);
  const [variantMeta, setVariantMeta] = useState<VariantMeta | null>(null);
  const [phase2, setPhase2] = useState<PhaseResult | null>(null);
  const [targeted, setTargeted] = useState<{ pages: PageSpec[]; stats: PageStat[] } | null>(null);
  const [loadingGen, setLoadingGen] = useState(false);

  function runExperiment() {
    setPhase1(runPhase1(SEED_PAGES));
    setTimeout(
      () => document.getElementById("experiment")?.scrollIntoView({ behavior: "smooth" }),
      60
    );
  }

  async function generateVariant() {
    if (!phase1) return;
    setLoadingGen(true);
    const plan = planVariant(phase1.insights, SEED_PAGES, { id: "V1" });
    let v: PageSpec;
    let meta: VariantMeta;
    try {
      const res = await fetch("/api/generate-variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, insights: phase1.insights }),
      });
      const data = await res.json();
      if (data.source === "llm" && data.copy) {
        v = realizeVariantWithCopy(plan, data.copy);
        meta = { source: "llm", model: data.model, prompt: data.prompt, raw: data.raw };
      } else {
        v = realizeVariant(plan);
        meta = { source: "fallback", model: data.model, prompt: data.prompt, reason: data.reason };
      }
    } catch (e) {
      v = realizeVariant(plan);
      meta = { source: "fallback", reason: e instanceof Error ? e.message : "request failed" };
    }
    setVariant(v);
    setVariantMeta(meta);
    setPhase2(runPhase2([...SEED_PAGES, v]));
    setLoadingGen(false);
    setTimeout(
      () => document.getElementById("generate")?.scrollIntoView({ behavior: "smooth" }),
      60
    );
  }

  function generateTargeted() {
    if (!phase1 || !variant) return;
    const tvs = PERSONAS.map((p) =>
      realizeVariant(
        planVariant(phase1.insights, SEED_PAGES, { id: `T-${p.id}`, forSegment: p.id })
      )
    );
    const pool = [variant, ...tvs];
    const { stats } = sampleBehavior(pool, { seed: 321, perPage: 1500 });
    setTargeted({ pages: pool, stats });
    setTimeout(
      () => document.getElementById("targeted")?.scrollIntoView({ behavior: "smooth" }),
      60
    );
  }

  const lift = useMemo(() => {
    if (!phase1 || !phase2 || !variant) return null;
    const vRate = statForPage(phase2, variant.id)?.convRate ?? 0;
    const baseId = phase1.experiment.bestPageId;
    const baseStat = statForPage(phase1, baseId);
    return {
      variantRate: vRate,
      baselineRate: baseStat?.convRate ?? 0,
      baselineName: phase1.pages.find((p) => p.id === baseId)?.name ?? "best original",
    };
  }, [phase1, phase2, variant]);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      {/* ---------------- HERO ---------------- */}
      <header className="mb-14">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600" />
          <span className="text-lg font-bold tracking-tight text-zinc-900">Scholé Growth Lab</span>
          <Pill className="ml-1 bg-zinc-100 text-zinc-500">GTM experimentation engine</Pill>
        </div>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-zinc-900 sm:text-5xl">
          Landing pages that{" "}
          <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            improve themselves
          </span>
          .
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-600">
          Five ways to sell Scholé go head-to-head against simulated buyers. A multi-armed bandit
          finds the winners, the system learns <em>why</em> they won, and an LLM writes a new page
          that beats them all — then re-enters the race.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={runExperiment}
            className="rounded-xl bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
          >
            {phase1 ? "Re-run experiment ↻" : "Run the experiment →"}
          </button>
          <a
            href="#contenders"
            className="rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            See the 5 contenders
          </a>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat value="5" label="landing pages" hint="distinct GTM angles" />
          <Stat value="3" label="buyer personas" hint="hidden preference model" />
          <Stat value="~26k" label="simulated visits" hint="reproducible & seeded" />
          <Stat value="Thompson" label="sampling bandit" hint="+ LLM variant gen" />
        </div>

        <div className="mt-12 rounded-2xl border border-zinc-200 bg-white/70 p-5">
          <LoopDiagram />
        </div>
      </header>

      {/* ---------------- CONTENDERS ---------------- */}
      <section id="contenders" className="mb-16 scroll-mt-6">
        <SectionLabel
          n="1"
          title="The five contenders"
          sub="Same product, five sales strategies — different headline angle, structure, and call-to-action. Click any card to open the real, fully-rendered landing page."
        />
        <VariantGallery pages={SEED_PAGES} />
      </section>

      {!phase1 && (
        <div className="mb-16 rounded-2xl border border-dashed border-zinc-300 bg-white/50 py-14 text-center">
          <p className="text-zinc-500">
            Run the experiment to simulate buyers, compare the pages, and watch the system learn.
          </p>
          <button
            onClick={runExperiment}
            className="mt-4 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Run the experiment →
          </button>
        </div>
      )}

      {phase1 && (
        <>
          {/* ---------------- EXPERIMENT ---------------- */}
          <section id="experiment" className="mb-16 scroll-mt-6 animate-fade-up">
            <SectionLabel
              n="2"
              title="How the pages were compared"
              sub="Every visitor is allocated by Thompson sampling: we draw a plausible conversion rate from each page's Beta posterior and serve the highest. Traffic concentrates on winners automatically — no fixed split, no waiting for significance."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <h3 className="mb-1 text-sm font-bold text-zinc-900">Traffic allocation by round</h3>
                <p className="mb-3 text-[12px] text-zinc-500">
                  The bandit shifts spend toward what is winning, round by round.
                </p>
                <AllocationChart pages={SEED_PAGES} experiment={phase1.experiment} />
              </Card>
              <Card>
                <h3 className="mb-1 text-sm font-bold text-zinc-900">
                  Conversion rate: bandit vs. even split
                </h3>
                <p className="mb-3 text-[12px] text-zinc-500">
                  Optimizing allocation lifts overall conversion{" "}
                  <span className="font-semibold text-violet-600">
                    +{banditLiftPct(phase1.experiment).toFixed(0)}%
                  </span>{" "}
                  over splitting traffic evenly.
                </p>
                <ConversionChart experiment={phase1.experiment} />
              </Card>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-zinc-900">
                Leaderboard — which version performed better
              </h3>
              <Leaderboard
                pages={SEED_PAGES}
                stats={phase1.behaviorStats}
                bestId={phase1.experiment.bestPageId}
              />
            </div>
          </section>

          {/* ---------------- BEHAVIOR ---------------- */}
          <section id="behavior" className="mb-16 scroll-mt-6 animate-fade-up">
            <SectionLabel
              n="3"
              title="The simulated user behavior"
              sub="Behind the clicks is a hidden model: each visitor is drawn from a buyer persona with latent preferences. They scroll, dwell, skip, and bounce based on how well each section matches what they care about. The optimizer never sees the model — only these signals."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
              <Card>
                <h3 className="mb-1 text-sm font-bold text-zinc-900">Attention heatmap</h3>
                <p className="mb-4 text-[12px] text-zinc-500">
                  Average dwell time per section. Darker means visitors lingered.
                </p>
                <BehaviorHeatmap pages={SEED_PAGES} stats={phase1.behaviorStats} />
              </Card>
              <Card>
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900">Who converts where — by segment</h3>
                  {phase1.insights.segmentsDiffer && (
                    <Pill className="bg-amber-100 text-amber-700">different winners!</Pill>
                  )}
                </div>
                <p className="mb-4 text-[12px] text-zinc-500">
                  Conversion rate of each segment on each page. The single best page hides that
                  audiences want different things.
                </p>
                <SegmentMatrix pages={SEED_PAGES} stats={phase1.behaviorStats} />
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {PERSONAS.map((p) => (
                    <div key={p.id} className="flex gap-2 text-[12px] text-zinc-500">
                      <span className="font-semibold text-zinc-700">{p.name}:</span>
                      <span className="flex-1">{p.blurb}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>

          {/* ---------------- INSIGHTS ---------------- */}
          <section id="insights" className="mb-16 scroll-mt-6 animate-fade-up">
            <SectionLabel
              n="4"
              title="What the system learned"
              sub="Credit assignment across all pages: which message angle and which call-to-action actually drive conversions, and which sections visitors ignore."
            />
            <InsightsPanel insights={phase1.insights} />
            <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
              <p className="text-[15px] leading-relaxed text-zinc-700">
                <span className="font-semibold text-violet-700">The takeaway:</span>{" "}
                <span className="font-semibold">{ANGLE_LABEL[phase1.insights.winningAngle]}</span> is
                the strongest message, the{" "}
                <span className="font-semibold">&ldquo;{ctaWord(phase1)}&rdquo;</span> CTA converts
                best, and the{" "}
                <span className="font-semibold">{ANGLE_LABEL[phase1.insights.losingAngle]}</span>{" "}
                angle is dead weight. No single existing page combines the winning ingredients — so
                the system builds one.
              </p>
            </div>
          </section>

          {/* ---------------- GENERATE ---------------- */}
          <section id="generate" className="mb-16 scroll-mt-6">
            <SectionLabel
              n="5"
              title="The generated variation"
              sub="The optimizer decides the strategy from data — winning angle, supporting angle, best CTA, drop the dead weight. An LLM then writes the copy into that fixed structure, so the page's measurable features stay honest."
            />

            {!variant && (
              <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 py-12 text-center">
                <p className="mb-4 text-zinc-600">
                  Synthesize a new page from everything learned above.
                </p>
                <button
                  onClick={generateVariant}
                  disabled={loadingGen}
                  className="rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                >
                  {loadingGen ? "Generating…" : "✨ Generate the winning variant"}
                </button>
              </div>
            )}

            {variant && variantMeta && (
              <div className="animate-fade-up">
                <VariantReveal
                  variant={variant}
                  meta={variantMeta}
                  lift={
                    lift
                      ? { variantRate: lift.variantRate, baselineRate: lift.baselineRate }
                      : undefined
                  }
                  baselineName={lift?.baselineName}
                />

                {phase2 && (
                  <div className="mt-8">
                    <h3 className="mb-1 text-sm font-bold text-zinc-900">
                      Re-run with the new variant in the mix
                    </h3>
                    <p className="mb-3 text-[12px] text-zinc-500">
                      The same experiment, now with {phase2.pages.length} pages. The synthesized
                      variant{" "}
                      <span className="font-semibold text-violet-600">
                        {phase2.experiment.bestPageId === variant.id ? "wins" : "competes"}
                      </span>{" "}
                      against every original.
                    </p>
                    <Leaderboard
                      pages={phase2.pages}
                      stats={phase2.behaviorStats}
                      bestId={phase2.experiment.bestPageId}
                    />
                  </div>
                )}

                {/* go beyond: per-segment targeting */}
                <div id="targeted" className="mt-12 scroll-mt-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Pill className="bg-zinc-900 text-white">GO FURTHER</Pill>
                    <h3 className="text-lg font-bold tracking-tight text-zinc-900">
                      One winner isn&apos;t the ceiling — personalize per segment
                    </h3>
                  </div>
                  <p className="mb-4 max-w-3xl text-[14px] leading-relaxed text-zinc-500">
                    The segment matrix showed different audiences want different messages — exactly
                    Scholé&apos;s own thesis. So the system generates a targeted page per segment,
                    each leading with the angle that segment converted on.
                  </p>

                  {!targeted && (
                    <button
                      onClick={generateTargeted}
                      className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                    >
                      Generate audience-targeted variants →
                    </button>
                  )}

                  {targeted && (
                    <div className="animate-fade-up space-y-6">
                      <VariantGallery pages={targeted.pages.filter((p) => p.id.startsWith("T-"))} />
                      <Card>
                        <h4 className="mb-1 text-sm font-bold text-zinc-900">
                          Each targeted page wins its own segment
                        </h4>
                        <p className="mb-4 text-[12px] text-zinc-500">
                          Conversion of each segment on the generic winner ({variant.id}) vs. the
                          three targeted pages. The diagonal lights up: targeting beats
                          one-size-fits-all.
                        </p>
                        <SegmentMatrix pages={targeted.pages} stats={targeted.stats} />
                      </Card>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ---------------- METHODOLOGY / HONESTY ---------------- */}
      <footer className="mt-20 border-t border-zinc-200 pt-8">
        <h3 className="mb-3 text-sm font-bold text-zinc-900">Method &amp; honest caveats</h3>
        <div className="grid grid-cols-1 gap-4 text-[13px] leading-relaxed text-zinc-500 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-zinc-700">It&apos;s a simulation.</span> A hidden
            utility model (persona angle-affinities + CTA/length/proof preferences, passed through a
            logistic link with noise) generates the behavior. The optimizer only ever sees clicks,
            scroll, and dwell — it must infer what works, like a real funnel. Numbers are
            illustrative, not benchmarks.
          </p>
          <p>
            <span className="font-semibold text-zinc-700">
              The LLM doesn&apos;t pick the strategy.
            </span>{" "}
            Credit assignment and the bandit choose the angle, CTA, and structure from data; the LLM
            only writes copy into that fixed plan. So the page&apos;s measurable features are always
            the data-derived ones — the &ldquo;why&rdquo; is real even though the copy is generated.
          </p>
          <p>
            <span className="font-semibold text-zinc-700">Everything is seeded.</span> The same run
            reproduces exactly, which is why the charts are stable across reloads and the demo is
            deterministic.
          </p>
          <p>
            <span className="font-semibold text-zinc-700">Next step in production.</span> Swap the
            simulator for a real edge-served A/B/n test with the identical bandit +
            credit-assignment + generation loop. The architecture doesn&apos;t change — only the
            source of the clicks.
          </p>
        </div>
        <p className="mt-6 text-[12px] text-zinc-400">
          Built for the Scholé Founding Growth Engineer challenge · Next.js + Thompson sampling +
          OpenRouter · all data simulated.
        </p>
      </footer>
    </main>
  );
}

function ctaWord(phase: PhaseResult): string {
  const best = phase.insights.ctaScores[0]?.type;
  return best === "demo" ? "Book a demo" : best === "trial" ? "Try it now" : "Learn more";
}
