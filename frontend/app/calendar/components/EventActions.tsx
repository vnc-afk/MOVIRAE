"use client";

import { Bell, BellOff, Check, Plus } from "lucide-react";

interface EventActionsProps {
  hasReminder: boolean;
  isPlanned: boolean;
  onReminder: () => void;
  onPlanned: () => void;
}

export function EventActions({ hasReminder, isPlanned, onReminder, onPlanned }: EventActionsProps) {
  return (
    <div className="flex gap-1">
      <button type="button" title={hasReminder ? "Remove reminder" : "Set reminder"} aria-label={hasReminder ? "Remove reminder" : "Set reminder"} onClick={onReminder} className={`rounded-full p-2 transition-colors ${hasReminder ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
        {hasReminder ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </button>
      <button type="button" title={isPlanned ? "Remove from watch plan" : "Add to watch plan"} aria-label={isPlanned ? "Remove from watch plan" : "Add to watch plan"} onClick={onPlanned} className={`rounded-full p-2 transition-colors ${isPlanned ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
        {isPlanned ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>
    </div>
  );
}