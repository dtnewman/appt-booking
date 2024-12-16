import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/scheduling';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];

    // Check if the message is asking about availability
    if (lastMessage.content.toLowerCase().includes('availab')) {
      // Get next 4 weeks of availability
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 28);

      const slots = await getAvailableSlots({
        startDate,
        endDate
      });

      // Format slots for the AI response
      const availabilityInfo = slots.map(slot =>
        `${new Date(slot.startTime).toLocaleDateString()} at ${new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      ).join('\n');

      const systemPrompt = {
        role: 'system',
        content: `Here are the available slots:\n${availabilityInfo}\n\nPlease format this information in a clear way for the user.`
      };

      messages.push(systemPrompt);
    }

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

async function extractBookingInfo(message: string) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const dateRegex = /\d{4}-\d{2}-\d{2}/;
  const timeRegex = /\d{2}:\d{2}/;

  const email = message.match(emailRegex)?.[0];
  const date = message.match(dateRegex)?.[0];
  const time = message.match(timeRegex)?.[0];
  const name = message.split('name is').pop()?.split('.')[0]?.trim();

  return { email, date, time, name };
}
