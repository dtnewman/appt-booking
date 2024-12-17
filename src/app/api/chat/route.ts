import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/scheduling';
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { Message } from '@/lib/openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Add this helper function
const debugLog = (...args: any[]) => {
  if (process.env.DEBUG_BACKEND?.toLowerCase() === 'true') {
    console.log(...args);
  }
};

// Interfaces
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

// Zod Schemas
const availabilitySchema = z.object({
  isAvailabilityQuery: z.boolean(),
  params: z.object({
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    startTime: z.string().nullable(),
    endTime: z.string().nullable()
  })
});

const alternativeSuggestionSchema = z.object({
  message: z.string(),
  alternativeQuery: z.object({
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    startTime: z.string().nullable(),
    endTime: z.string().nullable()
  })
});

const formattedResponseSchema = z.object({
  message: z.string(),
  selectedSlots: z.array(z.object({
    date: z.string(),      // "YYYY-MM-DD"
    time: z.string(),      // "HH:mm"
    providerId: z.string()
  })),
  isBookingRequest: z.boolean(),
  bookingDetails: z.object({
    name: z.string(),
    email: z.string(),
    selectedSlot: z.object({
      date: z.string(),
      time: z.string(),
      providerId: z.string()
    })
  }).optional()
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Filter out messages with role "slots"
    const filteredMessages = messages.filter((message: Message) => message.role !== 'slots');
    const lastMessage = filteredMessages[filteredMessages.length - 1];
    const currentDate = new Date();

    // System Prompt for checking availability
    const systemPrompt = `
      You are a scheduling assistant. Today is ${currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })} and the current time is ${currentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })}.

      Analyze if the user's message is asking about availability. Consider the full conversation context.
      IMPORTANT: For relative dates (like "next month" or "next week"), always consider the current year (${currentDate.getFullYear()}) 
      and adjust the year if the date falls into the next year.

      Return a JSON response:
      {
        "isAvailabilityQuery": boolean,
        "params": {
          "startDate": "YYYY-MM-DD" | null,
          "endDate": "YYYY-MM-DD" | null,
          "startTime": "HH:mm" | null,
          "endTime": "HH:mm" | null
        }
      }

      Example: If today is December 16, 2024, "Do you have any appointments next month?" should return:
      {
        "isAvailabilityQuery": true,
        "params": {
          "startDate": "2025-01-01",
          "endDate": "2025-01-31",
          "startTime": null,
          "endTime": null
        }
      }
    `;

    // Step 1: Determine if it's an availability query
    const availabilityCheck = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...filteredMessages.slice(0, -1),
        lastMessage
      ],
      model: 'gpt-4o',
      response_format: zodResponseFormat(availabilitySchema, 'availability_response'),
      temperature: 0
    });

    debugLog("Availability Check:", availabilityCheck.choices[0].message.content);

    const analysis = JSON.parse(availabilityCheck.choices[0].message.content || '');

    // If it is an availability query, attempt to fetch slots
    if (analysis.isAvailabilityQuery) {
      const now = new Date();
      const params: AvailabilityParams = {
        startDate: analysis.params.startDate || now.toISOString().split('T')[0],
        endDate: analysis.params.endDate || undefined,
        startTime: analysis.params.startTime || undefined,
        endTime: analysis.params.endTime || undefined
      };

      debugLog("Params:", params);

      const slots = (await getAvailableSlots(params)).slice(0, 20);

      // If no slots found, request alternative suggestions from the LLM
      if (!slots || slots.length === 0) {
        const alternativeSuggestion = await openai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `
                No slots were found for the following parameters:
                Start Date: ${params.startDate}
                End Date: ${params.endDate || 'Not specified'}
                Start Time: ${params.startTime || 'Not specified'}
                End Time: ${params.endTime || 'Not specified'}

                Please suggest an alternative time frame to check for availability. 

                Return a JSON response:
                {
                  "message": "A friendly message explaining no slots and suggesting alternatives",
                  "alternativeQuery": {
                    "startDate": "YYYY-MM-DD" or null,
                    "endDate": "YYYY-MM-DD" or null,
                    "startTime": "HH:mm" or null,
                    "endTime": "HH:mm" or null
                  }
                }
              `
            },
            ...filteredMessages
          ],
          model: 'gpt-4o',
          response_format: zodResponseFormat(alternativeSuggestionSchema, 'alternative_suggestion'),
          temperature: 0.2,
        });

        const suggestion = JSON.parse(alternativeSuggestion.choices[0].message.content || '');

        // If we get alternative parameters, try again with these new parameters
        if (suggestion.alternativeQuery.startDate) {
          const newSlots = await getAvailableSlots(suggestion.alternativeQuery);
          return NextResponse.json({
            message: suggestion.message,
            availableSlots: newSlots.slice(0, 7)  // Limit to 7 slots
          });
        }

        // If no alternative parameters, just return the message
        return NextResponse.json({ message: suggestion.message });
      }

      debugLog("Slots (LLM Input):", slots);

      // Format the available slots using the LLM
      const completion = await openai.chat.completions.create({
        messages: [
          ...filteredMessages,
          {
            role: 'system',
            content: `
              Here are the available slots:
              ${slots.map(slot =>
              `${new Date(slot.startTime).toLocaleDateString()} at ${new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Provider: ${slot.providerId})`
            ).join('\n')}

              Please analyze these slots and return a JSON response:
              {
                "message": "A friendly message",
                "selectedSlots": [
                  {
                    "date": "YYYY-MM-DD",
                    "time": "HH:mm",
                    "providerId": "provider_id"
                  }
                ]
              }

              Guidelines:
              1. Provide a friendly message about the availability.
              2. Return up to 8 recommended slots that best match the user's request.
              3. Remind the user they can click the time slots shown below the chat to book or they can ask you to book for them.
              4. If no specific time requested, show the next (up to) 7 available slots.
              5. If a time was specified, show up to 8 available slots that match the request.
              6. Use best judgment to pick appropriate slots (e.g., prefer mornings if user requested morning).
              7. Avoid saying "Here are the available slots." Instead, say "Here are some available slots" or "Here are some available times".
              
            `
          }
        ],
        model: 'gpt-4o',
        response_format: zodResponseFormat(formattedResponseSchema, 'formatted_response'),
        temperature: 0.2,
      });

      const formattedResult = JSON.parse(completion.choices[0].message.content || '');
      const response: ChatResponse = {
        message: formattedResult.message,
        availableSlots: formattedResult.selectedSlots.map((slot: { date: string; time: string; providerId: string; }) => ({
          startTime: new Date(`${slot.date}T${slot.time}:00`),
          endTime: new Date(`${slot.date}T${slot.time}:00`),
          providerId: slot.providerId
        })).slice(0, 7)  // Limit to 7 slots
      };

      debugLog("Response:", response);
      return NextResponse.json(response);
    }

    // If not an availability query, check if it's a booking request with details
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `
            You are a scheduling assistant. If the user provides their name and email for booking,
            DO NOT confirm the booking. Instead, return their details in the bookingDetails field
            and set isBookingRequest to true. The message should ask them to confirm their booking details.
          `
        },
        ...filteredMessages
      ],
      model: 'gpt-4o',
      response_format: zodResponseFormat(formattedResponseSchema, 'formatted_response'),
      temperature: 0.2,
    });

    const response = JSON.parse(completion.choices[0].message.content || '');

    // If this is a booking request with details, include them in the response
    if (response.isBookingRequest && response.bookingDetails) {
      return NextResponse.json({
        message: response.message,
        bookingDetails: response.bookingDetails
      });
    }

    return NextResponse.json({
      message: response.message
    });

  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
