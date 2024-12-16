import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

interface BookingDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (name: string, email: string) => Promise<void>;
    slot: {
        id: string;
        startTime: Date;
        endTime: Date;
        providerId: string;
    };
}

export function BookingDialog({ isOpen, onClose, onConfirm, slot }: BookingDialogProps) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !email) {
            toast.error("Please fill in all fields");
            return;
        }

        setIsSubmitting(true);
        try {
            await onConfirm(name, email);
            toast.success("Appointment booked successfully!");
            onClose();
        } catch (error) {
            toast.error("Failed to book appointment");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirm Booking</DialogTitle>
                    <DialogDescription>
                        Please confirm your appointment for{" "}
                        {format(slot.startTime, "EEEE, MMMM d, yyyy 'at' h:mm a")}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your name"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Booking..." : "Confirm Booking"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
} 