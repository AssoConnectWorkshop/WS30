import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function parseReceipt(imageUrl: string): Promise<{
  date: string;
  amount: number;
  currency: string;
  description: string;
}> {
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString('base64');
  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: 'Extract the following from this receipt image and respond with JSON only (no markdown): date (YYYY-MM-DD format), amount (number, no currency symbol), currency (3-letter ISO code like EUR or USD), description (merchant name or brief description). Example: {"date":"2024-01-15","amount":42.50,"currency":"EUR","description":"Restaurant Le Bistrot"}',
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = JSON.parse(text);
  return {
    date: parsed.date || new Date().toISOString().split('T')[0],
    amount: Number(parsed.amount),
    currency: parsed.currency || 'EUR',
    description: parsed.description || 'Expense',
  };
}
