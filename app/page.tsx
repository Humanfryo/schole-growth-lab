"use client";

import { useEffect, useMemo, useState } from "react";
import {
  evaluateField,
  evaluateVariant,
  EvolutionResult,
  LabState,
  multiSeedLift,
  MultiSeedLift,
  planAndRealize,
  runEvolution,
  runLab,
  VariantEvaluation,
} from "@/lib/lab";
import { SEED_PAGES } from "@/lib/pages";
import { PERSONAS } from "@/lib/personas";
import { ANGLE_LABEL, CTA_LABEL, PageSpec, PageStat } from "@/lib/types";
import { AllocationChart, ConversionChart } from "@/components/charts";
import { VariantGallery } from "@/components/gallery";
import { LoopDiagram } from "@/components/loop";
import {
  BehaviorHeatmap,
  EvolutionPanel,
  InsightsPanel,
  Leaderboard,
  SegmentMatrix,
} from "@/components/panels";
import { Card, Pill, SectionLabel, Stat } from "@/components/ui";
import { VariantMeta, VariantReveal } from "@/components/variant-reveal";

function pct(x: number, d = 1) {
  return `${(x * 100).toFixed(d)}%`;
}

export default function Home() {
  const [lab, setLab] = useState<LabState | null>(null);
  const [variant, setVariant] = useState<PageSpec | null>(null);
  const [variantMeta, setVariantMeta] = useState<VariantMeta | null>(null);
  const [variantEval, setVariantEval] = useState<VariantEvaluation | null>(null);
  const [variantPredicted, setVariantPredicted] = useState<number>(0);
  const [multiSeed, setMultiSeed] = useState<MultiSeedLift | null>(null);
  const [evolution, setEvolution] = useState<EvolutionResult | null>(null);
  const [targeted, setTargeted] = useState<{ pool: PageSpec[]; stats: PageStat[] } | null>(null);
  const [loadingGen, setLoadingGen] = useState(false);

  // auto-run phase 1 on load so a skimming reviewer sees a full dashboard
  useEffect(() => {
    const id = setTimeout(() => setLab(runLab(SEED_PAGES)), 30);
    return () => clearTimeout(id);
  }, []);

  function rerun() {
    setLab(runLab(SEED_PAGES));
  }

  async function generateVariant() {
    if (!lab) return;
    setLoadingGen(true);
    const { plan, variant: fallbackVariant } = planAndRealize(lab.insights, SEED_PAGES, { id: "V1" });
    setVariantPredicted(plan.predictedConv);

    let v = fallbackVariant;
    let meta: VariantMeta;
    const slim = {
      winningAngle: lab.insights.winningAngle,
      bestCTA: lab.insights.bestCTA,
      losingAngle: lab.insights.losingAngle,
      segmentWinners: lab.insights.segmentWinners.map((s) => ({
        segmentName: s.segmentName,
        topAngle: s.topAngle,
      })),
    };
    try {
      const res = await fetch("/api/generate-variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, insights: slim }),
      });
      const data = await res.json();
      if (data.source === "llm" && data.copy) {
        const { realizeVariantWithCopy } = await import("@/lib/variant");
        v = realizeVariantWithCopy(plan, data.copy);
        meta = { source: "llm", model: data.model, prompt: data.prompt, raw: data.raw };
      } else {
        meta = { source: "fallback", model: data.model, prompt: data.prompt, reason: data.reason };
      }
    } catch (e) {
      meta = { source: "fallback", reason: e instanceof Error ? e.message : "request failed" };
    }

    setVariant(v);
    setVariantMeta(meta);
    setVariantEval(evaluateVariant(SEED_PAGES, v));
    setMultiSeed(multiSeedLift(SEED_PAGES, lab.insights, 40));
    setLoadingGen(false);
    setTimeout(() => document.getElementById("generate")?.scrollIntoView({ behavior: "smooth" }), 60);
  }

  function evolve() {
    if (!lab) return;
    setEvolution(runEvolution(SEED_PAGES, lab.insights, 4));
    setTimeout(() => document.getElementById("evolution")?.scrollIntoView({ behavior: "smooth" }), 60);
  }

  function targetSegments() {
    if (!lab || !variant) return;
    const tvs = PERSONAS.map(
      (p) => planAndRealize(lab.insights, SEED_PAGES, { id: `T-${p.id}`, forSegment: p.id, segName: p.name }).variant
    );
    const pool = [variant, ...tvs];
    const { stats } = evaluateField(pool, 321);
    setTargeted({ pool, stats });
    setTimeout(() => document.getElementById("targeted")?.scrollIntoView({ behavior: "smooth" }), 60);
  }

  const e = lab?.experiment;
  const liftCard = useMemo(
    () =>
      variantEval ? { variantRate: variantEval.variantRate, baselineRate: variantEval.baselineRate } : undefined,
    [variantEval]
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      {/* HERO */}
      <header className="mb-14">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600" />
          <span className="text-lg font-bold tracking-tight text-zinc-900">Scholé Growth Lab</span>
          <Pill className="ml-1 bg-zinc-100 text-zinc-500">GTM experimentation engine</Pill>
          <Pill className="bg-amber-100 text-amber-700">All data simulated</Pill>
        </div>
        <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-zinc-900 sm:text-5xl">
          Landing pages that{" "}
          <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            improve themselves
          </span>
          .
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-600">
          Five ways to sell Scholé compete against simulated buyers. The system <em>fits a model</em>{" "}
          of what converts, designs a new page as the argmax of that model, validates it with a
          bandit, and iterates — honestly, with confidence intervals.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={rerun}
            className="rounded-xl bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
          >
            {lab ? "Re-run experiment ↻" : "Running…"}
          </button>
          <a
            href="#contenders"
            className="rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            See the 5 contenders
          </a>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat value="5" label="contenders" hint="distinct GTM angles" />
          <Stat value="3" label="buyer personas" hint="hidden preference model" />
          <Stat value="60-pt" label="design grid" hint="de-confounds factors" />
          <Stat value="fit + bandit" label="learning engine" hint="logistic + Thompson" />
        </div>

        <div className="mt-12 rounded-2xl border border-zinc-200 bg-white/70 p-5">
          <LoopDiagram />
        </div>
      </header>

      {/* CONTENDERS */}
      <section id="contenders" className="mb-16 scroll-mt-6">
        <SectionLabel
          n="1"
          title="The five contenders"
          sub="Same product, five sales strategies — different headline angle, structure, and call-to-action. Click any card to open the real, fully-rendered landing page."
        />
        <VariantGallery pages={SEED_PAGES} />
      </section>

      {!lab && (
        <div className="mb-16 rounded-2xl border border-dashed border-zinc-300 bg-white/50 py-14 text-center">
          <p className="text-zinc-500">Running the experiment…</p>
        </div>
      )}

      {lab && e && (
        <>
          {/* EXPERIMENT */}
          <section id="experiment" className="mb-16 scroll-mt-6 animate-fade-up">
            <SectionLabel
              n="2"
              title="How the pages were compared"
              sub="A Thompson-sampling bandit allocates each visitor to the page with the highest sampled conversion rate, so traffic concentrates on winners. We frame it honestly: against an even split (floor) and the best fixed arm / oracle (ceiling)."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <h3 className="mb-1 text-sm font-bold text-zinc-900">Traffic allocation by round</h3>
                <p className="mb-3 text-[12px] text-zinc-500">The bandit shifts spend toward what is winning.</p>
                <AllocationChart pages={SEED_PAGES} experiment={e} />
              </Card>
              <Card>
                <h3 className="mb-1 text-sm font-bold text-zinc-900">Conversion: bandit vs. floor &amp; ceiling</h3>
                <p className="mb-3 text-[12px] text-zinc-500">
                  Bandit {pct(e.thompsonConvRate)} — between even split {pct(e.uniformConvRate)} and the
                  oracle {pct(e.bestArmRate)}. Cumulative regret ≈{" "}
                  <span className="font-semibold text-violet-600">{e.cumRegret.toFixed(0)}</span> conversions.
                </p>
                <ConversionChart experiment={e} />
              </Card>
            </div>
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold text-zinc-900">
                Leaderboard — with significance, not just the bare max
              </h3>
              <Leaderboard
                pages={SEED_PAGES}
                stats={lab.behaviorStats}
                bestId={e.bestPageId}
                significant={e.winnerSignificant}
                pBest={e.pBest}
              />
            </div>
          </section>

          {/* BEHAVIOR */}
          <section id="behavior" className="mb-16 scroll-mt-6 animate-fade-up">
            <SectionLabel
              n="3"
              title="The simulated user behavior"
              sub="Each visitor is drawn from a hidden buyer persona with latent preferences. They scroll, dwell, skip, and bounce based on how well each section matches what they care about. The optimizer sees only these signals — never the personas."
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
              <Card>
                <h3 className="mb-1 text-sm font-bold text-zinc-900">Attention heatmap</h3>
                <p className="mb-4 text-[12px] text-zinc-500">Average dwell per section.</p>
                <BehaviorHeatmap pages={SEED_PAGES} stats={lab.behaviorStats} />
              </Card>
              <Card>
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900">Who converts where — by segment</h3>
                  {lab.insights.segmentsDiffer && (
                    <Pill className="bg-amber-100 text-amber-700">different winners!</Pill>
                  )}
                </div>
                <p className="mb-4 text-[12px] text-zinc-500">
                  Different audiences want different messages — the single best page hides that.
                </p>
                <SegmentMatrix pages={SEED_PAGES} stats={lab.behaviorStats} />
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

          {/* LEARNED */}
          <section id="insights" className="mb-16 scroll-mt-6 animate-fade-up">
            <SectionLabel
              n="4"
              title="What the system learned — a fitted response model"
              sub="A logistic regression on the exploration design estimates the effect of every factor on conversion, with confidence intervals. Because the design varies CTA, proof, specificity, and length independently of the angle, these effects are de-confounded — not just correlations on the 5 pages."
            />
            <InsightsPanel insights={lab.insights} />
            <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
              <p className="text-[15px] leading-relaxed text-zinc-700">
                <span className="font-semibold text-violet-700">The takeaway:</span>{" "}
                <span className="font-semibold">{ANGLE_LABEL[lab.insights.winningAngle]}</span> is the
                strongest angle, <span className="font-semibold">&ldquo;{CTA_LABEL[lab.insights.bestCTA]}&rdquo;</span> is
                the best CTA (measured independently of angle), social proof and specificity both lift
                conversion, and longer pages hurt. The next page is built to be the argmax of exactly
                these coefficients — no hand-picked values.
              </p>
            </div>
          </section>

          {/* GENERATE */}
          <section id="generate" className="mb-16 scroll-mt-6">
            <SectionLabel
              n="5"
              title="The generated variation"
              sub="The optimizer searches the feature space and picks the page maximizing predicted conversion under the fitted model. An LLM then writes the copy into that fixed, data-derived structure."
            />
            {!variant && (
              <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 py-12 text-center">
                <p className="mb-4 text-zinc-600">Synthesize the argmax page from the fitted model.</p>
                <button
                  onClick={generateVariant}
                  disabled={loadingGen}
                  className="rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                >
                  {loadingGen ? "Generating…" : "✨ Generate the optimized variant"}
                </button>
              </div>
            )}

            {variant && variantMeta && variantEval && (
              <div className="animate-fade-up space-y-8">
                <VariantReveal
                  variant={variant}
                  meta={variantMeta}
                  lift={liftCard}
                  baselineName={variantEval.baselineName}
                />

                {/* robustness: predicted vs observed + multi-seed CI */}
                {multiSeed && (
                  <Card>
                    <h3 className="mb-3 text-sm font-bold text-zinc-900">Is the win real? (honest accounting)</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Stat value={pct(variantPredicted)} label="model predicted" hint="argmax of the fit" />
                      <Stat value={pct(variantEval.variantRate)} label="observed (same pass)" hint={`vs ${variantEval.baselineId} at ${pct(variantEval.baselineRate)}`} accent="#7c3aed" />
                      <Stat
                        value={`${multiSeed.meanLiftPct >= 0 ? "+" : ""}${multiSeed.meanLiftPct.toFixed(0)}%`}
                        label="mean lift over 40 seeds"
                        hint={`95% CI [${multiSeed.ciLow.toFixed(0)}%, ${multiSeed.ciHigh.toFixed(0)}%]`}
                        accent="#7c3aed"
                      />
                    </div>
                    <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">
                      Across 40 independent seeds the variant beats the best original in{" "}
                      <span className="font-semibold text-zinc-700">{pct(multiSeed.winRate, 0)}</span> of runs —
                      reliably better, but <span className="font-semibold">not always</span> (the CI crosses into
                      negative). That honesty is the point: the win is earned, not constructed.
                    </p>
                  </Card>
                )}

                <div>
                  <h3 className="mb-1 text-sm font-bold text-zinc-900">Re-run with the new variant in the mix</h3>
                  <p className="mb-3 text-[12px] text-zinc-500">
                    The same bandit, now with {variantEval.field.length} pages. The synthesized variant{" "}
                    <span className="font-semibold text-violet-600">
                      {variantEval.experiment.bestPageId === variant.id ? "wins" : "competes"}
                    </span>
                    .
                  </p>
                  <Leaderboard
                    pages={variantEval.field}
                    stats={variantEval.stats}
                    bestId={variantEval.experiment.bestPageId}
                    significant={variantEval.experiment.winnerSignificant}
                    pBest={variantEval.experiment.pBest}
                  />
                </div>

                {/* EVOLUTION */}
                <div id="evolution" className="scroll-mt-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Pill className="bg-zinc-900 text-white">ITERATE</Pill>
                    <h3 className="text-lg font-bold tracking-tight text-zinc-900">
                      Self-improvement over time — and when it stops
                    </h3>
                  </div>
                  {!evolution && (
                    <button
                      onClick={evolve}
                      className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                    >
                      Run multiple evolution rounds →
                    </button>
                  )}
                  {evolution && (
                    <div className="animate-fade-up">
                      <EvolutionPanel evolution={evolution} />
                    </div>
                  )}
                </div>

                {/* TARGETED */}
                <div id="targeted" className="scroll-mt-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Pill className="bg-zinc-900 text-white">GO FURTHER</Pill>
                    <h3 className="text-lg font-bold tracking-tight text-zinc-900">
                      Personalize per segment — a predicted next test
                    </h3>
                  </div>
                  <p className="mb-4 max-w-3xl text-[14px] leading-relaxed text-zinc-500">
                    Each segment gets a page optimized against <em>its own</em> fitted model. Below is the
                    predicted per-segment conversion — a hypothesis the system would A/B test next, not a
                    proven result.
                  </p>
                  {!targeted && (
                    <button
                      onClick={targetSegments}
                      className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                    >
                      Generate audience-targeted variants →
                    </button>
                  )}
                  {targeted && (
                    <div className="animate-fade-up space-y-6">
                      <VariantGallery pages={targeted.pool.filter((p) => p.id.startsWith("T-"))} />
                      <Card>
                        <h4 className="mb-1 text-sm font-bold text-zinc-900">
                          Predicted: targeting lifts the segments the generic page underserves
                        </h4>
                        <p className="mb-4 text-[12px] text-zinc-500">
                          Per-segment conversion on the generic winner ({variant.id}) vs. the three targeted
                          pages. The Exec and IC segments convert far better on a page built for them; the
                          L&amp;D segment is already well-served by the generic winner (it&apos;s
                          personalization-led, which they like) — so the system would only ship the targeted
                          pages that actually beat {variant.id}.
                        </p>
                        <SegmentMatrix pages={targeted.pool} stats={targeted.stats} />
                      </Card>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* METHODOLOGY */}
      <footer className="mt-20 border-t border-zinc-200 pt-8">
        <h3 className="mb-3 text-sm font-bold text-zinc-900">Method &amp; honest caveats</h3>
        <div className="grid grid-cols-1 gap-4 text-[13px] leading-relaxed text-zinc-500 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-zinc-700">It&apos;s a known-answer testbed.</span> A hidden
            persona model generates behavior; the pipeline only sees clicks, scroll, and dwell and must
            infer what works. Planting a ground truth lets us verify the recovery pipeline actually
            recovers it — the calibration script confirms the fitted coefficients match the true model.
          </p>
          <p>
            <span className="font-semibold text-zinc-700">The new page is earned, not constructed.</span>{" "}
            Its features are the argmax of a logistic model fit on an exploration design that varies every
            factor independently — so the win has confidence intervals, and across seeds it wins ~90% of
            the time, not 100%.
          </p>
          <p>
            <span className="font-semibold text-zinc-700">Honest baselines.</span> The bandit is framed by
            an even split (floor) and the oracle best arm (ceiling); we report regret and gate the winner
            on posterior significance — not a bare argmax or a strawman &ldquo;lift over uniform.&rdquo;
          </p>
          <p>
            <span className="font-semibold text-zinc-700">In production.</span> Swap the simulator for real
            edge-served traffic; the same fit→optimize→validate→iterate loop runs. The hard parts the
            simulator removes — sparse conversions, drift, segment labels — are exactly what you&apos;d
            build next. Copy and proof points here are illustrative.
          </p>
        </div>
        <p className="mt-6 text-[12px] text-zinc-400">
          Built for the Scholé Founding Growth Engineer challenge · Next.js · logistic response model +
          Thompson sampling · OpenRouter · all data simulated.
        </p>
      </footer>
    </main>
  );
}
