import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Trash2, Settings, Crown, LogOut, Menu, X, Gamepad2, ImageIcon, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TCoinBadge } from './TCoinBadge';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useChats } from '@/hooks/useChats';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ currentChatId, onSelectChat, onNewChat, onOpenSettings }: SidebarProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { chats, deleteChat } = useChats();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    await deleteChat.mutateAsync(chatId);
  };

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center glow-primary">
            <span className="text-xl font-bold text-primary-foreground">θ</span>
          </div>
          <div>
            <h1 className="font-bold text-lg gradient-text">ThetAI</h1>
            {profile?.is_plus && (
              <span className="text-xs text-secondary flex items-center gap-1">
                <Crown className="w-3 h-3" /> Plus
              </span>
            )}
          </div>
        </div>
        
        <Button onClick={onNewChat} variant="gradient" className="w-full">
          <Plus className="w-4 h-4" />
          {t.chat.newChat}
        </Button>
      </div>

      {/* Chats list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <div className="space-y-1">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                onSelectChat(chat.id);
                setIsOpen(false);
              }}
              className={cn(
                'group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200',
                currentChatId === chat.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate text-sm">{chat.title}</span>
              <button
                onClick={(e) => handleDeleteChat(e, chat.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t.settings.balance}</span>
          <TCoinBadge amount={profile?.tcoins ?? 0} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button 
            onClick={() => navigate('/games')} 
            variant="outline" 
            size="sm" 
            className="border-secondary/50 text-secondary hover:bg-secondary/10"
            title={t.games.earnCoins}
          >
            <Gamepad2 className="w-4 h-4" />
          </Button>
          <Button 
            onClick={() => navigate('/image-generator')} 
            variant="outline" 
            size="sm" 
            className="border-primary/50 text-primary hover:bg-primary/10"
            title={t.sidebar.imageGenerator}
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Button 
            onClick={() => navigate('/voice-chat')} 
            variant="outline" 
            size="sm" 
            className="border-accent/50 text-accent hover:bg-accent/10"
            title={t.sidebar.voiceChat}
          >
            <Mic className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={onOpenSettings} variant="glass" size="sm" className="flex-1">
            <Settings className="w-4 h-4" />
            {t.chat.settings}
          </Button>
          <Button onClick={signOut} variant="ghost" size="sm">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="glass"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed md:relative h-full w-72 glass-card flex flex-col z-50 transition-transform duration-300',
        'md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent />
      </aside>
    </>
  );
}
