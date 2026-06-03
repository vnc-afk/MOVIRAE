import React from "react";

/**
 * Container for groups page
 * Provides proper padding and layout context
 */
export function GroupsContainer({ children }: { children: React.ReactNode }) {
  return (
    <main className="pb-20 md:pb-0">
      <div className="container py-8 space-y-8">
        {children}
      </div>
    </main>
  );
}

/**
 * Header section with title and description
 * Semantically groups heading and introductory content
 */
export function GroupsHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="space-y-2">
      {children}
    </header>
  );
}

/**
 * Empty state when no groups exist
 * Shows helpful message and encourages action
 */
export function EmptyState() {
  return (
    <div 
      className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
      role="status"
      aria-label="No groups available"
    >
      <p className="font-medium mb-2">No groups yet</p>
      <p>Create one to get started with your movie community.</p>
    </div>
  );
}