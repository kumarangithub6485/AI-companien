import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const Schema = z.object({
  observations: z.array(
    z.object({
      column: z.string(),
      value: z.string(),
      time: z.string().nullable(),
    }),
  ),
});

const SYSTEM = `You turn a caregiver's spoken daily note about a child with special needs into rows for a tracking table. The table's columns are created from what the caregiver says, so your job is to choose good column names and short, consistent values.

Rules:
- One observation per distinct fact. A note covering breakfast, an outing and a nap gives three observations.
- column: a short, general, Title-case name such as "Breakfast", "Lunch", "Dinner", "Snacks", "Nap", "Night sleep", "Outing", "Mood", "Therapy", "Medication". Reuse one of the existing columns whenever the fact fits it, even if the caregiver used a different word ("slept in the afternoon" belongs in an existing "Nap" column). Only invent a new column for a genuinely new kind of fact.
- value: 1-4 lowercase words, normalised so the same thing is written the same way every day ("park", not "the big park near home"). For things that did not happen use "no" (for example Snacks: no). For durations use a number and unit ("1.5 hours").
- Aggression always goes in the column "Aggression" with a value of exactly "none", "mild", "moderate" or "severe". Use "none" only when the caregiver says the child was not aggressive; if aggression is not mentioned, leave it out. Judge the level from the description: irritability or shouting is mild, hitting or throwing things is moderate, injury or a prolonged episode is severe.
- time: 24-hour "HH:MM" when the caregiver gives or implies a time (morning 09:00, afternoon 14:00, evening 18:00, night 21:00), otherwise null.
- Record only what was said. Do not infer facts, and leave out the child's name.`;

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
      system: SYSTEM,
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
