import { Bell, Check, MessageCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NotificationsTab } from "../hooks/useNotificationsUrlState";

interface NotificationsHeaderProps {
  activeTab: NotificationsTab;
  unreadAlertCount: number;
  unreadMessageCount: number;
  onTabChange: (value: NotificationsTab) => void;
  onMarkAllRead: () => void;
}

export default function NotificationsHeader({
  activeTab,
  unreadAlertCount,
  unreadMessageCount,
  onTabChange,
  onMarkAllRead,
}: NotificationsHeaderProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">
            Notifications
          </h1>
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Check className="h-3.5 w-3.5" /> Mark all read
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as NotificationsTab)}>
        <TabsList className="bg-secondary grid w-full grid-cols-2 gap-0">
            <TabsTrigger value="notifications" className="gap-1.5 text-xs sm:text-sm">
            <Bell className="h-3.5 w-3.5" /> Alerts
            {unreadAlertCount > 0 && (
              <span className="ml-1 h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {unreadAlertCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5 text-xs sm:text-sm">
            <MessageCircle className="h-3.5 w-3.5" /> Messages
            {unreadMessageCount > 0 && (
              <span className="ml-1 h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                {unreadMessageCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
