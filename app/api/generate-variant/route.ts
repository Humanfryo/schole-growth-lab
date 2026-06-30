import { NextRequest, NextResponse } from "next/server";
import { Insights } from "@/lib/insights";
import { buildVariantPrompt, parseVariantCopy } from "@/lib/variantPrompt";
import { VariantPlan } from "@/lib/variant";

export const runtime = "nodejs";

interface Body {
  plan: VariantPlan;
  insights: Insights;
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

  const { system, user } = buildVariantPrompt(plan, insights);
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

    if (!copy) {
      return NextResponse.json({
        source: "fallback",
        reason: "could not parse LLM JSON",
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
