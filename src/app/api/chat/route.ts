import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';
import { getAvailableSlots } from '@/lib/scheduling';
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { startOfDay, endOfDay, parseISO, isBefore } from 'date-fns';
import { Message } from '@/lib/openai';

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

    console.log("Messages:", messages);
    // remove any messages that have role "slots"
    const filteredMessages = messages.filter((message: Message) => message.role !== 'slots');
    const lastMessage = filteredMessages[filteredMessages.length - 1];


    const currentDate = new Date();
    const systemPrompt = `You are a scheduling assistant. Today is ${currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',  // Add year to the date format
      month: 'long',
      day: 'numeric'
    })} and the current time is ${currentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })}.

    Analyze if the user's message is asking about availability. Consider the full conversation context when interpreting time references.
    IMPORTANT: When handling relative dates (like "next month" or "next week"), always consider the current year (${currentDate.getFullYear()}) and adjust the year accordingly if the date would fall into the next year.

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

    For example, if today is December 16, 2024, "Do you have any appointments next month?" would return:
    {
      "isAvailabilityQuery": true,
      "params": {
        "startDate": "2025-01-01",
        "endDate": "2025-01-31",
        "startTime": null,
        "endTime": null
      }
    }`

    const availabilityCheck = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        ...filteredMessages.slice(0, -1),
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
      const now = new Date();

      // Always use current date and time as the start
      params.startDate = now.toISOString().split('T')[0];

      if (analysis.params.startDate) {
        params.startDate = analysis.params.startDate;
      }
      if (analysis.params.startTime) {
        params.startTime = analysis.params.startTime;
      }
      if (analysis.params.endDate) {
        params.endDate = analysis.params.endDate;
      }
      if (analysis.params.endTime) {
        params.endTime = analysis.params.endTime;
      }

      console.log("Params:", params);

      const slots = await getAvailableSlots(params);

      // Handle empty slots case
      if (!slots || slots.length === 0) {
        // Ask LLM for alternative suggestions
        const alternativeSuggestionSchema = z.object({
          message: z.string(),
          alternativeQuery: z.object({
            startDate: z.string().nullable(),
            endDate: z.string().nullable(),
            startTime: z.string().nullable(),
            endTime: z.string().nullable()
          })
        });

        const alternativeSuggestion = await openai.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `No slots were found for the following parameters:
              Start Date: ${params.startDate}
              End Date: ${params.endDate || 'Not specified'}
              Start Time: ${params.startTime || 'Not specified'}
              End Time: ${params.endTime || 'Not specified'}

              Please suggest an alternative time frame to check for availability. Return a JSON response with:
              1. A friendly message explaining that no slots are available and suggesting alternatives
              2. Alternative parameters to check

              Format your response as:
              {
                "message": "Your friendly message here",
                "alternativeQuery": {
                  "startDate": "YYYY-MM-DD" or null,
                  "endDate": "YYYY-MM-DD" or null,
                  "startTime": "HH:mm" or null,
                  "endTime": "HH:mm" or null
                }
              }`
            },
            ...filteredMessages
          ],
          model: 'gpt-4o',
          response_format: zodResponseFormat(alternativeSuggestionSchema, 'alternative_suggestion'),
          temperature: 0.7,
        });

        const suggestion = JSON.parse(alternativeSuggestion.choices[0].message.content || '');

        // If alternative parameters are provided, recursively check for slots
        if (suggestion.alternativeQuery.startDate) {
          const newSlots = await getAvailableSlots(suggestion.alternativeQuery);
          return NextResponse.json({
            message: suggestion.message,
            availableSlots: newSlots
          });
        }

        // If no alternative parameters, just return the message
        return NextResponse.json({
          message: suggestion.message
        });
      }

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
          ...filteredMessages,
          {
            role: 'system',
            content: `Here are the available slots:\n${slots.map(slot =>
              `${new Date(slot.startTime).toLocaleDateString()} at ${new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Provider: ${slot.providerId})`
            ).join('\n')}\n\nPlease analyze these slots and return a JSON response with:
            1. A friendly message explaining the availability. 
            2. A curated list of recommended slots that best match the user's request. Show up to 8 available slots.
            3. Remind the user they can click the time slots shown below the chat to book.
            4. If the user has not specified a time, show the next (up to) 8 available slots.
            5. If the user has specified a time, show the next (up to) 8 available slots that match the user's request.
            6. Ultimately, use your best judgement to determine the best slots to show the user. For example, if the user says
            that they prefer a morning slot, then prefer to show morning slots.
            7. Don't say things like "Here are the available slots". Say something like "Here are some available slots" instead, 
            or "Here are some available times" instead, because you may not be showing all the available slots.

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
      messages: filteredMessages,
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
