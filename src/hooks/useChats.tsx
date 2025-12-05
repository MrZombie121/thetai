import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url: string | null;
  created_at: string;
}

// Retry helper for network errors with session refresh
const retryOperation = async <T,>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Refresh session on retry attempts
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt + 1}, refreshing session...`);
        await supabase.auth.refreshSession();
      }
      
      return await operation();
    } catch (error: any) {
      console.error(`Operation failed (attempt ${attempt + 1}):`, error);
      lastError = error;
      const isNetworkError = error?.message?.includes('NetworkError') || 
                            error?.message?.includes('fetch') ||
                            error?.message?.includes('network');
      
      if (!isNetworkError || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
  
  throw lastError;
};

export function useChats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['chats', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      return retryOperation(async () => {
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        
        if (error) throw error;
        return data as Chat[];
      });
    },
    enabled: !!user,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const createChat = useMutation({
    mutationFn: async (title?: string) => {
      if (!user) throw new Error('Not authenticated');
      
      // Ensure we have a valid session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        // Try to refresh
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
        }
      }
      
      return retryOperation(async () => {
        const { data, error } = await supabase
          .from('chats')
          .insert({
            user_id: user.id,
            title: title || 'Новый чат'
          })
          .select()
          .single();
        
        if (error) throw error;
        return data as Chat;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', user?.id] });
    },
  });

  const updateChatTitle = useMutation({
    mutationFn: async ({ chatId, title }: { chatId: string; title: string }) => {
      return retryOperation(async () => {
        const { error } = await supabase
          .from('chats')
          .update({ title })
          .eq('id', chatId);
        
        if (error) throw error;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', user?.id] });
    },
  });

  const deleteChat = useMutation({
    mutationFn: async (chatId: string) => {
      return retryOperation(async () => {
        const { error } = await supabase
          .from('chats')
          .delete()
          .eq('id', chatId);
        
        if (error) throw error;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', user?.id] });
    },
  });

  return {
    chats,
    chatsLoading,
    createChat,
    updateChatTitle,
    deleteChat,
  };
}

export function useMessages(chatId: string | null) {
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: async () => {
      if (!chatId) return [];
      
      return retryOperation(async () => {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data as Message[];
      });
    },
    enabled: !!chatId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const addMessage = useMutation({
    mutationFn: async ({ role, content, imageUrl }: { role: 'user' | 'assistant'; content: string; imageUrl?: string }) => {
      if (!chatId) throw new Error('No chat selected');
      
      return retryOperation(async () => {
        const { data, error } = await supabase
          .from('messages')
          .insert({
            chat_id: chatId,
            role,
            content,
            image_url: imageUrl || null
          })
          .select()
          .single();
        
        if (error) throw error;
        return data as Message;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    },
  });

  return {
    messages,
    messagesLoading,
    addMessage,
  };
}
