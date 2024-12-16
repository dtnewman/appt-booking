import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const completion = await openai.chat.completions.create({
      messages,
      model: 'gpt-4o',
      temperature: 0.7,
    });

    return NextResponse.json(completion.choices[0].message);
  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
