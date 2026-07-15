import React from "react";

/**
 * Wraps the groups experience in the shared page layout spacing.
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
 * Renders the shared header area for the groups pages.
 */
export function GroupsHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="space-y-2">
      {children}
    </header>
  );
}


/**
 * Displays the empty state when no groups are available yet.
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