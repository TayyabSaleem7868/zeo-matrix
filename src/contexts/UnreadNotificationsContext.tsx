import React, { createContext, useContext, ReactNode } from "react";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

interface UnreadNotificationsContextType {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
}

const UnreadNotificationsContext = createContext<UnreadNotificationsContextType>({
  unreadCount: 0,
  refreshUnread: async () => {},
});

export const UnreadNotificationsProvider = ({ children }: { children: ReactNode }) => {
  const unreadData = useUnreadNotifications();

  return (
    <UnreadNotificationsContext.Provider value={unreadData}>
      {children}
    </UnreadNotificationsContext.Provider>
  );
};

export const useUnreadNotificationsContext = () => {
  const context = useContext(UnreadNotificationsContext);
  if (context === undefined) {
    throw new Error("useUnreadNotificationsContext must be used within an UnreadNotificationsProvider");
  }
  return context;
};
