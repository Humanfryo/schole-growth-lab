"use client";

import { useEffect, useState } from "react";
import { ANGLE_COLORS } from "@/lib/colors";
import { ANGLE_LABEL, PageSpec } from "@/lib/types";
import LandingPagePreview from "./LandingPagePreview";
import { Pill } from "./ui";

export function PreviewModal({
  page,
  onClose,
}: {
  page: PageSpec | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (page) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [page, onClose]);

  if (!page) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Landing page preview: ${page.name}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="scroll-slim w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-white/90">
            Live preview · Page {page.id} — {page.name}
          </span>
          <button
            onClick={onClose}
            autoFocus
            aria-label="Close preview"
            className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25"
          >
            Close ✕
          </button>
        </div>
        <LandingPagePreview page={page} />
      </div>
    </div>
  );
}

export function PageCard({
  page,
  onOpen,
  badge,
}: {
  page: PageSpec;
  onOpen: () => void;
  badge?: string;
}) {
  const c = ANGLE_COLORS[page.primaryAngle];
  return (
    <button
      onClick={onOpen}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${c.grad}`} />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">
            {page.id}
          </span>
          {badge ? (
            <Pill className={`${c.bgSoft} ${c.text}`}>{badge}</Pill>
          ) : (
            <Pill className={`${c.bgSoft} ${c.text}`}>{ANGLE_LABEL[page.primaryAngle]}</Pill>
          )}
        </div>
        <h3 className="text-[15px] font-bold leading-snug tracking-tight text-zinc-900">
          {page.headline}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-zinc-500">
          {page.subhead}
        </p>
        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
          <span className="text-[11px] font-medium text-zinc-400">
            {page.sections.length} sections · CTA: {page.cta.label}
          </span>
          <span className={`text-xs font-semibold ${c.text} group-hover:underline`}>
            Preview →
          </span>
        </div>
      </div>
    </button>
  );
}

export function VariantGallery({ pages }: { pages: PageSpec[] }) {
  const [open, setOpen] = useState<PageSpec | null>(null);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((p) => (
          <PageCard key={p.id} page={p} onOpen={() => setOpen(p)} />
        ))}
      </div>
      <PreviewModal page={open} onClose={() => setOpen(null)} />
    </>
  );
}
