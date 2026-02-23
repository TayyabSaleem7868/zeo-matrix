-- Phase 1: @mentions (tag) notifications
-- Adds new notification type 'tag' to the existing notifications.type CHECK constraint.
DO $$
BEGIN
  -- Only attempt if table exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
  ) THEN
    -- Replace the CHECK constraint by dropping and re-adding (Postgres doesn't let us easily alter CHECK lists).
    -- The constraint name is auto-generated, so we drop any existing CHECK constraint on "type".
    -- This pattern is safe for Supabase migrations.

    -- Drop all CHECK constraints that apply to column "type".
    EXECUTE (
      SELECT string_agg(format('ALTER TABLE public.notifications DROP CONSTRAINT %I;', conname), ' ')
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'notifications'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%type%IN%'
    );

    -- Re-add a single CHECK constraint with the expanded list.
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'like',
        'comment',
        'reply',
        'follow',
        'follow_request',
        'follow_request_accepted',
        'admin_post_deleted',
        'tag'
      ));
  END IF;
END $$;
