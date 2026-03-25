-- Add DELETE policy for notifications table to allow users to clear their own notifications
DROP POLICY IF EXISTS "Notifications: users can delete own" ON public.notifications;
CREATE POLICY "Notifications: users can delete own"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);
