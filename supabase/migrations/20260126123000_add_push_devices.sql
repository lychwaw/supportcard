-- ============================================
-- ADD: Device tokens for APNs push notifications
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_token TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  environment TEXT NOT NULL DEFAULT 'development',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_id ON public.push_devices(user_id);

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_devices'
      AND policyname = 'push_devices_select_own'
  ) THEN
    CREATE POLICY push_devices_select_own
      ON public.push_devices
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_devices'
      AND policyname = 'push_devices_insert_own'
  ) THEN
    CREATE POLICY push_devices_insert_own
      ON public.push_devices
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_devices'
      AND policyname = 'push_devices_update_own'
  ) THEN
    CREATE POLICY push_devices_update_own
      ON public.push_devices
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'push_devices'
      AND policyname = 'push_devices_delete_own'
  ) THEN
    CREATE POLICY push_devices_delete_own
      ON public.push_devices
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.push_devices IS 'APNs device tokens per user';

