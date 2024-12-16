import OpenAI from 'openai';

export const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY
});

export interface Message {
    id: string;
    role: 'system' | 'user' | 'assistant' | 'slots';
    content: string;
    slots?: AvailableSlot[];
}

interface AvailableSlot {
    startTime: Date;
    endTime: Date;
    providerId: string;
} 