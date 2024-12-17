"use client";

import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { Button } from "@/components/ui/button";
import {
  CornerDownLeft,
  Bot,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type Message } from '@/lib/openai';
import { Schedule } from "@/components/schedule";
import { Card, CardContent } from "@/components/ui/card";
import { BookingDialog } from "@/components/booking-dialog";
import { BookingConfirmationDialog } from "@/components/booking-confirmation-dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";



interface AvailableSlot {
  id: string;
  startTime: string;
  endTime: string;
  providerId: string;
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
      content: "Hi! I'm here to help you schedule an appointment with us. Just let me know what day or time works best for you, and I'll show you the available slots. When you see slots that work for you, you can click them below our chat to book."
    }
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [showAvailableSlots, setShowAvailableSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [agentThinking, setAgentThinking] = useState(false);
  const shouldStopAgentRef = useRef(false);

  const [bookingConfirmationDetails, setBookingConfirmationDetails] = useState<{
    name: string;
    email: string;
    selectedSlot: {
      date: string;
      time: string;
      providerId: string;
    };
  } | null>(null);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);

  const [isTestComplete, setIsTestComplete] = useState(false);
  const [showTestButton, setShowTestButton] = useState(true);

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

    setShowAvailableSlots(false);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    setShowTestButton(false);

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

      const chatResponse = await response.json();
      console.log("chatResponse", chatResponse);

      // Handle booking details if present
      if (chatResponse.bookingDetails) {
        setBookingConfirmationDetails(chatResponse.bookingDetails);
        setIsConfirmationDialogOpen(true);
      }

      let assistantMessage = chatResponse.message;
      if (chatResponse.availableSlots && chatResponse.availableSlots.length > 0) {
        const slotsText = chatResponse.availableSlots
          .map((slot: { startTime: string }) => {
            console.log("slot", slot);
            const [date, time] = slot.startTime.split(' ');
            const timeOnly = time.substring(0, 5);
            const [hours, minutes] = timeOnly.split(':');
            const hour = parseInt(hours, 10);
            const ampm = hour >= 12 ? 'pm' : 'am';
            const hour12 = hour % 12 || 12;
            const formattedTime = `${hour12}${minutes === '00' ? '' : ':' + minutes}${ampm}`;
            return `${formattedTime} ${new Date(date + 'T00:00:00').toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              weekday: 'short'
            })}`;
          })
          .join('\n');
        assistantMessage += '\n\nAvailable slots:\n' + slotsText;
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: assistantMessage
      }]);

      if (chatResponse.availableSlots && chatResponse.availableSlots.length > 0) {
        setAvailableSlots(chatResponse.availableSlots);
        setShowAvailableSlots(true);
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


  const handleSlotClick = async (slot: AvailableSlot) => {

    const confirmationMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `You've selected the appointment on ${new Date(slot.startTime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}. Let's proceed with your booking.`
    };

    setMessages(prev => [...prev, confirmationMessage]);

    setSelectedSlot(slot);
    setIsBookingDialogOpen(true);
  };

  const handleBookingConfirm = async (slotId: string | null, name: string, email: string, startTime: string) => {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slotId: slotId,
        clientName: name,
        clientEmail: email,
        startDateTime: startTime
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to book appointment');
    }

    // Add confirmation message to chat
    const confirmationMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Great! I've confirmed your appointment for ${new Date(startTime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}. A confirmation email will be sent to ${email}. Looking forward to seeing you!`
    };
    setMessages(prev => [...prev, confirmationMessage]);

    // Clear the booking interface
    setAvailableSlots([]);
    setSelectedSlot(null);
    setIsBookingDialogOpen(false);
  };

  const handleTestAgent = async () => {
    if (agentThinking) {
      shouldStopAgentRef.current = true;
      return;
    }

    shouldStopAgentRef.current = false;
    setAgentThinking(true);
    setIsTestComplete(false);

    try {
      let isConversationComplete = false;
      let currentMessages = messages;

      while (!isConversationComplete && !shouldStopAgentRef.current) {
        setShowAvailableSlots(false);
        setAvailableSlots([]);

        const response = await fetch('/api/test-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentMessages: currentMessages,
          }),
        });

        const data = await response.json();

        if (data.message) {
          const agentMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: data.message
          };

          currentMessages = [...currentMessages, agentMessage];
          setMessages(currentMessages);

          const chatResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: currentMessages.map(({ role, content }) => ({
                role,
                content,
              })),
            }),
          });

          const chatData = await chatResponse.json();

          // Handle booking details from test agent and stop the agent
          if (chatData.bookingDetails) {
            setBookingConfirmationDetails(chatData.bookingDetails);
            setIsConfirmationDialogOpen(true);
            break; // Stop the test agent loop
          }

          let assistantMessage = chatData.message;
          if (chatData.availableSlots && chatData.availableSlots.length > 0) {
            const slotsText = chatData.availableSlots
              .map((slot: { startTime: string }) => {
                const [date, time] = slot.startTime.split(' ');
                const timeOnly = time.substring(0, 5);
                const [hours, minutes] = timeOnly.split(':');
                const hour = parseInt(hours, 10);
                const ampm = hour >= 12 ? 'pm' : 'am';
                const hour12 = hour % 12 || 12;
                const formattedTime = `${hour12}${minutes === '00' ? '' : ':' + minutes}${ampm}`;
                return `${formattedTime} ${new Date(date + 'T00:00:00').toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  weekday: 'short'
                })}`;
              })
              .join('\n');
            assistantMessage += '\n\nAvailable slots:\n' + slotsText;

            setAvailableSlots(chatData.availableSlots);
            setShowAvailableSlots(true);
          }

          const assistantMessageObj: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: assistantMessage
          };

          currentMessages = [...currentMessages, assistantMessageObj];
          setMessages(currentMessages);

          isConversationComplete = data.isConversationComplete;

          if (isConversationComplete) {
            setIsTestComplete(true);
            const completionMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: "✨ Test agent workflow completed! You can now interact with the chat normally."
            };
            currentMessages = [...currentMessages, completionMessage];
            setMessages(currentMessages);
          }

          if (!shouldStopAgentRef.current) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    } catch (error) {
      console.error('Error with test agent:', error);
    } finally {
      setAgentThinking(false);
      shouldStopAgentRef.current = false;
    }
  };

  const testAgentButtonText = agentThinking ? "Stop Agent" : "Test Agent";

  const handleBookingConfirmation = async () => {
    if (!bookingConfirmationDetails) return;

    const { name, email, selectedSlot } = bookingConfirmationDetails;
    console.log("selectedSlot date", selectedSlot.date);
    console.log("selectedSlot time", selectedSlot.time);
    const twentyFourHourTime = selectedSlot.time.replace(/(\d{2}:\d{2}) (AM|PM)/, (match, time, period) => {
      const [hours, minutes] = time.split(':');
      const hour24 = period === 'AM' ? hours : parseInt(hours, 10) + 12;
      return `${hour24.toString().padStart(2, '0')}:${minutes}`;
    });
    const startTime = selectedSlot.date + " " + twentyFourHourTime;

    try {
      await handleBookingConfirm(
        null,
        name,
        email,
        startTime
      );
      setIsConfirmationDialogOpen(false);
      setBookingConfirmationDetails(null);
    } catch (error) {
      console.error('Error confirming booking:', error);
    }
  };

  return (
    <main className="flex flex-col items-center w-full max-w-6xl mx-auto py-2 px-4 gap-4">
      {/* Add the theme toggle button */}
      <div className="w-full flex justify-end gap-2">
        {showTestButton && (
          <Button
            onClick={handleTestAgent}
            className={isTestComplete ? "bg-green-500 hover:bg-green-600" : ""}
          >
            {isTestComplete ? "Test Complete" : testAgentButtonText}
            <Bot className="ml-2 size-4" />
          </Button>
        )}
        <ThemeToggle />
      </div>

      {/* Chat Section */}
      <div className="w-full min-h-[500px] max-h-[900px] h-[90vh] flex flex-col overflow-hidden">
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
                          index === messages.length - 1 &&
                          availableSlots.length > 0 &&
                          showAvailableSlots && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {availableSlots.map((slot, idx) => {
                                console.log("slot", slot);
                                const [date, time] = slot.startTime.split(' ');
                                console.log("date", date);
                                const [hours, minutes] = time.split(':');
                                const slotDate = new Date(date + 'T00:00:00');
                                console.log("slotDate", slotDate);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => handleSlotClick(slot)}
                                    className="px-4 py-2 text-sm bg-primary/10 hover:bg-primary/20 rounded-full transition-colors"
                                  >
                                    {(() => {
                                      const hour = parseInt(hours, 10);
                                      const ampm = hour >= 12 ? 'PM' : 'AM';
                                      const hour12 = hour % 12 || 12;
                                      return `${hour12}:${minutes} ${ampm}, ${slotDate.toLocaleDateString([], {
                                        month: 'short',
                                        day: 'numeric'
                                      })} (${slotDate.toLocaleDateString([], {
                                        weekday: 'short'
                                      })})`
                                    })()}
                                  </button>
                                );
                              })}
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

      {selectedSlot && (
        <BookingDialog
          isOpen={isBookingDialogOpen}
          onClose={() => setIsBookingDialogOpen(false)}
          onConfirm={handleBookingConfirm}
          slot={selectedSlot}
        />
      )}

      {bookingConfirmationDetails && (
        <BookingConfirmationDialog
          isOpen={isConfirmationDialogOpen}
          onClose={() => setIsConfirmationDialogOpen(false)}
          onConfirm={handleBookingConfirmation}
          bookingDetails={bookingConfirmationDetails}
        />
      )}
    </main>
  );
}
