const STEPS = [
  { n: "1", label: "5 landing pages", sub: "distinct GTM angles" },
  { n: "2", label: "Simulate visitors", sub: "buyer personas" },
  { n: "3", label: "Bandit optimizes", sub: "Thompson sampling" },
  { n: "4", label: "Learn patterns", sub: "angles · CTAs · segments" },
  { n: "5", label: "LLM generates", sub: "a better variant" },
];

export function LoopDiagram() {
  return (
    <div className="relative">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex flex-1 items-center gap-3">
            <div className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-600 text-[10px] font-bold text-white">
                  {s.n}
                </span>
                <span className="text-[13px] font-semibold text-zinc-900">{s.label}</span>
              </div>
              <div className="mt-1 pl-7 text-[11px] text-zinc-400">{s.sub}</div>
            </div>
            {i < STEPS.length - 1 && (
              <span className="hidden shrink-0 text-zinc-300 sm:block">→</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 pl-1 text-[11px] font-medium text-violet-600">
        <span>↺</span>
        <span>the new variant re-enters the experiment — the page improves every cycle</span>
      </div>
    </div>
  );
}
