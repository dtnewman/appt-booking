import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Zod Schema for agent response
const agentResponseSchema = z.object({
    message: z.string(),
    isConversationComplete: z.boolean(),
    nextAction: z.enum(['ask_availability', 'respond_to_slots', 'provide_details', 'confirm_booking', 'end_conversation'])
});

const debugLog = (...args: any[]) => {
    if (process.env.DEBUG_TEST_AGENT?.toLowerCase() === 'true') {
        console.log(...args);
    }
};

export async function POST(req: Request) {
    try {
        const { currentMessages } = await req.json();
        debugLog("Current Messages:", currentMessages);

        const systemPrompt = `You are a customer trying to book an appointment. Analyze the conversation and respond appropriately.

        Return a JSON response with:
        {
            "message": "Your natural response as a customer",
            "isConversationComplete": boolean (true if booking is confirmed and thanked),
            "nextAction": one of:
                - "ask_availability" (initial query or new time request)
                - "respond_to_slots" (when shown available times)
                - "provide_details" (when asked for name/email)
                - "confirm_booking" (after booking is processed)
                - "end_conversation" (final thank you)
        }

        Guidelines:
        1. If no messages exist, ask about availability for a specific time
        2. When shown slots, express interest in one of them
        3. When asked for details, provide a fake name and email
        4. After booking confirmation, express gratitude
        5. Keep responses conversational and natural

        Example:
        {
            "message": "I'd like to schedule an appointment for next Tuesday afternoon if possible.",
            "isConversationComplete": false,
            "nextAction": "ask_availability"
        }`;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                ...currentMessages
            ],
            model: 'gpt-4o',
            response_format: zodResponseFormat(agentResponseSchema, 'agent_response'),
            temperature: 0.7,
        });

        const response = JSON.parse(completion.choices[0].message.content || '');
        return NextResponse.json(response);
    } catch (error) {
        console.error('Test Agent API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
} 