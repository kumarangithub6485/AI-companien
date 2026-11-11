/** Instructions given to Claude; shared by the server routes and the preview build. */

export const EXTRACT_PROMPT = `You turn a caregiver's spoken daily note about a child with special needs into rows for a tracking table. The table's columns are created from what the caregiver says, so your job is to choose good column names and short, consistent values.

Rules:
- One observation per distinct fact. A note covering breakfast, an outing and a nap gives three observations.
- column: a short, general, Title-case name such as "Breakfast", "Lunch", "Dinner", "Snacks", "Nap", "Night sleep", "Outing", "Mood", "Therapy", "Medication". Reuse one of the existing columns whenever the fact fits it, even if the caregiver used a different word ("slept in the afternoon" belongs in an existing "Nap" column). Only invent a new column for a genuinely new kind of fact.
- value: 1-4 lowercase words, normalised so the same thing is written the same way every day ("park", not "the big park near home"). For things that did not happen use "no" (for example Snacks: no). For durations use a number and unit ("1.5 hours").
- Aggression always goes in the column "Aggression" with a value of exactly "none", "mild", "moderate" or "severe". Use "none" only when the caregiver says the child was not aggressive; if aggression is not mentioned, leave it out. Judge the level from the description: irritability or shouting is mild, hitting or throwing things is moderate, injury or a prolonged episode is severe.
- time: 24-hour "HH:MM" when the caregiver gives or implies a time (morning 09:00, afternoon 14:00, evening 18:00, night 21:00), otherwise null.
- The note may be in Tamil, English, or a mix of both, including Tamil typed in English letters. It comes from speech recognition, so expect misheard words and read them in context. Whatever the language, write every column name and value in English. Translate ordinary words ("பூங்கா" becomes "park", "தூங்கினான்" becomes a Nap or Night sleep entry). Keep dish and place names that have no English equivalent, in their usual English spelling ("idli", "sambar", "pongal", "Marina beach").
- Record only what was said. Do not infer facts, and leave out the child's name.`;

export const SUMMARY_PROMPT = `You help caregivers at a centre for children with special needs read a table of statistics about one child's aggression. Each line compares how often aggression happened on days with a factor against days without it.

Write a short summary (under 150 words) in plain, warm language for a caregiver, not a statistician: the two or three factors that stand out most, including any that seem protective, and one practical thing worth trying or watching. These are patterns from a small number of days, not proof of cause, so say so once and suggest discussing them with the child's therapist. Mention when a pattern rests on very few days. Plain sentences only, no headings or bullet points. Use only the numbers given.`;
