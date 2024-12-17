
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
    const formattedDateTime = format(
        new Date(`${bookingDetails.selectedSlot.date}T${bookingDetails.selectedSlot.time}`),
        "EEEE, MMMM d, yyyy 'at' h:mm a"
    );

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