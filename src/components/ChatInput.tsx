import { useState, useRef } from 'react';
import { Send, Image, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string, imageUrl?: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !imagePreview) || isLoading || disabled) return;
    
    onSend(message.trim(), imagePreview || undefined);
    setMessage('');
    setImagePreview(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="glass-card p-2 flex flex-col gap-2">
        {/* Image preview */}
        {imagePreview && (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg" />
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || disabled}
          >
            <Image className="w-5 h-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Напишите сообщение..."
            disabled={isLoading || disabled}
            rows={1}
            className={cn(
              'flex-1 bg-transparent border-none outline-none resize-none',
              'text-foreground placeholder:text-muted-foreground',
              'py-2 max-h-[200px] scrollbar-thin'
            )}
          />

          <Button
            type="submit"
            variant="gradient"
            size="icon"
            disabled={(!message.trim() && !imagePreview) || isLoading || disabled}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
      
      <p className="text-xs text-center text-muted-foreground mt-2">
        ThetAI может ошибаться. Проверяйте важную информацию.
      </p>
    </form>
  );
}
