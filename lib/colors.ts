import { Angle } from "./types";

// Explicit, literal Tailwind class strings per angle so the v4 JIT compiler can
// see them (dynamic `bg-${x}-500` would get purged). Each angle owns a hue.
export interface AngleColor {
  label: string;
  hex: string; // for recharts / inline svg
  text: string;
  bg: string;
  bgSoft: string;
  border: string;
  ring: string;
  dot: string;
  grad: string; // gradient classes for hero strips
}

export const ANGLE_COLORS: Record<Angle, AngleColor> = {
  roi: {
    label: "ROI & Proof",
    hex: "#059669",
    text: "text-emerald-700",
    bg: "bg-emerald-600",
    bgSoft: "bg-emerald-50",
    border: "border-emerald-200",
    ring: "ring-emerald-500/30",
    dot: "bg-emerald-500",
    grad: "from-emerald-500 to-teal-600",
  },
  pain: {
    label: "Adoption-Gap Pain",
    hex: "#e11d48",
    text: "text-rose-700",
    bg: "bg-rose-600",
    bgSoft: "bg-rose-50",
    border: "border-rose-200",
    ring: "ring-rose-500/30",
    dot: "bg-rose-500",
    grad: "from-rose-500 to-pink-600",
  },
  personalization: {
    label: "Role Personalization",
    hex: "#7c3aed",
    text: "text-violet-700",
    bg: "bg-violet-600",
    bgSoft: "bg-violet-50",
    border: "border-violet-200",
    ring: "ring-violet-500/30",
    dot: "bg-violet-500",
    grad: "from-violet-500 to-indigo-600",
  },
  research: {
    label: "Research Credibility",
    hex: "#0284c7",
    text: "text-sky-700",
    bg: "bg-sky-600",
    bgSoft: "bg-sky-50",
    border: "border-sky-200",
    ring: "ring-sky-500/30",
    dot: "bg-sky-500",
    grad: "from-sky-500 to-cyan-600",
  },
  speed: {
    label: "Speed / Micro-learning",
    hex: "#d97706",
    text: "text-amber-700",
    bg: "bg-amber-600",
    bgSoft: "bg-amber-50",
    border: "border-amber-200",
    ring: "ring-amber-500/30",
    dot: "bg-amber-500",
    grad: "from-amber-500 to-orange-600",
  },
};

export const SEGMENT_HEX: Record<string, string> = {
  cfo: "#0f766e",
  lnd: "#7c3aed",
  ic: "#d97706",
};
