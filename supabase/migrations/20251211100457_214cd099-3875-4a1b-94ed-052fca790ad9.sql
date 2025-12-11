-- Add new columns for tracking usage limits
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS messages_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS images_in_prompts_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS images_generated_today INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS image_gen_reset_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Create function to check and reset usage limits (6 hours for messages, daily for image gen)
CREATE OR REPLACE FUNCTION public.check_and_reset_usage(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _usage_reset_at TIMESTAMP WITH TIME ZONE;
  _image_gen_reset_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT usage_reset_at, image_gen_reset_at INTO _usage_reset_at, _image_gen_reset_at
  FROM public.profiles WHERE id = _user_id;
  
  -- Reset 6-hour usage if needed
  IF _usage_reset_at < now() - interval '6 hours' THEN
    UPDATE public.profiles 
    SET messages_used = 0, 
        images_in_prompts_used = 0,
        usage_reset_at = now()
    WHERE id = _user_id;
  END IF;
  
  -- Reset daily image generation if needed
  IF _image_gen_reset_at < now() - interval '24 hours' THEN
    UPDATE public.profiles 
    SET images_generated_today = 0,
        image_gen_reset_at = now()
    WHERE id = _user_id;
  END IF;
END;
$$;

-- Create function to get user limits based on tier
CREATE OR REPLACE FUNCTION public.get_user_limits(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_plus boolean;
  _messages_used integer;
  _images_in_prompts_used integer;
  _images_generated_today integer;
  _usage_reset_at timestamp with time zone;
  _image_gen_reset_at timestamp with time zone;
  _messages_limit integer;
  _images_prompt_limit integer;
  _images_gen_limit integer;
BEGIN
  -- First reset if needed
  PERFORM public.check_and_reset_usage(_user_id);
  
  -- Get current usage
  SELECT is_plus, messages_used, images_in_prompts_used, images_generated_today, usage_reset_at, image_gen_reset_at
  INTO _is_plus, _messages_used, _images_in_prompts_used, _images_generated_today, _usage_reset_at, _image_gen_reset_at
  FROM public.profiles WHERE id = _user_id;
  
  -- Set limits based on tier
  IF _is_plus THEN
    _messages_limit := 1000;
    _images_prompt_limit := 100;
    _images_gen_limit := 15;
  ELSE
    _messages_limit := 50;
    _images_prompt_limit := 10;
    _images_gen_limit := 5;
  END IF;
  
  RETURN jsonb_build_object(
    'is_plus', _is_plus,
    'messages_used', _messages_used,
    'messages_limit', _messages_limit,
    'messages_remaining', _messages_limit - _messages_used,
    'images_in_prompts_used', _images_in_prompts_used,
    'images_prompt_limit', _images_prompt_limit,
    'images_prompt_remaining', _images_prompt_limit - _images_in_prompts_used,
    'images_generated_today', _images_generated_today,
    'images_gen_limit', _images_gen_limit,
    'images_gen_remaining', _images_gen_limit - _images_generated_today,
    'usage_resets_at', _usage_reset_at + interval '6 hours',
    'image_gen_resets_at', _image_gen_reset_at + interval '24 hours'
  );
END;
$$;

-- Create function to increment message usage
CREATE OR REPLACE FUNCTION public.increment_message_usage(_user_id uuid, _has_image boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limits jsonb;
BEGIN
  -- Check and reset if needed
  PERFORM public.check_and_reset_usage(_user_id);
  
  -- Get current limits
  _limits := public.get_user_limits(_user_id);
  
  -- Check if within limits
  IF (_limits->>'messages_remaining')::integer <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'messages_limit');
  END IF;
  
  IF _has_image AND (_limits->>'images_prompt_remaining')::integer <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'images_prompt_limit');
  END IF;
  
  -- Increment usage
  UPDATE public.profiles 
  SET messages_used = messages_used + 1,
      images_in_prompts_used = CASE WHEN _has_image THEN images_in_prompts_used + 1 ELSE images_in_prompts_used END
  WHERE id = _user_id;
  
  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Create function to increment image generation usage
CREATE OR REPLACE FUNCTION public.increment_image_gen_usage(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limits jsonb;
BEGIN
  -- Check and reset if needed
  PERFORM public.check_and_reset_usage(_user_id);
  
  -- Get current limits
  _limits := public.get_user_limits(_user_id);
  
  -- Check if within limits
  IF (_limits->>'images_gen_remaining')::integer <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'images_gen_limit', 'resets_at', _limits->>'image_gen_resets_at');
  END IF;
  
  -- Increment usage
  UPDATE public.profiles 
  SET images_generated_today = images_generated_today + 1
  WHERE id = _user_id;
  
  RETURN jsonb_build_object('allowed', true);
END;
$$;