import { Sparkles, MessageSquare, Image, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';

interface EmptyChatProps {
  onSuggestionClick: (text: string) => void;
}

export function EmptyChat({ onSuggestionClick }: EmptyChatProps) {
  const { t } = useLanguage();
  
  const suggestions = [
    { icon: MessageSquare, text: t.chat.starters.code },
    { icon: Sparkles, text: t.chat.starters.learn },
    { icon: Image, text: t.chat.starters.create },
    { icon: Zap, text: t.chat.starters.analyze },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {/* Logo */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center glow-primary animate-pulse-slow">
          <span className="text-5xl font-bold text-primary-foreground">θ</span>
        </div>
        <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-[40px] blur-2xl -z-10" />
      </div>

      <h2 className="text-3xl font-bold mb-2 text-center">
        <span className="gradient-text">{t.chat.emptyTitle}</span>
      </h2>
      <p className="text-muted-foreground text-center mb-8 max-w-md">
        {t.chat.emptySubtitle}
      </p>

      {/* Suggestions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
        {suggestions.map((suggestion, i) => (
          <Button
            key={i}
            variant="glass"
            className="h-auto p-4 justify-start text-left animate-fade-in"
            style={{ animationDelay: `${i * 100}ms` }}
            onClick={() => onSuggestionClick(suggestion.text)}
          >
            <suggestion.icon className="w-5 h-5 mr-3 shrink-0 text-primary" />
            <span className="text-sm">{suggestion.text}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
