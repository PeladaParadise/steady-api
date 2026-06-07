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
  "whatToDo": "1. First step.\\n2. Second step.\\n3. Third step.",
  "sayThis": "The exact words to say to the child, in single quotes.",
  "avoidSaying": "One thing NOT to say and a brief reason why."
}

Keep each section brief and actionable. Use plain, warm language. No jargon. Fewer words always win during crisis. Body before logic always.`;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: 'claude-haiku-4-5-20251001' });
});

// ── KIT EMAIL SUBSCRIBE ──────────────────────────────────────────────────────
app.post('/subscribe', async (req, res) => {
  const { email, situation } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'valid email required' });
  }

  const KIT_API_KEY = process.env.KIT_API_KEY;
  const KIT_FORM_ID = process.env.KIT_FORM_ID;

  if (!KIT_API_KEY || !KIT_FORM_ID) {
    console.error('Kit env vars missing');
    return res.status(500).json({ error: 'subscription service not configured' });
  }

  try {
    const kitRes = await fetch(`https://api.kit.com/v4/forms/${KIT_FORM_ID}/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kit-Api-Key': KIT_API_KEY
      },
      body: JSON.stringify({
        email_address: email,
        fields: { situation: situation || 'unknown' }
      })
    });

    const kitData = await kitRes.json();

    if (!kitRes.ok) {
      console.error('Kit error:', kitData);
      return res.status(500).json({ error: 'subscription failed' });
    }

    console.log(`Subscribed: ${email} | situation: ${situation}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── AI SCRIPT GENERATION ─────────────────────────────────────────────────────
app.post('/generate-script', async (req, res) => {
  const { situation } = req.body;
  if (!situation || typeof situation !== 'string') {
    return res.status(400).json({ error: 'situation is required' });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
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
      const cleaned = block.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('Parse error:', parseError.message, 'Raw text:', block.text);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json({
      regulateYourself: parsed.regulateYourself ?? '',
      whatToDo: parsed.whatToDo ?? '',
      sayThis: parsed.sayThis ?? '',
      avoidSaying: parsed.avoidSaying ?? ''
    });
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Steady API running on port ${PORT}`));
