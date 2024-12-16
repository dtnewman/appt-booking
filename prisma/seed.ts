import { PrismaClient } from '@prisma/client';
import { setHours, setMinutes, addDays, startOfToday } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
    // Clear all existing data
    await prisma.appointment.deleteMany();
    await prisma.slot.deleteMany();
    await prisma.provider.deleteMany();

    // Create a sample provider
    const provider = await prisma.provider.create({
        data: {
            name: 'Dan the Builder',
            slots: {
                create: generateAvailabilityForNextFourWeeks(),
            },
        },
    });

    console.log('Seed data created:', provider);
}

function generateAvailabilityForNextFourWeeks() {
    const slots = [];
    const today = startOfToday();

    // Generate slots for the next 28 days
    for (let i = 0; i < 28; i++) {
        const currentDate = addDays(today, i);
        const dayOfWeek = currentDate.getDay();

        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        // Randomly decide if there's availability on this day (50% chance)
        if (Math.random() < 0.5) {
            // Generate 1-4 slots for this day
            const numberOfSlots = 1 + Math.floor(Math.random() * 4);

            for (let slot = 0; slot < numberOfSlots; slot++) {
                // Random start time between 8 AM and 6 PM
                const startHour = 8 + Math.floor(Math.random() * 10);
                // Random duration between 1 and 3 hours
                const duration = 1 + Math.floor(Math.random() * 2);

                slots.push({
                    startTime: setHours(setMinutes(currentDate, 0), startHour),
                    endTime: setHours(setMinutes(currentDate, 0), startHour + duration),
                    isAvailable: true,
                });
            }
        }
    }

    // Sort slots by startTime to ensure chronological order
    return slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });