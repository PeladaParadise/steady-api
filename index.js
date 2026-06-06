import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a calm, evidence-based parenting coach specialising in neurodivergent children with ADHD. A parent has described a difficult situation and needs an immediate practical script.

Your approach draws on polyvagal theory (regulate the nervous system first), neurosequential development (body before logic), collaborative problem solving (kids do well when they can), and attachment science (repair matters more than consequences in the acute moment).

Respond ONLY with a valid JSON object (no markdown, no code fences, no extra text) in exactly this format:
{
  "regulateYourself": "One or two sentences telling the parent how to regulate their own nervous system right now.",
  "whatToDo": "1. First step.\n2. Second step.\n3. Third step.",
  "sayThis": "The exact words to say to the child, in single quotes.",
  "avoidSaying": "One thing NOT to say and a brief reason why."
}

Keep each section brief and actionable. Use plain, warm language. No jargon. Fewer words always win during crisis. Body before logic always.`;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/generate-script', async (req, res) => {
  const { situation } = req.body;
  if (!situation || typeof situation !== 'string') {
    return res.status(400).json({ error: 'situation is required' });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `The parent describes: ${situation}` }]
    });

    const block = message.content[0];
    if (block.type !== 'text') {
      return res.status(500).json({ error: 'Unexpected response from AI' });
    }

    let parsed;
    try {
      parsed = JSON.parse(block.text);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json({
      regulateYourself: parsed.regulateYourself ?? '',
      whatToDo: parsed.whatToDo ?? '',
      sayThis: parsed.sayThis ?? '',
      avoidSaying: parsed.avoidSaying ?? ''
    });
  } catch (err) {
    console.error('Anthropic error:', err);
    res.status(500).json({ error: 'Failed to generate script. Please try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Steady API running on port ${PORT}`));
