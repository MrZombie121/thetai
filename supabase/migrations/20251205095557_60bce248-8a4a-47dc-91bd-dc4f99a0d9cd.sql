-- Add selected_model column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN selected_model TEXT NOT NULL DEFAULT 'thetai-1.0-free';