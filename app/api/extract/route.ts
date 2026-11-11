import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { EXTRACT_PROMPT } from "@/lib/prompts";

const Schema = z.object({
  observations: z.array(
    z.object({
      column: z.string(),
      value: z.string(),
      time: z.string().nullable(),
    }),
  ),
});


export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "no_key" }, { status: 503 });
  }
  const { transcript, columns } = (await req.json()) as { transcript?: string; columns?: string[] };
  if (!transcript?.trim()) return Response.json({ error: "empty" }, { status: 400 });

  try {
    const client = new Anthropic();
    const res = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: EXTRACT_PROMPT,
      messages: [
        {
          role: "user",
          content: `Existing columns: ${columns?.length ? columns.join(", ") : "(none yet)"}\n\nCaregiver's note:\n${transcript}`,
        },
      ],
      output_config: { effort: "low", format: betaZodOutputFormat(Schema) },
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return Response.json({ error: "no_result" }, { status: 502 });
    }
    return Response.json(res.parsed_output);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return Response.json({ error: "no_key" }, { status: 503 });
    if (err instanceof Anthropic.RateLimitError) return Response.json({ error: "busy" }, { status: 429 });
    if (err instanceof Anthropic.APIError) return Response.json({ error: "ai_error", detail: err.message }, { status: 502 });
    throw err;
  }
}
