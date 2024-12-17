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
        const { currentMessages, slotsList } = await req.json();

        console.log("slotsList2", slotsList);


        const systemPrompt = `You are a customer who wants to book an appointment. Respond naturally as if you were a real customer speaking to a booking system or receptionist.

        Return a JSON response with:
        {
            "message": "Your response as a customer seeking an appointment",
            "isConversationComplete": boolean (true if booking is confirmed and thanked),
            "nextAction": one of:
                - "ask_availability" (initial query or new time request)
                - "respond_to_slots" (when shown available times)
                - "provide_details" (when asked for name/email)
                - "confirm_booking" (after booking is processed)
                - "end_conversation" (final thank you)
        }

        Guidelines:
        1. If starting the conversation, request an appointment for a specific day/time (e.g., "Hi, I'd like to book an appointment for next Tuesday afternoon")
        2. When shown available time slots, pick one (e.g., "The 2:30 PM slot works great for me")
        3. When asked for details, provide a fake name and email (e.g., "My name is John Smith and my email is john.smith@email.com")
        4. After booking confirmation, say thank you (e.g., "Thanks for booking me in!")
        5. Keep responses natural and customer-like
        6. If asking for email, always use drillbitexample@dtnewman.com and for name, use Daniel Newman

        Example:
        {
            "message": "Hi, I'd like to book an appointment for next Tuesday afternoon if possible.",
            "isConversationComplete": false,
            "nextAction": "ask_availability"
        }`;

        if (slotsList && slotsList.length > 0) {
            // Add available slots to the conversation context
            currentMessages.push({
                role: 'assistant',
                content: `Here are the available appointment slots:\n${slotsList.join('\n')}\nDo any of these work for you?`
            });
        }

        debugLog("Current Messages:", currentMessages);

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