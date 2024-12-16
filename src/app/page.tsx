"use client";

import {
  ChatBubble,
  ChatBubbleAction,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { Button } from "@/components/ui/button";
import {
  CopyIcon,
  CornerDownLeft,
  Mic,
  Paperclip,
  RefreshCcw,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeDisplayBlock from "@/components/code-display-block";
import { openai, type Message } from '@/lib/openai';
import { Schedule } from "@/components/schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ChatAiIcons = [
  {
    icon: CopyIcon,
    label: "Copy",
  },
  {
    icon: RefreshCcw,
    label: "Refresh",
  },
  {
    icon: Volume2,
    label: "Volume",
  },
];

interface AvailableSlot {
  startTime: Date;
  endTime: Date;
  providerId: string;
}

interface ChatResponse {
  message: string;
  availableSlots?: AvailableSlot[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'system-1',
      role: 'system',
      content: `You are an AI appointment scheduling assistant. Your primary function is to help users schedule appointments.
      - Only respond to queries about availability and booking appointments
      - For other queries, politely explain that you can only help with appointment scheduling
      - When discussing availability, use the /api/appointments endpoint to check available slots
      - When showing available slots, remind users they can click the time slots shown below the chat to book
      - When a user wants to book, collect their name and email
      - Keep responses concise and focused on scheduling
      - Format dates in a clear, readable way
      - Today's date is ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`
    },
    {
      id: 'welcome-1',
      role: 'assistant',
      content: "Hi! I'm here to help you schedule an appointment with Drillbit. Just let me know what day or time works best for you, and I'll show you the available slots. When you see slots that work for you, you can click them below our chat to book."
    }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    setAvailableSlots([]);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.concat(userMessage).map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      const chatResponse: ChatResponse = await response.json();

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: chatResponse.message
      }]);

      if (chatResponse.availableSlots && chatResponse.availableSlots.length > 0) {
        setAvailableSlots(chatResponse.availableSlots);
      }
    } catch (error) {
      console.error('Error calling chat API:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isGenerating || !input) return;
      formRef.current?.requestSubmit();
    }
  };

  const handleActionClick = async (action: string, messageIndex: number) => {
    if (action === "Copy") {
      const message = messages[messageIndex];
      if (message && message.role === "assistant") {
        navigator.clipboard.writeText(message.content);
      }
    }
  };

  const handleSlotClick = async (slot: AvailableSlot) => {
    console.log('Slot selected:', slot);
  };

  return (
    <main className="flex flex-col items-center w-full max-w-6xl mx-auto py-6 px-4 gap-12">
      {/* Chat Section */}
      <div className="w-full h-[900px] flex flex-col overflow-hidden">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
            <ChatMessageList ref={messagesRef} className="flex-1 overflow-y-auto">
              {/* Messages */}
              {messages &&
                messages.map((message, index) => (
                  message.role !== 'system' && (
                    <ChatBubble
                      key={index}
                      variant={message.role === "user" ? "sent" : "received"}
                    >
                      <ChatBubbleAvatar
                        src={message.role === "user" ? "" : "/favicon-32x32.png"}
                        fallback={message.role === "user" ? "👨🏽" : ""}
                      />
                      <ChatBubbleMessage>
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </Markdown>
                        {message.role === "assistant" &&
                          messages.length - 1 === index && (
                            <div className="flex items-center mt-1.5 gap-1">
                              {!isGenerating && (
                                <>
                                  {ChatAiIcons.map((icon, iconIndex) => {
                                    const Icon = icon.icon;
                                    return (
                                      <ChatBubbleAction
                                        variant="outline"
                                        className="size-5"
                                        key={iconIndex}
                                        icon={<Icon className="size-3" />}
                                        onClick={() =>
                                          handleActionClick(icon.label, index)
                                        }
                                      />
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          )}
                      </ChatBubbleMessage>
                    </ChatBubble>
                  )
                ))}

              {/* Loading */}
              {isGenerating && (
                <ChatBubble variant="received">
                  <ChatBubbleAvatar src="/favicon-32x32.png" fallback="" />
                  <ChatBubbleMessage isLoading />
                </ChatBubble>
              )}
            </ChatMessageList>

            {/* Available Slots Section */}
            {availableSlots.length > 0 && (
              <div className="py-4 border-t">
                <h3 className="text-sm font-medium mb-2">Book an appointment</h3>
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => handleSlotClick(slot)}
                      className="px-4 py-2 text-sm bg-primary/10 hover:bg-primary/20 rounded-full transition-colors"
                    >
                      {new Date(slot.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                      {' '}
                      {new Date(slot.startTime).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="w-full">
              <form
                ref={formRef}
                onSubmit={onSubmit}
                className="relative rounded-lg border bg-background focus-within:ring-1 focus-within:ring-ring"
              >
                <ChatInput
                  value={input}
                  onKeyDown={onKeyDown}
                  onChange={handleInputChange}
                  placeholder="Type your message here..."
                  className="min-h-12 resize-none rounded-lg bg-background border-0 p-3 shadow-none focus-visible:ring-0"
                />
                <div className="flex items-center p-3 pt-0">
                  <Button variant="ghost" size="icon">
                    <Paperclip className="size-4" />
                    <span className="sr-only">Attach file</span>
                  </Button>

                  <Button variant="ghost" size="icon">
                    <Mic className="size-4" />
                    <span className="sr-only">Use Microphone</span>
                  </Button>

                  <Button
                    disabled={!input || isGenerating}
                    type="submit"
                    size="sm"
                    className="ml-auto gap-1.5"
                  >
                    Send Message
                    <CornerDownLeft className="size-3.5" />
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Section */}
      <Schedule />
    </main>
  );
}
