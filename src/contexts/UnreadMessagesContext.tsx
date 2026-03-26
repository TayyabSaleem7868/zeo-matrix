import React, { createContext, useContext } from "react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

type UnreadContextType = ReturnType<typeof useUnreadMessages>;

const UnreadContext = createContext<UnreadContextType>({
  unreadCounts: new Map<string, number>(),
  mutedConversations: new Set<string>(),
  lastIncomingMessage: null,
  unreadConversationIds: new Set<string>(),
  totalUnread: 0,
  markConversationRead: () => {},
  refreshUnread: async () => {},
});

export const UnreadMessagesProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useUnreadMessages();
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
};

export const useUnreadContext = () => useContext(UnreadContext);
