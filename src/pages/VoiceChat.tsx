import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { FloatingShapes } from '@/components/FloatingShapes';
import { SettingsModal } from '@/components/SettingsModal';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, MicOff, Volume2, VolumeX, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionInterface extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInterface;
    webkitSpeechRecognition: new () => SpeechRecognitionInterface;
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function VoiceChat() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: t.voiceChat.error,
        description: t.voiceChat.notSupported,
        variant: 'destructive',
      });
      return;
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'ru-RU'; // Default to Russian, will auto-detect
    
    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      setTranscript(transcriptText);
      
      if (event.results[current].isFinal) {
        handleUserMessage(transcriptText);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error !== 'no-speech') {
        toast({
          title: t.voiceChat.error,
          description: t.voiceChat.recognitionError,
          variant: 'destructive',
        });
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      recognition.abort();
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleUserMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setTranscript('');
    setIsProcessing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('chat', {
        body: {
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        }
      });

      if (response.error) throw response.error;

      // Handle streaming response
      const reader = response.data?.getReader?.();
      if (reader) {
        let assistantContent = '';
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  assistantContent += content;
                }
              } catch {}
            }
          }
        }
        
        if (assistantContent) {
          const assistantMessage: Message = { role: 'assistant', content: assistantContent };
          setMessages(prev => [...prev, assistantMessage]);
          
          if (!isMuted) {
            speakText(assistantContent);
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: t.voiceChat.error,
        description: t.voiceChat.chatError,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 1;
    utterance.pitch = 1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const toggleMute = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setIsMuted(!isMuted);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="h-screen flex overflow-hidden relative">
      <FloatingShapes />
      
      <Sidebar
        currentChatId={null}
        onSelectChat={() => navigate('/chat')}
        onNewChat={() => navigate('/chat')}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col relative z-10 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full flex flex-col h-full">
          {/* Header */}
          <div className="text-center space-y-2 mb-6">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
              <Mic className="w-8 h-8 text-primary" />
              {t.voiceChat.title}
            </h1>
            <p className="text-muted-foreground">
              {t.voiceChat.description}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-6">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t.voiceChat.startPrompt}</p>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "p-4 rounded-2xl max-w-[80%] animate-fade-in",
                  msg.role === 'user' 
                    ? "ml-auto bg-primary text-primary-foreground" 
                    : "glass-card"
                )}
              >
                {msg.content}
              </div>
            ))}
            
            {transcript && (
              <div className="p-4 rounded-2xl max-w-[80%] ml-auto bg-primary/50 text-primary-foreground animate-pulse">
                {transcript}...
              </div>
            )}
            
            {isProcessing && (
              <div className="glass-card p-4 rounded-2xl max-w-[80%] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.voiceChat.thinking}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMute}
                className="w-12 h-12 rounded-full"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className={cn("w-5 h-5", isSpeaking && "text-primary animate-pulse")} />
                )}
              </Button>
              
              <Button
                onClick={toggleListening}
                disabled={isProcessing}
                className={cn(
                  "w-20 h-20 rounded-full transition-all",
                  isListening && "bg-destructive hover:bg-destructive/90 animate-pulse"
                )}
              >
                {isListening ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>
              
              <div className="w-12 h-12" /> {/* Spacer for symmetry */}
            </div>
            
            <p className="text-center text-sm text-muted-foreground mt-4">
              {isListening ? t.voiceChat.listening : t.voiceChat.tapToSpeak}
            </p>
          </div>
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}