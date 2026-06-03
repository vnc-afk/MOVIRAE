"use client";

import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface CreateGroupDialogProps {
  onCreate: (name: string, description: string) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * CreateGroupDialog - Modal for creating new group
 *
 * Responsibilities:
 * - Manage dialog open state with focus management
 * - Collect and validate group name and description
 * - Call onCreate callback with error handling
 * - Show feedback to user
 * - Accessibility: proper ARIA labels, focus traps, keyboard navigation
 *
 * Props:
 * - onCreate: Async callback when group is created
 * - isLoading: Whether creation is in progress
 * - disabled: Whether to disable the button
 */
export function CreateGroupDialog({
  onCreate,
  isLoading = false,
  disabled = false,
}: CreateGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Refs for focus management
  const nameInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Focus on name input when dialog opens
  useEffect(() => {
    if (open && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Validate form fields
  const validateForm = (name: string, description: string): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = "Group name is required";
    } else if (name.trim().length < 2) {
      errors.name = "Group name must be at least 2 characters";
    } else if (name.trim().length > 100) {
      errors.name = "Group name must be less than 100 characters";
    }

    if (!description.trim()) {
      errors.description = "Description is required";
    } else if (description.trim().length < 10) {
      errors.description = "Description must be at least 10 characters";
    } else if (description.trim().length > 500) {
      errors.description = "Description must be less than 500 characters";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleCreate = async () => {
    if (!validateForm(name, description)) {
      toast.error("Please fix the errors and try again");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(name.trim(), description.trim());
      
      // Reset form and close dialog on success
      setOpen(false);
      setName("");
      setDescription("");
      setValidationErrors({});
    } catch (err) {
      // Error handling is done in page.tsx via callbacks
      // This catch is just to ensure we stop the loading state
      console.error("Failed to create group:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle dialog close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Clear form when closing
      setName("");
      setDescription("");
      setValidationErrors({});
    }
    setOpen(newOpen);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleCreate();
    }
  };

  const isFormDisabled = isSubmitting || isLoading || disabled;
  const hasNameError = !!validationErrors.name;
  const hasDescriptionError = !!validationErrors.description;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          className="gap-2"
          disabled={disabled}
          aria-label="Create a new group"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Create Group
        </Button>
      </DialogTrigger>

      <DialogContent 
        className="sm:max-w-[425px]"
        aria-describedby="create-group-description"
      >
        <DialogHeader>
          <DialogTitle>Create a new group</DialogTitle>
          <p id="create-group-description" className="sr-only">
            Fill in the group name and description to create a new group for watching and discussing movies
          </p>
        </DialogHeader>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          onKeyDown={handleKeyDown}
          className="space-y-4 py-2"
        >
          {/* Group Name Field */}
          <div className="space-y-1.5">
            <Label htmlFor="g-name" className="flex items-center justify-between">
              <span>Group name</span>
              <span className="text-xs text-muted-foreground">
                {name.trim().length}/100
              </span>
            </Label>
            <Input
              ref={nameInputRef}
              id="g-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationErrors.name) {
                  validateForm(e.target.value, description);
                }
              }}
              placeholder="e.g., Sci-Fi Enthusiasts"
              disabled={isFormDisabled}
              maxLength={100}
              aria-invalid={hasNameError}
              aria-describedby={hasNameError ? "name-error" : undefined}
              className={hasNameError ? "border-red-500" : ""}
            />
            {hasNameError && (
              <p id="name-error" className="text-xs text-red-500">
                {validationErrors.name}
              </p>
            )}
          </div>

          {/* Group Description Field */}
          <div className="space-y-1.5">
            <Label 
              htmlFor="g-desc"
              className="flex items-center justify-between"
            >
              <span>Description</span>
              <span className="text-xs text-muted-foreground">
                {description.trim().length}/500
              </span>
            </Label>
            <Textarea
              id="g-desc"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (validationErrors.description) {
                  validateForm(name, e.target.value);
                }
              }}
              placeholder="Describe what your group is about and what movies you're interested in discussing..."
              rows={3}
              disabled={isFormDisabled}
              maxLength={500}
              aria-invalid={hasDescriptionError}
              aria-describedby={hasDescriptionError ? "desc-error" : undefined}
              className={hasDescriptionError ? "border-red-500" : ""}
            />
            {hasDescriptionError && (
              <p id="desc-error" className="text-xs text-red-500">
                {validationErrors.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isFormDisabled}
              aria-label="Cancel creating a new group"
            >
              Cancel
            </Button>
            <Button
              ref={submitButtonRef}
              type="submit"
              disabled={isFormDisabled}
              aria-busy={isSubmitting || isLoading}
              aria-label={
                isSubmitting || isLoading
                  ? "Creating group, please wait"
                  : "Create group"
              }
            >
              {isSubmitting || isLoading ? (
                <>
                  <span className="animate-spin mr-2" aria-hidden="true">⏳</span>
                  Creating...
                </>
              ) : (
                "Create Group"
              )}
            </Button>
          </DialogFooter>

          {/* Keyboard hint */}
          <p className="text-xs text-muted-foreground text-center">
            Tip: Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+Enter</kbd> to submit
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}