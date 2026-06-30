import { NextRequest, NextResponse } from "next/server";
import { buildVariantPrompt, parseVariantCopy, PromptInsights } from "@/lib/variantPrompt";
import { VariantPlan } from "@/lib/variant";

export const runtime = "nodejs";

interface Body {
  plan: VariantPlan;
  insights: PromptInsights;
}

// Generates landing-page COPY for a data-derived slot plan using an LLM via
// OpenRouter. If no key is configured or the call fails, it returns
// source:"fallback" and the client renders baked-in copy — so the hosted demo
// always works, with or without a key.
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { plan, insights } = body;
  if (!plan?.slots?.length) {
    return NextResponse.json({ error: "missing plan" }, { status: 400 });
  }
  const safeInsights = normalizeInsights(insights);
  if (!safeInsights) {
    return NextResponse.json({ error: "invalid insights" }, { status: 400 });
  }

  // build the prompt defensively — a malformed plan must never 500
  let system: string;
  let user: string;
  try {
    ({ system, user } = buildVariantPrompt(plan, safeInsights));
  } catch {
    return NextResponse.json({ error: "could not build prompt" }, { status: 400 });
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";

  if (!apiKey) {
    return NextResponse.json({
      source: "fallback",
      reason: "no OPENROUTER_API_KEY configured",
      model,
      prompt: { system, user },
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://schole-growth-lab.vercel.app",
        "X-Title": "Scholé Growth Lab",
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 1200,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        source: "fallback",
        reason: `OpenRouter ${res.status}: ${errText.slice(0, 200)}`,
        model,
        prompt: { system, user },
      });
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const copy = parseVariantCopy(raw, plan.slots.length);

    // require a full-length copy array before claiming LLM authorship —
    // otherwise the page is mostly fallback copy and the "by {model}" badge lies
    if (!copy || copy.sections.length < plan.slots.length) {
      return NextResponse.json({
        source: "fallback",
        reason: copy ? "LLM returned too few sections" : "could not parse LLM JSON",
        model,
        prompt: { system, user },
        raw,
      });
    }

    return NextResponse.json({
      source: "llm",
      model,
      prompt: { system, user },
      raw,
      copy,
    });
  } catch (e) {
    return NextResponse.json({
      source: "fallback",
      reason: e instanceof Error ? e.message : "fetch failed",
      model,
      prompt: { system, user },
    });
  }
}

const ANGLE_SET = new Set(["roi", "pain", "personalization", "research", "speed"]);
const CTA_SET = new Set(["demo", "trial", "soft"]);

// Coerce an untrusted insights payload into the slim shape the prompt needs, or
// null if it's unusable.
function normalizeInsights(i: unknown): PromptInsights | null {
  if (!i || typeof i !== "object") return null;
  const o = i as Record<string, unknown>;
  if (!ANGLE_SET.has(o.winningAngle as string)) return null;
  if (!ANGLE_SET.has(o.losingAngle as string)) return null;
  if (!CTA_SET.has(o.bestCTA as string)) return null;
  const segs = Array.isArray(o.segmentWinners) ? o.segmentWinners : [];
  const segmentWinners = segs
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && ANGLE_SET.has((s as Record<string, unknown>).topAngle as string))
    .map((s) => ({ segmentName: String(s.segmentName ?? "segment"), topAngle: s.topAngle as PromptInsights["segmentWinners"][number]["topAngle"] }));
  return {
    winningAngle: o.winningAngle as PromptInsights["winningAngle"],
    bestCTA: o.bestCTA as PromptInsights["bestCTA"],
    losingAngle: o.losingAngle as PromptInsights["losingAngle"],
    segmentWinners,
  };
}
