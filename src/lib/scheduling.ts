import prisma from './prisma';
import { addDays, setHours, setMinutes, startOfDay, endOfDay, format, parse } from 'date-fns';

export interface GetAvailableSlotsParams {
    providerId?: string;
    startDate?: string; // Format: "YYYY-MM-DD"
    endDate?: string;   // Format: "YYYY-MM-DD"
    startTime?: string; // Format: "HH:mm"
    endTime?: string;   // Format: "HH:mm"
}

export async function getAvailableSlots({
    providerId,
    startDate,
    endDate,
    startTime,
    endTime,
}: GetAvailableSlotsParams = {}) {
    // Format current date/time as string for comparison
    const now = format(new Date(), 'yyyy-MM-dd HH:mm');

    // Build the where clause dynamically
    const where: any = {
        isAvailable: true,
        appointmentId: null, // Only get slots without appointments
        startTime: {
            gte: now, // Compare with string format
        },
    };

    if (providerId) {
        where.providerId = providerId;
    }

    // Handle date range filtering
    if (startDate || endDate) {
        if (startDate) {
            const startDateTime = `${startDate} 00:00`;
            if (startDateTime > now) {
                where.startTime.gte = startDateTime;
            }
        }
        if (endDate) {
            where.startTime.lte = `${endDate} 23:59`;
        }
    }

    // Get all available slots
    const slots = await prisma.slot.findMany({
        where,
        orderBy: {
            startTime: 'asc',
        },
        include: {
            provider: true,
        },
    });

    // Filter by time of day if specified
    if (startTime || endTime) {
        return slots.filter(slot => {
            const slotTime = format(slot.startTime, 'HH:mm');

            if (startTime && slotTime < startTime) {
                return false;
            }
            if (endTime && slotTime > endTime) {
                return false;
            }
            return true;
        });
    }

    return slots;
}

export async function createAppointment(
    providerId: string,
    clientName: string,
    clientEmail: string,
    startTime: string // Changed to accept string
) {
    // Calculate end time (30 days after start)
    const startDate = parse(startTime, 'yyyy-MM-dd HH:mm', new Date());
    const endTime = format(addDays(startDate, 30), 'yyyy-MM-dd HH:mm');

    // Check if slot is available
    const conflictingAppointment = await prisma.appointment.findFirst({
        where: {
            providerId,
            status: 'SCHEDULED',
            OR: [
                {
                    startTime: {
                        lte: startTime,
                        gte: endTime,
                    },
                },
                {
                    endTime: {
                        gte: startTime,
                        lte: endTime,
                    },
                },
            ],
        },
    });

    if (conflictingAppointment) {
        throw new Error('Time slot is not available');
    }

    return prisma.appointment.create({
        data: {
            providerId,
            clientName,
            clientEmail,
            startTime,
            endTime,
        },
    });
}