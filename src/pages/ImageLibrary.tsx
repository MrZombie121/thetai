import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { FloatingShapes } from "@/components/FloatingShapes";
import { SettingsModal } from "@/components/SettingsModal";
import { Button } from "@/components/ui/button";
import { Download, Trash2, ImageIcon, Sparkles } from "lucide-react";

interface GeneratedImage {
  id: string;
  prompt: string;
  image_url: string;
  description: string | null;
  created_at: string;
}

export default function ImageLibrary() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchImages();
    }
  }, [user]);

  const fetchImages = async () => {
    try {
      const { data, error } = await supabase
        .from("generated_images")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("generated_images")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setImages(images.filter(img => img.id !== id));
      setSelectedImage(null);
      toast({
        title: t.imageLibrary.deleted,
      });
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  const handleDownload = async (imageUrl: string, prompt: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thetai-${prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      <FloatingShapes />
      <Sidebar 
        currentChatId={null}
        onSelectChat={(chatId) => navigate(`/?chat=${chatId}`)}
        onNewChat={() => navigate('/')}
        onOpenSettings={() => setSettingsOpen(true)} 
      />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-border/50 p-4 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{t.imageLibrary.title}</h1>
              <p className="text-sm text-muted-foreground">{t.imageLibrary.description}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-medium text-foreground mb-2">{t.imageLibrary.empty}</h2>
              <p className="text-sm text-muted-foreground mb-4">{t.imageLibrary.emptySubtitle}</p>
              <Button onClick={() => navigate("/image-generator")}>
                {t.imageLibrary.goToGenerator}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer"
                  onClick={() => setSelectedImage(image)}
                >
                  <img
                    src={image.image_url}
                    alt={image.prompt}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(image.image_url, image.prompt);
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(image.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Image detail modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div
              className="bg-background rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <img
                  src={selectedImage.image_url}
                  alt={selectedImage.prompt}
                  className="w-full max-h-[60vh] object-contain bg-black"
                />
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t.imageLibrary.prompt}</p>
                  <p className="text-sm text-foreground">{selectedImage.prompt}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {t.imageLibrary.generatedAt}: {new Date(selectedImage.created_at).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(selectedImage.image_url, selectedImage.prompt)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {t.imageGen.download}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(selectedImage.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t.imageLibrary.delete}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
