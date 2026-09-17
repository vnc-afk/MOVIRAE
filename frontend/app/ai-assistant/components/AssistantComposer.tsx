"use client";

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssistantComposerProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function AssistantComposer({ value, disabled, onChange, onSubmit }: AssistantComposerProps) {
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit(value); }} className="flex gap-2"><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="e.g. cozy winter movie with a great soundtrack" className="flex-1 rounded-full border border-border bg-secondary px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /><Button type="submit" size="icon" className="h-10 w-10 rounded-full" disabled={!value.trim() || disabled}><Send className="h-4 w-4" /></Button></form>;
}