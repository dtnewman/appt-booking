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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'system-1',
      role: 'system',
      content: `You are an AI appointment scheduling assistant. Your primary function is to help users schedule appointments.
      - Only respond to queries about availability and booking appointments
      - For other queries, politely explain that you can only help with appointment scheduling
      - When discussing availability, use the /api/appointments endpoint to check available slots
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
      content: "Hi! I'm here to help you book an appointment with Drillbit. Would you like to schedule something?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

      const assistantMessage = await response.json();

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: assistantMessage.content
      }]);
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

  return (
    <main className="flex flex-col items-center w-full max-w-6xl mx-auto py-6 px-4 gap-12">
      {/* Chat Section */}
      <div className="w-full h-[600px] flex flex-col overflow-hidden">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
            <ChatMessageList ref={messagesRef} className="flex-1 overflow-y-auto">
              {/* Initial Message */}
              {messages.length === 0 && (
                <div className="w-full bg-background shadow-sm border rounded-lg p-8 flex flex-col gap-2">
                  <h1 className="font-bold">Welcome to this example app.</h1>
                  <p className="text-muted-foreground text-sm">
                    This is a simple Next.JS example application created using{" "}
                    <a
                      href="https://github.com/jakobhoeg/shadcn-chat"
                      className="font-bold inline-flex flex-1 justify-center gap-1 leading-4 hover:underline"
                    >
                      shadcn-chat
                      <svg
                        aria-hidden="true"
                        height="7"
                        viewBox="0 0 6 6"
                        width="7"
                        className="opacity-70"
                      >
                        <path
                          d="M1.25215 5.54731L0.622742 4.9179L3.78169 1.75597H1.3834L1.38936 0.890915H5.27615V4.78069H4.40513L4.41109 2.38538L1.25215 5.54731Z"
                          fill="currentColor"
                        ></path>
                      </svg>
                    </a>{" "}
                    components. It uses{" "}
                    <a
                      href="https://sdk.vercel.ai/"
                      className="font-bold inline-flex flex-1 justify-center gap-1 leading-4 hover:underline"
                    >
                      Vercel AI SDK
                      <svg
                        aria-hidden="true"
                        height="7"
                        viewBox="0 0 6 6"
                        width="7"
                        className="opacity-70"
                      >
                        <path
                          d="M1.25215 5.54731L0.622742 4.9179L3.78169 1.75597H1.3834L1.38936 0.890915H5.27615V4.78069H4.40513L4.41109 2.38538L1.25215 5.54731Z"
                          fill="currentColor"
                        ></path>
                      </svg>
                    </a>{" "}
                    for the AI integration. Build chat interfaces like this at
                    lightspeed with shadcn-chat.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Make sure to also checkout the shadcn-chat support component at
                    the bottom right corner.
                  </p>
                </div>
              )}

              {/* Messages */}
              {messages &&
                messages.map((message, index) => (
                  message.role !== 'system' && (
                    <ChatBubble
                      key={index}
                      variant={message.role == "user" ? "sent" : "received"}
                    >
                      <ChatBubbleAvatar
                        src="/favicon-32x32.png"
                        fallback={message.role == "user" ? "👨🏽" : ""}
                      />
                      <ChatBubbleMessage
                      >
                        {message.content
                          .split("```")
                          .map((part: string, index: number) => {
                            if (index % 2 === 0) {
                              return (
                                <Markdown key={index} remarkPlugins={[remarkGfm]}>
                                  {part}
                                </Markdown>
                              );
                            } else {
                              return (
                                <pre className="whitespace-pre-wrap pt-2" key={index}>
                                  <CodeDisplayBlock code={part} lang="" />
                                </pre>
                              );
                            }
                          })}

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
