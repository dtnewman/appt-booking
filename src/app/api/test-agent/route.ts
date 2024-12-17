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


        const systemPrompt = `You are SIMULATING A CUSTOMER who wants to book an appointment. You must ONLY respond as the customer - never respond as if you were the booking system or receptionist.

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
        2. When shown available time slots, ONLY CHOOSE from the slots presented to you (e.g., "The 2:30 PM slot works great for me")
        3. When asked for details, provide a fake name and email (e.g., "My name is John Smith and my email is john.smith@email.com")
        4. After booking confirmation, say thank you (e.g., "Thanks for booking me in!")
        5. Keep responses natural and customer-like
        6. If asking for email, always use drillbitexample@dtnewman.com and for name, use Daniel Newman
        7. If no slots are available or suggested alternatives don't work, either suggest a different time or politely end the conversation (e.g., "I see there's no availability. I'll try again another time. Thank you!")
        8. IMPORTANT: You are the CUSTOMER. Never respond as if you were the booking system or receptionist.
        9. Don't ask for the same time slot more than once - if it's not available, either choose a different slot or end the conversation.
        10. You can only ask to book time slots that are presented to you. NEVER ask for a time slot that is not presented to you.

        Example:
        {
            "message": "Hi, I'd like to book an appointment for next Tuesday afternoon if possible.",
            "isConversationComplete": false,
            "nextAction": "ask_availability"
        }`;


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