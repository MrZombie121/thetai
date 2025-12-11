import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { FloatingShapes } from '@/components/FloatingShapes';
import { SettingsModal } from '@/components/SettingsModal';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Image, Download, Sparkles } from 'lucide-react';

export default function ImageGenerator() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const { toast } = useToast();
  
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageDescription, setImageDescription] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: t.imageGen.error,
        description: t.imageGen.enterPrompt,
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setImageDescription(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt }
      });

      if (error) throw error;

      if (data.error === 'images_gen_limit_exceeded') {
        toast({
          title: t.imageGen.limitExceeded,
          description: data.message,
          variant: 'destructive',
        });
        return;
      }

      if (data.error) {
        toast({
          title: t.imageGen.error,
          description: data.message || data.error,
          variant: 'destructive',
        });
        return;
      }

      setGeneratedImage(data.imageUrl);
      setImageDescription(data.description);
      
      toast({
        title: t.imageGen.success,
        description: t.imageGen.imageGenerated,
      });
    } catch (error: any) {
      console.error('Image generation error:', error);
      toast({
        title: t.imageGen.error,
        description: t.imageGen.imageGenerationFailed,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thetai-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: t.imageGen.error,
        description: t.imageGen.downloadFailed,
        variant: 'destructive',
      });
    }
  };

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
        <div className="max-w-4xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              {t.imageGen.title}
            </h1>
            <p className="text-muted-foreground">
              {t.imageGen.description}
            </p>
            <div className="text-sm text-muted-foreground">
              {t.imageGen.dailyLimit}: {profile?.is_plus ? '15' : '5'} {t.imageGen.imagesPerDay}
            </div>
          </div>

          {/* Input Section */}
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <Textarea
              placeholder={t.imageGen.describeImage}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[120px] resize-none bg-background/50"
              maxLength={2000}
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {prompt.length}/2000
              </span>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.imageGen.generating}
                  </>
                ) : (
                  <>
                    <Image className="w-4 h-4" />
                    {t.imageGen.generate}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Result Section */}
          {generatedImage && (
            <div className="glass-card p-6 rounded-2xl space-y-4 animate-fade-in">
              <div className="relative group">
                <img
                  src={generatedImage}
                  alt="Generated image"
                  className="w-full rounded-xl"
                />
                <Button
                  onClick={handleDownload}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity gap-2"
                  size="sm"
                >
                  <Download className="w-4 h-4" />
                  {t.imageGen.download}
                </Button>
              </div>
              {imageDescription && (
                <p className="text-sm text-muted-foreground">{imageDescription}</p>
              )}
            </div>
          )}

          {/* Example Prompts */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">{t.imageGen.examplePrompts}:</h3>
            <div className="flex flex-wrap gap-2">
              {[
                'Futuristic city at sunset with flying cars',
                'Cute robot reading a book in a cozy library',
                'Abstract art with vibrant colors and geometric shapes',
                'Magical forest with glowing mushrooms at night'
              ].map((example, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompt(example)}
                  className="text-xs"
                >
                  {example}
                </Button>
              ))}
            </div>
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
