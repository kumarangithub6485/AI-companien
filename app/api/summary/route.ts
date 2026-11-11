import Anthropic from "@anthropic-ai/sdk";
import { SUMMARY_PROMPT } from "@/lib/prompts";


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
      system: SUMMARY_PROMPT,
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
