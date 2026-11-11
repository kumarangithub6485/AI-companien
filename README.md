# Care Companion

A web app for caregivers of children with special needs. Tap the microphone, describe the child's day, and the app turns what you said into a table whose columns are created from your words. It then shows a daily timeline and which factors go with aggression for each child.

## Using it

1. **Add a child** and pick a **date** (today by default).
2. **Record**: tap the microphone and speak, for example "He had idli for breakfast, went to the park, napped at 2 pm for an hour, skipped snacks and was very aggressive in the evening". You can also type.
3. **Create columns**: the note becomes lines such as Breakfast: idli, Outing: park, Nap: 1 hour, Snacks: no, Aggression: severe. Correct anything, then save. Mentioning something new creates a new column.
4. **Timeline** shows the selected day in time order. **Table** shows every day and downloads as CSV.
5. **Insights** shows aggression by day, the factors linked to more or less aggression (same day and the day before), and the time of day episodes happen.

To look around before logging real data, open **Table** and choose **Load made-up sample child**.

## Running it

```
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests for extraction rules and the insight maths
```

### Turning on the AI

Copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. With a key, Claude reads each note and chooses the columns, and the Insights screen can write a plain-language summary. Without a key the app still works, using simple built-in keyword rules that only recognise common phrases in English.

When hosting (for example on Vercel), set `ANTHROPIC_API_KEY` as an environment variable there.

## Things to know

- **Tamil and English**: choose English or தமிழ் under the microphone before speaking (the browser can only listen for one language at a time; English words inside Tamil speech are usually still picked up). Columns and values are always shown in English. Translating Tamil notes needs the AI key; the built-in keyword rules are English-only.
- **Speech** uses the browser's built-in recognition, which works in Chrome and Edge (and Safari on recent versions). Other browsers fall back to typing.
- **Storage** is this browser on this device. There is no login or shared database yet, so records are not visible on other devices. Use **Download backup** on the Table screen regularly; **Restore backup** loads it elsewhere.
- **Privacy**: with the AI turned on, the text of each note is sent to Anthropic's API to be read. The child's name is not sent, so avoid saying full names in notes.
- **How insights are worked out**: for each factor the app compares how often aggression happened on days with it against all other logged days, and marks how likely the gap is to be chance. Factors need at least 3 days on each side, and nothing is shown until 10 days are logged. A logged day with no mention of aggression counts as calm. These are patterns, not proof of cause.
