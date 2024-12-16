import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/scheduling';
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { startOfDay, endOfDay } from 'date-fns';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface AvailabilityParams {
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  providerId?: string;
}

interface ChatResponse {
  message: string;
  availableSlots?: {
    startTime: Date;
    endTime: Date;
    providerId: string;
  }[];
}



export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];

    // First, ask OpenAI if this is an availability query and to parse parameters

    const availabilitySchema = z.object({
      isAvailabilityQuery: z.boolean(),
      params: z.object({
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
        startTime: z.string().nullable(),
        endTime: z.string().nullable()
      })
    });

    const availabilityCheck = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a scheduling assistant. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}, ${new Date().toISOString().split('T')[0]} and the current time is ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}.

          Analyze if the user's message is asking about availability. Consider the full conversation context when interpreting time references.

          Return a JSON response with the following structure:
          {
            "isAvailabilityQuery": boolean,
            "params": {
              "startDate": "YYYY-MM-DD" | null,
              "endDate": "YYYY-MM-DD" | null,
              "startTime": "HH:mm" | null,
              "endTime": "HH:mm" | null
            }
          }
          
          For example, "Do you have any appointments next week?" would return:
          {
            "isAvailabilityQuery": true,
            "params": {
              "startDate": "2024-01-22",
              "endDate": "2024-01-29",
              "startTime": null,
              "endTime": null
            }
          }`
        },
        ...messages.slice(0, -1),
        lastMessage
      ],
      model: 'gpt-4o',
      response_format: zodResponseFormat(availabilitySchema, 'availability_response'),
      temperature: 0
    });

    console.log("Availability Check:", availabilityCheck.choices[0].message.content);

    const analysis = JSON.parse(availabilityCheck.choices[0].message.content || '');

    if (analysis.isAvailabilityQuery) {
      const params: AvailabilityParams = {};

      if (analysis.params.startDate) {
        params.startDate = analysis.params.startDate;
      }
      if (analysis.params.endDate) {
        params.endDate = analysis.params.endDate;
      }
      if (analysis.params.startTime) {
        params.startTime = analysis.params.startTime;
      }
      if (analysis.params.endTime) {
        params.endTime = analysis.params.endTime;
      }

      console.log("Params:", params);

      const slots = await getAvailableSlots(params);

      console.log("Slots (LLM Input):", slots);

      const formattedResponseSchema = z.object({
        message: z.string(),
        selectedSlots: z.array(z.object({
          date: z.string(),  // "YYYY-MM-DD"
          time: z.string(),  // "HH:mm"
          providerId: z.string()
        }))
      });



      const completion = await openai.chat.completions.create({
        messages: [
          ...messages,
          {
            role: 'system',
            content: `Here are the available slots:\n${slots.map(slot =>
              `${new Date(slot.startTime).toLocaleDateString()} at ${new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Provider: ${slot.providerId})`
            ).join('\n')}\n\nPlease analyze these slots and return a JSON response with:
            1. A friendly message explaining the availability
            2. A curated list of recommended slots that best match the user's request
            
            Format your response as:
            {
              "message": "Your friendly message here",
              "selectedSlots": [
                {
                  "date": "YYYY-MM-DD",
                  "time": "HH:mm",
                  "providerId": "provider_id"
                }
              ]
            }`
          }
        ],
        model: 'gpt-4o',
        response_format: zodResponseFormat(formattedResponseSchema, 'formatted_response'),
        temperature: 0.7,
      });

      const formattedResult = JSON.parse(completion.choices[0].message.content || '');
      const response: ChatResponse = {
        message: formattedResult.message,
        availableSlots: formattedResult.selectedSlots.map((slot: { date: any; time: any; providerId: any; }) => ({
          startTime: new Date(`${slot.date}T${slot.time}`),
          endTime: new Date(`${slot.date}T${slot.time}`), // You might want to add duration
          providerId: slot.providerId
        }))
      };

      console.log("Response:", response);

      return NextResponse.json(response);
    }

    // For non-availability queries, just get a regular response
    const completion = await openai.chat.completions.create({
      messages,
      model: 'gpt-4o',
      temperature: 0.7,
    });

    return NextResponse.json({
      message: completion.choices[0].message.content
    });

  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
