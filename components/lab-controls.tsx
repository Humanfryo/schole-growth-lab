"use client";

import { LAB_CONFIG, LabOptions } from "@/lib/lab";
import { Persona, PERSONAS } from "@/lib/personas";
import { Card, Pill } from "@/components/ui";

// The Lab Controls panel: the parameters a growth engineer would actually want
// to move, exposed as controls — each with what it does and the honest caveat.
// Defaults reproduce the canonical run exactly (the panel adds no overrides
// until you move something). The exploration design is deliberately locked.

export interface LabPanelState {
  rounds: number;
  visitorsPerRound: number;
  banditSeed: number;
  acceptEpsPt: number; // evolution accept margin, in percentage points
  pBestThreshold: number;
  mcSamples: number;
  shares: Record<string, number>; // personaId -> raw weight (normalized on use)
}

export const LAB_PANEL_DEFAULTS: LabPanelState = {
  rounds: LAB_CONFIG.rounds,
  visitorsPerRound: LAB_CONFIG.visitorsPerRound,
  banditSeed: LAB_CONFIG.banditSeed,
  acceptEpsPt: LAB_CONFIG.acceptEps * 100,
  pBestThreshold: 0.95,
  mcSamples: 3000,
  shares: Object.fromEntries(PERSONAS.map((p) => [p.id, Math.round(p.share * 100)])),
};

export function isPanelDefault(s: LabPanelState): boolean {
  const d = LAB_PANEL_DEFAULTS;
  return (
    s.rounds === d.rounds &&
    s.visitorsPerRound === d.visitorsPerRound &&
    s.banditSeed === d.banditSeed &&
    s.acceptEpsPt === d.acceptEpsPt &&
    s.pBestThreshold === d.pBestThreshold &&
    s.mcSamples === d.mcSamples &&
    PERSONAS.every((p) => s.shares[p.id] === d.shares[p.id])
  );
}

// Build engine options from panel state. Returns undefined when everything is
// at defaults, so the default run stays literally the no-options code path.
export function toLabOptions(s: LabPanelState): LabOptions | undefined {
  if (isPanelDefault(s)) return undefined;

  const total = PERSONAS.reduce((sum, p) => sum + (s.shares[p.id] ?? 0), 0) || 1;
  const sharesDirty = PERSONAS.some((p) => s.shares[p.id] !== LAB_PANEL_DEFAULTS.shares[p.id]);
  const personas: Persona[] | undefined = sharesDirty
    ? PERSONAS.map((p) => ({ ...p, share: (s.shares[p.id] ?? 0) / total }))
    : undefined;

  return {
    config: {
      rounds: s.rounds,
      visitorsPerRound: s.visitorsPerRound,
      banditSeed: s.banditSeed,
      acceptEps: s.acceptEpsPt / 100,
    },
    personas,
    pBestThreshold: s.pBestThreshold,
    mcSamples: s.mcSamples,
  };
}

function Knob(props: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  raw: number;
  onChange: (v: number) => void;
  what: string;
  caveat: string;
}) {
  return (
    <div className="border-b border-zinc-100 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-zinc-800">{props.label}</span>
        <span className="font-mono text-[13px] font-semibold text-violet-700">{props.value}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.raw}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-1 w-full accent-violet-600"
      />
      <p className="text-[12px] leading-relaxed text-zinc-500">{props.what}</p>
      <p className="text-[12px] leading-relaxed text-amber-700/80">{props.caveat}</p>
    </div>
  );
}

export function LabControls(props: {
  state: LabPanelState;
  onChange: (s: LabPanelState) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const { state: s, onChange } = props;
  const dirty = !isPanelDefault(s);
  const shareTotal = PERSONAS.reduce((sum, p) => sum + (s.shares[p.id] ?? 0), 0) || 1;

  return (
    <Card className="mt-6">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-zinc-900">Lab Controls</h3>
        <Pill className="bg-zinc-100 text-zinc-500">the knobs, with their trade-offs</Pill>
        {dirty && <Pill className="bg-amber-100 text-amber-700">modified — re-run to apply</Pill>}
      </div>
      <p className="mb-4 text-[12px] leading-relaxed text-zinc-500">
        A growth system should anticipate its own changes. These are the parameters worth moving,
        each with what it does and what it costs. Every run stays fully seeded and reproducible.
      </p>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">Bandit</p>
          <Knob
            label="Rounds"
            value={`${s.rounds}`}
            min={4}
            max={30}
            step={1}
            raw={s.rounds}
            onChange={(v) => onChange({ ...s, rounds: v })}
            what="How many allocation rounds the bandit runs."
            caveat="Fewer rounds = less evidence — watch the winner drop to 'leading, not yet significant'."
          />
          <Knob
            label="Visitors per round"
            value={`${s.visitorsPerRound}`}
            min={100}
            max={600}
            step={50}
            raw={s.visitorsPerRound}
            onChange={(v) => onChange({ ...s, visitorsPerRound: v })}
            what={`Traffic per round. Total = ${s.rounds} × ${s.visitorsPerRound} = ${s.rounds * s.visitorsPerRound} visitors.`}
            caveat="More traffic tightens the posteriors but hides how the bandit behaves when data is scarce."
          />
          <Knob
            label="Bandit seed"
            value={`${s.banditSeed}`}
            min={1}
            max={500}
            step={1}
            raw={s.banditSeed}
            onChange={(v) => onChange({ ...s, banditSeed: v })}
            what="The random universe this experiment runs in. Change it to test a different one."
            caveat="If a conclusion only holds on one seed, it isn't a conclusion."
          />
          <Knob
            label="Evolution accept margin"
            value={`${s.acceptEpsPt.toFixed(1)}pt`}
            min={0.1}
            max={1}
            step={0.1}
            raw={s.acceptEpsPt}
            onChange={(v) => onChange({ ...s, acceptEpsPt: v })}
            what="A new variant is kept only if it beats the incumbent by more than this margin."
            caveat="Lower it and weak variants sneak in; raise it and real wins get rejected."
          />
        </div>

        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
            Statistics
          </p>
          <Knob
            label="Significance gate P(best)"
            value={`${Math.round(s.pBestThreshold * 100)}%`}
            min={0.8}
            max={0.99}
            step={0.01}
            raw={s.pBestThreshold}
            onChange={(v) => onChange({ ...s, pBestThreshold: v })}
            what="How sure the bandit must be before declaring a winner."
            caveat="Lower = faster calls, more false winners. 95% is the honest default."
          />
          <Knob
            label="Monte-Carlo samples"
            value={`${s.mcSamples}`}
            min={500}
            max={10000}
            step={500}
            raw={s.mcSamples}
            onChange={(v) => onChange({ ...s, mcSamples: v })}
            what="Samples used to estimate P(best) from the posteriors."
            caveat="Too few makes the significance call itself noisy."
          />

          <p className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
            Traffic mixture
          </p>
          {PERSONAS.map((p) => (
            <Knob
              key={p.id}
              label={p.name}
              value={`${Math.round(((s.shares[p.id] ?? 0) / shareTotal) * 100)}%`}
              min={0}
              max={100}
              step={5}
              raw={s.shares[p.id] ?? 0}
              onChange={(v) => onChange({ ...s, shares: { ...s.shares, [p.id]: v } })}
              what={`Share of visitors who are this persona (auto-normalized).`}
              caveat={
                p.id === "cfo"
                  ? "Skew the audience and the winning page should change — that's the point of segments."
                  : p.id === "lnd"
                    ? "The default mixture is 30 / 40 / 30."
                    : "A page that wins one mixture can lose another; averages hide this."
              }
            />
          ))}
        </div>
      </div>

      {/* deliberately locked */}
      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 opacity-80">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-zinc-500">
            🔒 Exploration design (5 angles × 3 CTAs × 4 scalar combos = 60 points)
          </span>
          <Pill className="bg-zinc-200 text-zinc-500">locked</Pill>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
          Not exposed on purpose: the regression&apos;s de-confounding depends on this balanced
          grid. Resize it carelessly and the coefficients silently stop being isolable — the one
          change that can break the measurement without breaking the code.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={props.onApply}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
        >
          Re-run with these settings
        </button>
        <button
          onClick={props.onReset}
          className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Reset to defaults
        </button>
        <span className="text-[12px] text-zinc-400">
          Defaults reproduce the canonical run exactly.
        </span>
      </div>
    </Card>
  );
}
