import OpenAI from 'openai';

export const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // Only if you're calling OpenAI directly from the browser
});

export type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}; 