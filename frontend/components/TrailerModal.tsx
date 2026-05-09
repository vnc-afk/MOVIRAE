"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TrailerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}

export function TrailerModal({ open, onOpenChange, title }: TrailerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-card">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="font-display">{title} — Trailer</DialogTitle>
        </DialogHeader>
        <div className="aspect-video bg-foreground/5 flex items-center justify-center m-4 mt-2 rounded-lg">
          <p className="text-muted-foreground text-sm">
            Trailer player placeholder
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
