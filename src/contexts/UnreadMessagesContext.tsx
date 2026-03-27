import React, { createContext, useContext } from "react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface UnreadContextType {
  unreadCounts: Map<string, number>;
  mutedConversations: Set<string>;
  lastIncomingMessage: any;
  unreadConversationIds: Set<string>;
  totalUnread: number;
  activeConvId: string | null;
  setActiveConvId: (id: string | null) => void;
  markConversationRead: (conversationId: string) => void;
  refreshUnread: () => Promise<void>;
}

const UnreadContext = createContext<UnreadContextType>({
  unreadCounts: new Map<string, number>(),
  mutedConversations: new Set<string>(),
  lastIncomingMessage: null,
  unreadConversationIds: new Set<string>(),
  totalUnread: 0,
  activeConvId: null,
  setActiveConvId: () => {},
  markConversationRead: () => {},
  refreshUnread: async () => {},
});

export const UnreadMessagesProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useUnreadMessages();
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
};

export const useUnreadContext = () => useContext(UnreadContext);
