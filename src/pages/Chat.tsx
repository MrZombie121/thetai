import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { EmptyChat } from '@/components/EmptyChat';
import { SettingsModal } from '@/components/SettingsModal';
import { FloatingShapes } from '@/components/FloatingShapes';
import { useAuth } from '@/hooks/useAuth';
import { useChats, useMessages } from '@/hooks/useChats';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function Chat() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  
  const { chats, createChat, updateChatTitle } = useChats();
  const { messages, addMessage } = useMessages(currentChatId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewChat = async () => {
    try {
      const newChat = await createChat.mutateAsync('Новый чат');
      setCurrentChatId(newChat.id);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать чат',
        variant: 'destructive',
      });
    }
  };

  const handleSendMessage = async (content: string, imageUrl?: string) => {
    if (!content.trim() && !imageUrl) return;

    let chatId = currentChatId;

    // Create new chat if needed
    if (!chatId) {
      try {
        const newChat = await createChat.mutateAsync('Новый чат');
        chatId = newChat.id;
        setCurrentChatId(newChat.id);
      } catch (error) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось создать чат',
          variant: 'destructive',
        });
        return;
      }
    }

    // Add user message
    try {
      await addMessage.mutateAsync({
        role: 'user',
        content,
        imageUrl,
      });

      // Update chat title if it's the first message
      if (messages.length === 0) {
        const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        await updateChatTitle.mutateAsync({ chatId, title });
      }

      // Call AI
      setIsAiTyping(true);
      
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content, imageUrl }
          ]
        }
      });

      if (error) throw error;

      // Add AI response
      await addMessage.mutateAsync({
        role: 'assistant',
        content: data.response,
      });

    } catch (error: any) {
      console.error('Chat error:', error);
      
      if (error.message?.includes('429')) {
        toast({
          title: 'Превышен лимит',
          description: 'Слишком много запросов. Подождите немного.',
          variant: 'destructive',
        });
      } else if (error.message?.includes('402')) {
        toast({
          title: 'Требуется оплата',
          description: 'Пополните баланс для продолжения.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось получить ответ от AI',
          variant: 'destructive',
        });
      }
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    handleSendMessage(text);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen flex overflow-hidden relative">
      <FloatingShapes />
      
      <Sidebar
        currentChatId={currentChatId}
        onSelectChat={setCurrentChatId}
        onNewChat={handleNewChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main chat area */}
      <main className="flex-1 flex flex-col relative z-10">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
          {currentChatId && messages.length > 0 ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {isAiTyping && (
                <div className="flex items-center gap-3 animate-fade-in">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center glow-primary">
                    <span className="text-lg font-bold text-primary-foreground">θ</span>
                  </div>
                  <div className="glass-card px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <EmptyChat onSuggestionClick={handleSuggestionClick} />
          )}
        </div>

        {/* Input */}
        <div className="max-w-4xl mx-auto w-full">
          <ChatInput
            onSend={handleSendMessage}
            isLoading={isAiTyping}
          />
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
