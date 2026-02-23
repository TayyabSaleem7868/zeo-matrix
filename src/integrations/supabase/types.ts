export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {


  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      conversation_members: {
        Row: {
          conversation_id: string
          user_id: string
          role: string
          joined_at: string
        }
        Insert: {
          conversation_id: string
          user_id: string
          role?: string
          joined_at?: string
        }
        Update: {
          conversation_id?: string
          user_id?: string
          role?: string
          joined_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          last_message_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
        }
        Relationships: []
      }
      comment_spam_warnings: {
        Row: {
          comment_id: string | null
          created_at: string
          details: string | null
          id: string
          post_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string | null
          reason?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          status: string
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          comment_id: string | null
          created_at: string
          follow_request_id: string | null
          id: string
          is_read: boolean
          message?: string | null
          post_id: string | null
          reply_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          follow_request_id?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          post_id?: string | null
          reply_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          comment_id?: string | null
          created_at?: string
          follow_request_id?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          post_id?: string | null
          reply_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_banned?: boolean | null
          is_private?: boolean | null
          is_verified?: boolean | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_banned?: boolean | null
          is_private?: boolean | null
          is_verified?: boolean | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_banned?: boolean | null
          is_verified?: boolean | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      spammer_flags: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          last_warning_at: string | null
          status: string
          updated_at: string
          user_id: string
          warnings_count: number
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          last_warning_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          warnings_count?: number
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          last_warning_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          warnings_count?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string | null
          content: string
          created_at: string
          edited_at: string | null
          is_deleted: boolean
          reply_to_message_id: string | null
          deleted_for_user_ids: string[]
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id?: string | null
          content?: string
          created_at?: string
          edited_at?: string | null
          is_deleted?: boolean
          reply_to_message_id?: string | null
          deleted_for_user_ids?: string[]
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string | null
          content?: string
          created_at?: string
          edited_at?: string | null
          is_deleted?: boolean
          reply_to_message_id?: string | null
          deleted_for_user_ids?: string[]
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: []
      }
      message_user_state: {
        Row: {
          conversation_id: string
          user_id: string
          cleared_at: string | null
        }
        Insert: {
          conversation_id: string
          user_id: string
          cleared_at?: string | null
        }
        Update: {
          conversation_id?: string
          user_id?: string
          cleared_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_or_create_dm: {
        Args: { p_other_user_id: string }
        Returns: string
      }
      notify_post_mentions: {
        Args: { p_post_id: string; p_actor_id: string; p_usernames: string[] }
        Returns: undefined
      }
      create_notification: {
        Args: {
          p_user_id: string
          p_actor_id: string | null
          p_type: string
          p_message?: string | null
          p_post_id?: string | null
          p_comment_id?: string | null
          p_reply_id?: string | null
          p_follow_request_id?: string | null
        }
        Returns: undefined
      }
      admin_list_spammers: {
        Args: { p_limit?: number }
        Returns: {
          user_id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          warnings_count: number
          status: string
          last_warning_at: string | null
          updated_at: string
        }[]
      }
      admin_update_spammer_status: {
        Args: { p_user_id: string; p_status: string; p_admin_note?: string | null }
        Returns: string
      }
      get_my_spam_warnings_count: {
        Args: { p_window_hours?: number }
        Returns: number
      }
      admin_delete_post: {
        Args: { p_post_id: string; p_reason?: string }
        Returns: string
      }
      delete_user_account: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
