-- Fix 1: Drop the overly permissive OTP codes policy and create a proper service-role-only policy
DROP POLICY IF EXISTS "Service role can manage OTP codes" ON otp_codes;

-- Create restrictive policy - only service role can access OTP codes
CREATE POLICY "Only service role can manage OTP codes" ON otp_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix 2: Create rate limiting table for OTP attempts
CREATE TABLE public.otp_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  attempt_type TEXT NOT NULL, -- 'send' or 'verify'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_otp_attempts_email_type_created ON otp_attempts(email, attempt_type, created_at);

-- Enable RLS but only allow service role access
ALTER TABLE public.otp_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can manage OTP attempts" ON otp_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup old attempts (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_otp_attempts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM otp_attempts WHERE created_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_otp_attempts_trigger
AFTER INSERT ON otp_attempts
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_otp_attempts();