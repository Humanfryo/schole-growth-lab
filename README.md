# Scholé Growth Lab — self-improving landing pages

An experimentation engine that shows how landing pages can **auto-improve over time**.
Five ways to sell Scholé compete against simulated buyers; a multi-armed bandit finds the
winners; the system learns *why* they won; and an LLM writes a new page that beats them all —
then re-enters the race.

Built for the Scholé Founding Growth Engineer GTM challenge.

## The loop

1. **5 landing pages** — same product (Scholé), five distinct GTM angles (ROI, adoption-gap pain,
   role personalization, research credibility, speed/micro-learning).
2. **Simulate visitors** — each visitor is drawn from a hidden buyer **persona** with latent
   preferences. They scroll, dwell, skip, and bounce based on how well each section matches what
   they care about.
3. **Bandit optimizes** — Thompson sampling allocates traffic to winners, round by round.
4. **Learn patterns** — credit assignment finds which angle, which CTA, and which sections drive
   conversions, and which segments prefer which page.
5. **LLM generates** — a new page is synthesized from the learned strategy (LLM writes the copy),
   re-enters the experiment, and wins.

## The honest core

There is a **hidden data-generating process** (persona angle-affinities + CTA/length/proof
preferences through a logistic link with noise). The optimizer only ever sees observable signals
(clicks, scroll, dwell) and must infer what works — like a real funnel. **The LLM never picks the
strategy**; the bandit and credit assignment do. The LLM only writes copy into a fixed,
data-derived slot plan, so the page's measurable features stay honest. Everything is **seeded**, so
runs reproduce exactly.

## Architecture

```
lib/
  types.ts        domain types (pages, sections, signals, stats)
  pages.ts        the 5 seed landing pages + feature derivation
  personas.ts     the HIDDEN buyer model (never seen by the optimizer)
  rng.ts          seeded PRNG, Beta/Gamma sampling, Wilson intervals
  simulate.ts     the data-generating process: a visit -> signals
  bandit.ts       Thompson-sampling experiment runner
  insights.ts     credit assignment + segment discovery
  variant.ts      data-driven variant planner + "what changed & why"
  variantPrompt.ts  Insights -> LLM prompt; robust JSON parsing
  lab.ts          orchestration + experiment config (one place for all knobs)
app/
  page.tsx                      the dashboard (stepwise reveal)
  api/generate-variant/route.ts OpenRouter call + cached fallback
components/                      landing-page renderer, charts, panels, etc.
scripts/calibrate.ts            tune/verify the model: npx tsx scripts/calibrate.ts
```

## Run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

Optional — live LLM-written variant copy (works without it via cached copy):

```bash
cp .env.example .env.local   # then add your OpenRouter key
```

## Verify the model

```bash
npx tsx scripts/calibrate.ts
```

Prints per-persona conversion, the bandit's lift over an even split, the learned insights, and
confirms the generated variant beats every seed.

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · Recharts · OpenRouter (optional) · deployed on Vercel.
All data is simulated; numbers are illustrative, not benchmarks.
