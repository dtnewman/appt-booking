import prisma from './prisma';
import { addDays, setHours, setMinutes, startOfDay, endOfDay } from 'date-fns';

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
    // Build the where clause dynamically
    const where: any = {
        isAvailable: true,
        appointmentId: null, // Only get slots without appointments
    };

    if (providerId) {
        where.providerId = providerId;
    }

    // Handle date range filtering


    if (startDate || endDate) {
        where.startTime = {};
        if (startDate) {
            where.startTime.gte = new Date(startDate + 'T00:00:00.000Z');
        }
        if (endDate) {
            where.startTime.lte = new Date(endDate + 'T23:59:59.999Z');
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
            const slotHour = slot.startTime.getHours();
            const slotMinutes = slot.startTime.getMinutes();
            const slotTimeString = `${slotHour.toString().padStart(2, '0')}:${slotMinutes.toString().padStart(2, '0')}`;

            if (startTime && slotTimeString < startTime) {
                return false;
            }
            if (endTime && slotTimeString > endTime) {
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
    startTime: Date
) {
    const endTime = addDays(startTime, 30);

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