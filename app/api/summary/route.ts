import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You help caregivers at a centre for children with special needs read a table of statistics about one child's aggression. Each line compares how often aggression happened on days with a factor against days without it.

Write a short summary (under 150 words) in plain, warm language for a caregiver, not a statistician: the two or three factors that stand out most, including any that seem protective, and one practical thing worth trying or watching. These are patterns from a small number of days, not proof of cause, so say so once and suggest discussing them with the child's therapist. Mention when a pattern rests on very few days. Plain sentences only, no headings or bullet points. Use only the numbers given.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "no_key" }, { status: 503 });
  }
  const { stats } = (await req.json()) as { stats?: string };
  if (!stats?.trim()) return Response.json({ error: "empty" }, { status: 400 });

  try {
    const client = new Anthropic();
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: stats }],
      output_config: { effort: "low" },
    });
    if (res.stop_reason === "refusal") return Response.json({ error: "no_result" }, { status: 502 });
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    return Response.json({ text });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return Response.json({ error: "no_key" }, { status: 503 });
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "busy" }, { status: 429 });
    if (err instanceof Anthropic.APIError) return Response.json({ error: "ai_error", detail: err.message }, { status: 502 });
    throw err;
  }
}
