import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface BookingConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    bookingDetails: {
        name: string;
        email: string;
        selectedSlot: {
            date: string;
            time: string;
        };
    };
}

export function BookingConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    bookingDetails
}: BookingConfirmationDialogProps) {
    console.log("bookingDetails", bookingDetails);

    const formatTimeToISO = (time: string) => {
        // Handle both "HH:mm" and "hh:mm AM/PM" formats
        if (time.includes(' ')) {
            // Handle "hh:mm AM/PM" format
            const [rawTime, period] = time.split(' ');
            const [hours, minutes] = rawTime.split(':');
            const hour24 = period === 'PM' ?
                (parseInt(hours) === 12 ? 12 : parseInt(hours) + 12) :
                (parseInt(hours) === 12 ? 0 : parseInt(hours));
            return `${hour24.toString().padStart(2, '0')}:${minutes}`;
        } else {
            // Already in 24-hour format
            return time;
        }
    };

    const formattedDateTime = (() => {
        try {
            const date = bookingDetails.selectedSlot.date;
            console.log("Date", date);
            const time = formatTimeToISO(bookingDetails.selectedSlot.time);
            console.log("Time", time);

            // Ensure date is in YYYY-MM-DD format
            const formattedDate = date.match(/^\d{4}-\d{2}-\d{2}$/)
                ? date
                : new Date(date).toISOString().split('T')[0];

            const dateTimeString = `${formattedDate}T${time}:00`;
            return format(new Date(dateTimeString), "EEEE, MMMM d, yyyy 'at' h:mm a");
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid date/time';
        }
    })();

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirm Your Appointment</DialogTitle>
                    <DialogDescription>
                        Please confirm the following appointment details:
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <p><strong>Name:</strong> {bookingDetails.name}</p>
                        <p><strong>Email:</strong> {bookingDetails.email}</p>
                        <p><strong>Date & Time:</strong> {formattedDateTime}</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={onConfirm}>
                        Confirm Booking
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}