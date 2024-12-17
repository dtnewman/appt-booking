import { NextResponse } from 'next/server';
import { getAvailableSlots, createAppointment, GetAvailableSlotsParams } from '@/lib/scheduling';
import { format } from 'date-fns';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';


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

        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
            from: 'no-reply@tasknode.dev',  // just using a placeholder for an account i'm already verified with
            to: appointment.clientEmail,
            subject: 'Appointment Confirmation',
            html: `
                <h2>Your Appointment is Confirmed</h2>
                <p>Dear ${appointment.clientName},</p>
                <p>Your appointment has been successfully scheduled.</p>
                
                <h3>Appointment Details:</h3>
                <ul>
                    <li><strong>Date:</strong> ${new Date(appointment.startTime).toLocaleDateString()}</li>
                    <li><strong>Time:</strong> ${new Date(appointment.startTime).toLocaleTimeString()}</li>
                </ul>
                
                <p>If you need to make any changes to your appointment, please contact us.</p>
                
                <p>Thank you for choosing our services!</p>
                
                <p>Best regards,<br>
                Drillbit</p>
            `,
        });

        return NextResponse.json(appointment);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 400 }
        );
    }
}