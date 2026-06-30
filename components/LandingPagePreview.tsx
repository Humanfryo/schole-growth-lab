import { ANGLE_COLORS } from "@/lib/colors";
import { ANGLE_LABEL, PageSpec, Section } from "@/lib/types";

const LOGOS = ["Decathlon", "Bank of America", "Oracle", "NASA", "Harvard DSI"];

function SectionBlock({ section, accentHex }: { section: Section; accentHex: string }) {
  const c = ANGLE_COLORS[section.angle];

  if (section.kind === "metrics") {
    const stats = (section.bullets && section.bullets.length
      ? section.bullets
      : section.body.split("·")
    )
      .map((s) => s.trim())
      .filter(Boolean);
    // only render the stat-tile layout when there are genuinely multiple stats;
    // otherwise fall through to the normal paragraph block below
    if (stats.length >= 2) {
      return (
        <div className="border-t border-zinc-100 px-8 py-10">
          <h3 className="mb-5 text-lg font-semibold text-zinc-900">{section.heading}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map((s, i) => (
              <div key={i} className={`rounded-xl ${c.bgSoft} px-4 py-5 text-center`}>
                <span className={`text-sm font-semibold ${c.text}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  if (section.kind === "social_proof") {
    return (
      <div className="border-t border-zinc-100 bg-zinc-50/60 px-8 py-10">
        <h3 className="mb-4 text-lg font-semibold text-zinc-900">{section.heading}</h3>
        <p className="mb-5 max-w-2xl text-[15px] leading-relaxed text-zinc-600">{section.body}</p>
        <div className="flex flex-wrap gap-2">
          {LOGOS.map((l) => (
            <span
              key={l}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500"
            >
              {l}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-zinc-400">Illustrative proof points for this demo.</p>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-100 px-8 py-10">
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${c.dot}`} />
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${c.text}`}>
          {ANGLE_LABEL[section.angle]}
        </span>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-zinc-900">{section.heading}</h3>
      <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-600">{section.body}</p>
      {section.bullets && (
        <ul className="mt-4 space-y-2">
          {section.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-[15px] text-zinc-700">
              <span style={{ color: accentHex }} className="mt-0.5">
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LandingPagePreview({ page }: { page: PageSpec }) {
  const c = ANGLE_COLORS[page.primaryAngle];
  const body = page.sections.filter((s) => s.kind !== "hero" && s.kind !== "cta");
  const cta = page.sections.find((s) => s.kind === "cta");

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-8 py-4">
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-md bg-gradient-to-br ${c.grad}`} />
          <span className="text-base font-bold tracking-tight text-zinc-900">Scholé</span>
        </div>
        <div className="hidden items-center gap-6 text-sm text-zinc-500 sm:flex">
          <span>Platform</span>
          <span>Research</span>
          <span>Customers</span>
          <button className={`rounded-lg ${c.bg} px-3.5 py-1.5 text-sm font-medium text-white`}>
            {page.cta.label}
          </button>
        </div>
      </div>

      {/* hero */}
      <div className={`relative overflow-hidden bg-gradient-to-b ${c.bgSoft} to-white px-8 pt-12 pb-12`}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border ${c.border} bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${c.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
          {ANGLE_LABEL[page.primaryAngle]}
        </span>
        <h1 className="mt-5 max-w-2xl text-3xl font-bold leading-[1.15] tracking-tight text-zinc-900 sm:text-4xl">
          {page.headline}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600">{page.subhead}</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            className={`rounded-xl bg-gradient-to-br ${c.grad} px-5 py-3 text-sm font-semibold text-white shadow-sm`}
          >
            {page.cta.label}
          </button>
          <button className="rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700">
            See how it works
          </button>
        </div>
      </div>

      {/* body sections */}
      {body.map((s, i) => (
        <SectionBlock key={i} section={s} accentHex={c.hex} />
      ))}

      {/* closing CTA */}
      {cta && (
        <div className={`bg-gradient-to-br ${c.grad} px-8 py-12 text-center`}>
          <h3 className="text-2xl font-bold tracking-tight text-white">{cta.heading}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/85">{cta.body}</p>
          <button className="mt-6 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm">
            {page.cta.label}
          </button>
        </div>
      )}
    </div>
  );
}
