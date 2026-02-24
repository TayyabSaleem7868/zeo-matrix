DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
  ) THEN
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
