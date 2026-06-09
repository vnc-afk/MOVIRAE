import { MessageCircle } from "lucide-react";

export default function NoConversationSelected() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <MessageCircle className="h-6 w-6" />
      </div>
      <div>
        <p className="font-semibold text-foreground">No conversation selected</p>
        <p className="text-sm text-muted-foreground">
          Pick a conversation to read and reply.
        </p>
      </div>
    </div>
  );
}
