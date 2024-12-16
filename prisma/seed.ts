import { PrismaClient } from '@prisma/client';
import { setHours, setMinutes, addDays, startOfToday, format } from 'date-fns';

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
    const slots = new Set();
    const today = startOfToday();

    // Generate slots for the next 12 weeks
    for (let i = 0; i < (7 * 12); i++) {
        const currentDate = addDays(today, i);
        const dayOfWeek = currentDate.getDay();

        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        // Randomly decide if there's availability on this day (50% chance)
        if (Math.random() < 0.5) {
            // Create an array of possible start hours (8 AM to 6 PM)
            const possibleHours = Array.from({ length: 10 }, (_, i) => i + 8);
            // Shuffle the hours array
            const shuffledHours = possibleHours.sort(() => Math.random() - 0.5);

            // Generate 1-4 slots for this day
            const numberOfSlots = 1 + Math.floor(Math.random() * 4);

            for (let slot = 0; slot < numberOfSlots && shuffledHours.length > 0; slot++) {
                // Take the next available hour from our shuffled array
                const startHour = shuffledHours.pop();
                if (startHour === undefined) continue;  // Skip if no hours left

                // Random duration between 1 and 3 hours
                const duration = 1 + Math.floor(Math.random() * 2);

                const startTime = setHours(setMinutes(currentDate, 0), startHour);
                const endTime = setHours(setMinutes(currentDate, 0), startHour + duration);

                // Create a unique identifier for the time slot
                const timeSlot = {
                    startTime: format(startTime, 'yyyy-MM-dd HH:mm'),
                    endTime: format(endTime, 'yyyy-MM-dd HH:mm'),
                    isAvailable: true,
                };

                slots.add(JSON.stringify(timeSlot));
            }
        }
    }

    // Convert back to array of objects and sort
    return Array.from(slots)
        .map(slot => JSON.parse(slot as string) as { startTime: string; endTime: string; isAvailable: boolean })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });