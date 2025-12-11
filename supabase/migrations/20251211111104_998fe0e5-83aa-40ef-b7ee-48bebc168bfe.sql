-- Create promo codes table
CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_uses INTEGER DEFAULT NULL, -- NULL means unlimited
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read active promo codes (for validation)
CREATE POLICY "Users can read active promo codes"
ON public.promo_codes
FOR SELECT
TO authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Create table for tracking used promo codes per user
CREATE TABLE public.promo_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id),
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, promo_code_id)
);

-- Enable RLS
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

-- Users can see their own promo code uses
CREATE POLICY "Users can view own promo uses"
ON public.promo_code_uses
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own promo code uses
CREATE POLICY "Users can insert own promo uses"
ON public.promo_code_uses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Insert the release26 promo code with 50% discount
INSERT INTO public.promo_codes (code, discount_percent, max_uses, is_active)
VALUES ('release26', 50, NULL, true);

-- Function to validate and apply promo code
CREATE OR REPLACE FUNCTION public.validate_promo_code(_code TEXT, _user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _promo promo_codes%ROWTYPE;
  _already_used BOOLEAN;
BEGIN
  -- Find the promo code (case insensitive)
  SELECT * INTO _promo
  FROM promo_codes
  WHERE LOWER(code) = LOWER(_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_code');
  END IF;
  
  -- Check max uses
  IF _promo.max_uses IS NOT NULL AND _promo.current_uses >= _promo.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'max_uses_reached');
  END IF;
  
  -- Check if user already used this code
  SELECT EXISTS(
    SELECT 1 FROM promo_code_uses 
    WHERE user_id = _user_id AND promo_code_id = _promo.id
  ) INTO _already_used;
  
  IF _already_used THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_used');
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'discount_percent', _promo.discount_percent,
    'promo_id', _promo.id
  );
END;
$$;

-- Function to apply promo code when upgrading
CREATE OR REPLACE FUNCTION public.apply_promo_and_upgrade(_user_id UUID, _promo_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _promo promo_codes%ROWTYPE;
  _profile profiles%ROWTYPE;
  _discounted_price INTEGER;
  _expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get promo details
  SELECT * INTO _promo FROM promo_codes WHERE id = _promo_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_promo');
  END IF;
  
  -- Get user profile
  SELECT * INTO _profile FROM profiles WHERE id = _user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'user_not_found');
  END IF;
  
  -- Calculate discounted price (base price 500 TCoins)
  _discounted_price := 500 - (500 * _promo.discount_percent / 100);
  
  -- Check if user has enough TCoins
  IF _profile.tcoins < _discounted_price THEN
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_tcoins', 'required', _discounted_price);
  END IF;
  
  -- Calculate expiration (1 month from now)
  _expires_at := now() + interval '1 month';
  
  -- Deduct TCoins and upgrade
  UPDATE profiles
  SET tcoins = tcoins - _discounted_price,
      is_plus = true,
      plus_expires_at = _expires_at
  WHERE id = _user_id;
  
  -- Record promo use
  INSERT INTO promo_code_uses (user_id, promo_code_id)
  VALUES (_user_id, _promo_id);
  
  -- Increment promo usage count
  UPDATE promo_codes
  SET current_uses = current_uses + 1
  WHERE id = _promo_id;
  
  -- Record transaction
  INSERT INTO tcoin_transactions (user_id, amount, type, description)
  VALUES (_user_id, -_discounted_price, 'spend', 'ThetAI Plus (promo: ' || _promo.code || ')');
  
  RETURN jsonb_build_object('success', true, 'price_paid', _discounted_price, 'discount', _promo.discount_percent);
END;
$$;