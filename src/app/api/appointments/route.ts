import { NextResponse } from 'next/server';
import { getAvailableSlots, createAppointment, GetAvailableSlotsParams } from '@/lib/scheduling';


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
        const { providerId, clientName, clientEmail, startTime } = await request.json();

        const appointment = await createAppointment(
            providerId,
            clientName,
            clientEmail,
            new Date(startTime)
        );

        return NextResponse.json(appointment);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 400 }
        );
    }
}