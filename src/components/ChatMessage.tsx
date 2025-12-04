import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from '@/hooks/useChats';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn(
      'flex gap-4 animate-fade-in',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      {/* Avatar */}
      <div className={cn(
        'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
        isUser 
          ? 'bg-secondary/20 text-secondary' 
          : 'bg-gradient-to-br from-primary to-secondary text-primary-foreground glow-primary'
      )}>
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Content */}
      <div className={cn(
        'flex-1 max-w-[80%]',
        isUser ? 'text-right' : 'text-left'
      )}>
        <div className={cn(
          'inline-block px-4 py-3 rounded-2xl',
          isUser 
            ? 'bg-secondary/20 rounded-tr-sm' 
            : 'glass-card rounded-tl-sm'
        )}>
          {message.image_url && (
            <img 
              src={message.image_url} 
              alt="Attached" 
              className="max-w-xs rounded-lg mb-2"
            />
          )}
          <div className={cn(
            'prose prose-invert prose-sm max-w-none',
            isUser && 'text-right'
          )}>
            <ReactMarkdown
              components={{
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono text-xs" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={cn("block bg-muted p-3 rounded-lg overflow-x-auto font-mono text-xs", className)} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <pre className="bg-transparent p-0">{children}</pre>,
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 px-2">
          {new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
