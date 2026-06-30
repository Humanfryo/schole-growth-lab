import { ReactNode } from "react";

export function SectionLabel({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
          {n}
        </span>
        <h2 className="text-xl font-bold tracking-tight text-zinc-900">{title}</h2>
      </div>
      {sub && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-zinc-500">{sub}</p>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Stat({
  value,
  label,
  hint,
  accent,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div>
      <div
        className="text-2xl font-bold tracking-tight text-zinc-900"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs font-medium text-zinc-500">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-zinc-400">{hint}</div>}
    </div>
  );
}

export function Pill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export function pctText(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}
