"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, isBefore, isAfter } from "date-fns";

interface TimeSlot {
    time: string;
    available: boolean;
}

export function Schedule() {
    const [currentWeekStart, setCurrentWeekStart] = useState(() =>
        startOfWeek(new Date(), { weekStartsOn: 1 })
    );
    const [availableSlots, setAvailableSlots] = useState<Record<string, TimeSlot[]>>({});
    const [isLoading, setIsLoading] = useState(false);

    const now = new Date();
    const maxDate = addWeeks(now, 3);

    useEffect(() => {
        async function fetchAvailability() {
            setIsLoading(true);
            try {
                const endDate = addDays(currentWeekStart, 4);
                const response = await fetch(
                    `/api/appointments?startDate=${currentWeekStart.toISOString()}&endDate=${endDate.toISOString()}`
                );
                const data = await response.json();

                // Organize slots by date
                const slotsByDate: Record<string, TimeSlot[]> = {};
                data.slots.forEach((slot: any) => {
                    const date = format(new Date(slot.startTime), 'yyyy-MM-dd');
                    if (!slotsByDate[date]) {
                        slotsByDate[date] = [];
                    }
                    slotsByDate[date].push({
                        time: format(new Date(slot.startTime), 'HH:mm'),
                        available: slot.isAvailable
                    });
                });
                setAvailableSlots(slotsByDate);
            } catch (error) {
                console.error('Error fetching availability:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchAvailability();
    }, [currentWeekStart]);

    const navigateWeek = (direction: 'prev' | 'next') => {
        setCurrentWeekStart(current => {
            const newDate = direction === 'next'
                ? addWeeks(current, 1)
                : addWeeks(current, -1);

            // Prevent navigation before current week or after 4 weeks
            if (isBefore(newDate, startOfWeek(now, { weekStartsOn: 1 })) ||
                isAfter(newDate, maxDate)) {
                return current;
            }
            return newDate;
        });
    };

    // Generate week days
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(currentWeekStart, i);
        return date;
    });

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>Schedule</CardTitle>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigateWeek('prev')}
                        disabled={isBefore(addWeeks(currentWeekStart, -1), startOfWeek(now, { weekStartsOn: 1 }))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigateWeek('next')}
                        disabled={isAfter(addWeeks(currentWeekStart, 1), maxDate)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        Loading...
                    </div>
                ) : (
                    <div className="grid grid-cols-7 gap-4">
                        {weekDays.map((date) => (
                            <div key={date.toISOString()} className="space-y-2">
                                <div className="text-center font-medium">
                                    {format(date, 'EEE')}
                                    <div className="text-sm text-muted-foreground">
                                        {format(date, 'MMM d')}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {availableSlots[format(date, 'yyyy-MM-dd')]?.map((slot) => (
                                        <Button
                                            key={`${date.toISOString()}-${slot.time}`}
                                            variant={slot.available ? "outline" : "ghost"}
                                            className="w-full"
                                            disabled={!slot.available}
                                        >
                                            {slot.time}
                                        </Button>
                                    )) || <div>No available slots</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}