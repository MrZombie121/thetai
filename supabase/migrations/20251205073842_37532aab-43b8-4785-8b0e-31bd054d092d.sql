-- Add storage tracking to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS storage_used_bytes bigint NOT NULL DEFAULT 0;

-- Create function to count user messages in last N hours
CREATE OR REPLACE FUNCTION public.count_user_messages_in_hours(
  _user_id uuid,
  _hours integer
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.messages m
  INNER JOIN public.chats c ON c.id = m.chat_id
  WHERE c.user_id = _user_id
    AND m.role = 'user'
    AND m.created_at > now() - (_hours || ' hours')::interval;
$$;

-- Create function to get user storage limit in bytes
CREATE OR REPLACE FUNCTION public.get_user_storage_limit(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN p.is_plus THEN 107374182400::bigint  -- 100 GB
    ELSE 2147483648::bigint                    -- 2 GB
  END
  FROM public.profiles p
  WHERE p.id = _user_id;
$$;

-- Create function to check if user can send message
CREATE OR REPLACE FUNCTION public.can_user_send_message(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_plus boolean;
  _message_count integer;
  _storage_used bigint;
  _storage_limit bigint;
  _message_size_bytes integer := 10240; -- 10 KB per message
BEGIN
  -- Get user profile
  SELECT is_plus, storage_used_bytes 
  INTO _is_plus, _storage_used
  FROM public.profiles 
  WHERE id = _user_id;
  
  -- Plus users have no limits
  IF _is_plus THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'is_plus', true,
      'messages_remaining', -1,
      'storage_remaining_bytes', 107374182400 - COALESCE(_storage_used, 0)
    );
  END IF;
  
  -- Count messages in last 4 hours for free users
  _message_count := public.count_user_messages_in_hours(_user_id, 4);
  
  -- Get storage limit
  _storage_limit := 2147483648; -- 2 GB
  
  -- Check rate limit (15 messages per 4 hours)
  IF _message_count >= 15 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limit',
      'is_plus', false,
      'messages_remaining', 0,
      'reset_hours', 4
    );
  END IF;
  
  -- Check storage limit
  IF COALESCE(_storage_used, 0) + _message_size_bytes > _storage_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'storage_limit',
      'is_plus', false,
      'storage_used_bytes', _storage_used,
      'storage_limit_bytes', _storage_limit
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'is_plus', false,
    'messages_remaining', 15 - _message_count,
    'storage_remaining_bytes', _storage_limit - COALESCE(_storage_used, 0)
  );
END;
$$;

-- Create function to increment storage usage
CREATE OR REPLACE FUNCTION public.increment_storage_usage(_user_id uuid, _bytes integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles 
  SET storage_used_bytes = storage_used_bytes + _bytes
  WHERE id = _user_id;
$$;