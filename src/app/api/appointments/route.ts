import { NextResponse } from 'next/server';
import { getAvailableSlots, createAppointment, GetAvailableSlotsParams } from '@/lib/scheduling';
import { format } from 'date-fns';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const startTime = searchParams.get('startTime'); // Format: "HH:mm"
    const endTime = searchParams.get('endTime');     // Format: "HH:mm"

    const params: GetAvailableSlotsParams = {};

    if (providerId) {
        params.providerId = providerId;
    }

    if (startDate) {
        params.startDate = startDate.split('T')[0];
    }

    if (endDate) {
        params.endDate = endDate.split('T')[0];
    }

    if (startTime) {
        params.startTime = startTime;
    }

    if (endTime) {
        params.endTime = endTime;
    }

    const slots = await getAvailableSlots(params);
    return NextResponse.json({ slots });
}

export async function POST(request: Request) {
    try {
        const { slotId, clientName, clientEmail } = await request.json();

        // Get the slot first to verify it exists and is available
        const slot = await prisma.slot.findUnique({
            where: { id: slotId },
            include: { provider: true }
        });

        if (!slot) {
            return NextResponse.json(
                { error: 'Slot not found' },
                { status: 404 }
            );
        }

        if (!slot.isAvailable || slot.appointmentId) {
            return NextResponse.json(
                { error: 'Slot is not available' },
                { status: 400 }
            );
        }

        // Create the appointment and update the slot in a transaction
        const appointment = await prisma.$transaction(async (tx) => {
            const appointment = await tx.appointment.create({
                data: {
                    providerId: slot.providerId,
                    clientName,
                    clientEmail,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                }
            });

            // Update the slot to mark it as unavailable
            await tx.slot.update({
                where: { id: slotId },
                data: {
                    isAvailable: false,
                    appointmentId: appointment.id
                }
            });

            return appointment;
        });

        return NextResponse.json(appointment);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 400 }
        );
    }
}