import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tcoins: number;
  is_plus: boolean;
  plus_expires_at: string | null;
  storage_used_bytes: number;
  selected_model: string;
  messages_used: number;
  images_in_prompts_used: number;
  images_generated_today: number;
  usage_reset_at: string;
  image_gen_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserLimits {
  is_plus: boolean;
  messages_used: number;
  messages_limit: number;
  messages_remaining: number;
  images_in_prompts_used: number;
  images_prompt_limit: number;
  images_prompt_remaining: number;
  images_generated_today: number;
  images_gen_limit: number;
  images_gen_remaining: number;
  usage_resets_at: string;
  image_gen_resets_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user,
  });

  const updateTcoins = useMutation({
    mutationFn: async ({ amount, type, description }: { amount: number; type: 'earn' | 'spend' | 'purchase'; description?: string }) => {
      if (!user || !profile) throw new Error('Not authenticated');
      
      const newBalance = type === 'spend' ? profile.tcoins - amount : profile.tcoins + amount;
      
      if (newBalance < 0) throw new Error('Insufficient TCoins');
      
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ tcoins: newBalance })
        .eq('id', user.id);
      
      if (profileError) throw profileError;
      
      // Record transaction
      const { error: txError } = await supabase
        .from('tcoin_transactions')
        .insert({
          user_id: user.id,
          amount: type === 'spend' ? -amount : amount,
          type,
          description
        });
      
      if (txError) throw txError;
      
      return newBalance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  const upgradeToPlusAccount = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('Not authenticated');
      if (profile.tcoins < 500) throw new Error('Insufficient TCoins');
      
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          tcoins: profile.tcoins - 500,
          is_plus: true,
          plus_expires_at: expiresAt.toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Record transaction
      await supabase
        .from('tcoin_transactions')
        .insert({
          user_id: user.id,
          amount: -500,
          type: 'spend',
          description: 'ThetAI Plus subscription (1 month)'
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  const updateSelectedModel = useMutation({
    mutationFn: async (model: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('profiles')
        .update({ selected_model: model })
        .eq('id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  const updateDisplayName = useMutation({
    mutationFn: async (displayName: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  const { data: limits, refetch: refetchLimits } = useQuery({
    queryKey: ['userLimits', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc('get_user_limits', { _user_id: user.id });
      if (error) throw error;
      return data as unknown as UserLimits;
    },
    enabled: !!user,
    refetchInterval: 60000, // Refetch every minute
  });

  return {
    profile,
    isLoading,
    limits,
    refetchLimits,
    updateTcoins,
    upgradeToPlusAccount,
    updateSelectedModel,
    updateDisplayName,
  };
}
