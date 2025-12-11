import { useState, useEffect } from 'react';
import { X, Crown, Coins, Sparkles, Zap, Check, Bot, Lock, User, Clock, MessageSquare, Image, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TCoinBadge } from './TCoinBadge';
import { LanguageSelector } from './LanguageSelector';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AI_MODELS = [
  { 
    id: 'thetai-1.0-free', 
    nameKey: 'modelFree' as const,
    descKey: 'modelFreeDesc' as const,
    plusOnly: false 
  },
  { 
    id: 'thetai-1.0-nano', 
    nameKey: 'modelNano' as const,
    descKey: 'modelNanoDesc' as const,
    plusOnly: true 
  },
  { 
    id: 'thetai-1.0-omni', 
    nameKey: 'modelOmni' as const,
    descKey: 'modelOmniDesc' as const,
    plusOnly: true 
  },
];

function formatTimeRemaining(resetAt: string, t: any): string {
  const reset = new Date(resetAt);
  const now = new Date();
  const diff = reset.getTime() - now.getTime();
  
  if (diff <= 0) return '0' + t.settings.minutes;
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}${t.settings.hours} ${minutes}${t.settings.minutes}`;
  }
  return `${minutes}${t.settings.minutes}`;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { profile, limits, upgradeToPlusAccount, updateSelectedModel, updateDisplayName } = useProfile();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    if (profile?.display_name) {
      setNewName(profile.display_name);
    }
  }, [profile?.display_name]);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    if (!profile || profile.tcoins < 500) {
      toast({
        title: t.settings.notEnough,
        variant: 'destructive'
      });
      return;
    }

    setIsUpgrading(true);
    try {
      await upgradeToPlusAccount.mutateAsync();
      toast({
        title: t.settings.plusActive,
      });
    } catch (error) {
      toast({
        title: t.auth.somethingWrong,
        variant: 'destructive'
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    const model = AI_MODELS.find(m => m.id === modelId);
    if (!model) return;
    
    if (model.plusOnly && !profile?.is_plus) {
      toast({
        title: t.settings.plusOnly,
        variant: 'destructive'
      });
      return;
    }

    try {
      await updateSelectedModel.mutateAsync(modelId);
    } catch (error) {
      toast({
        title: t.auth.somethingWrong,
        variant: 'destructive'
      });
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    
    setIsSavingName(true);
    try {
      await updateDisplayName.mutateAsync(newName.trim());
      toast({ title: t.settings.nameSaved });
      setIsEditingName(false);
    } catch (error) {
      toast({ title: t.auth.somethingWrong, variant: 'destructive' });
    } finally {
      setIsSavingName(false);
    }
  };

  const plusFeatures = [
    { icon: Zap, text: '1000 messages / 6h' },
    { icon: Image, text: '15 images / day' },
    { icon: Crown, text: 'Premium AI models' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative glass-card w-full max-w-lg p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4"
        >
          <X className="w-5 h-5" />
        </Button>

        <h2 className="text-2xl font-bold mb-6 gradient-text">{t.settings.title}</h2>

        {/* Account Section */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <span className="font-semibold">{t.settings.account}</span>
          </div>
          
          {/* Nickname */}
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-2 block">{t.settings.nickname}</label>
            {isEditingName ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t.auth.namePlaceholder}
                  className="flex-1"
                />
                <Button onClick={handleSaveName} disabled={isSavingName} size="sm">
                  {t.settings.save}
                </Button>
                <Button onClick={() => setIsEditingName(false)} variant="ghost" size="sm">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-medium">{profile?.display_name || profile?.email}</span>
                <Button onClick={() => setIsEditingName(true)} variant="ghost" size="sm">
                  <Pencil className="w-4 h-4 mr-1" />
                  {t.settings.changeName}
                </Button>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="text-sm text-muted-foreground mb-1 block">Email</label>
            <span className="text-sm">{profile?.email}</span>
          </div>

          {/* Current Tier */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t.settings.tier}</span>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${profile?.is_plus ? 'bg-secondary/20 text-secondary' : 'bg-muted'}`}>
              {profile?.is_plus && <Crown className="w-4 h-4" />}
              <span className="font-medium text-sm">
                {profile?.is_plus ? t.settings.plusTier : t.settings.freeTier}
              </span>
            </div>
          </div>
        </div>

        {/* Usage Limits Section */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-semibold">{t.settings.usageLimits}</span>
          </div>

          {limits && (
            <div className="space-y-4">
              {/* Messages */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t.settings.messages}</span>
                  </div>
                  <span className="text-sm font-mono">
                    {limits.messages_used} / {limits.messages_limit}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min((limits.messages_used / limits.messages_limit) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.settings.resetsIn}: {formatTimeRemaining(limits.usage_resets_at, t)}
                </p>
              </div>

              {/* Images in prompts */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Image className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t.settings.imagesInPrompts}</span>
                  </div>
                  <span className="text-sm font-mono">
                    {limits.images_in_prompts_used} / {limits.images_prompt_limit}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-secondary transition-all"
                    style={{ width: `${Math.min((limits.images_in_prompts_used / limits.images_prompt_limit) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.settings.resetsIn}: {formatTimeRemaining(limits.usage_resets_at, t)}
                </p>
              </div>

              {/* Image generation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t.settings.imageGeneration}</span>
                  </div>
                  <span className="text-sm font-mono">
                    {limits.images_generated_today} / {limits.images_gen_limit}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-tcoin transition-all"
                    style={{ width: `${Math.min((limits.images_generated_today / limits.images_gen_limit) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.settings.resetsIn}: {formatTimeRemaining(limits.image_gen_resets_at, t)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Language selector */}
        <div className="flex items-center justify-between mb-6 glass-card p-4">
          <span className="text-sm text-muted-foreground">{t.language.select}</span>
          <LanguageSelector />
        </div>

        {/* AI Model selector */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-semibold">{t.settings.aiModel}</span>
          </div>
          <div className="space-y-2">
            {AI_MODELS.map((model) => {
              const isSelected = profile?.selected_model === model.id;
              const isLocked = model.plusOnly && !profile?.is_plus;
              
              return (
                <button
                  key={model.id}
                  onClick={() => handleModelSelect(model.id)}
                  disabled={isLocked}
                  className={`w-full p-3 rounded-lg border transition-all text-left ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : isLocked
                      ? 'border-border/50 bg-muted/30 opacity-60 cursor-not-allowed'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          {t.settings[model.nameKey]}
                        </span>
                        {model.plusOnly && (
                          <span className="flex items-center gap-1 text-xs text-secondary">
                            {isLocked ? <Lock className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                            Plus
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.settings[model.descKey]}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Profile info */}
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">{t.settings.balance}</p>
              <TCoinBadge amount={profile?.tcoins ?? 0} size="lg" className="mt-1" />
            </div>
            {profile?.is_plus && (
              <div className="flex items-center gap-2 text-secondary">
                <Crown className="w-5 h-5" />
                <span className="font-semibold">{t.settings.plusActive}</span>
              </div>
            )}
          </div>
        </div>

        {/* Plus subscription */}
        {!profile?.is_plus && (
          <div className="bg-gradient-to-br from-secondary/20 to-primary/20 rounded-xl p-6 border border-secondary/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{t.settings.plus}</h3>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {plusFeatures.map((feature, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
                    <feature.icon className="w-4 h-4 text-secondary" />
                  </div>
                  <span className="text-sm">{feature.text}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-tcoin" />
                <span className="font-bold text-lg">500</span>
              </div>
              
              <Button
                onClick={handleUpgrade}
                variant="gradient"
                disabled={isUpgrading || (profile?.tcoins ?? 0) < 500}
              >
                {t.settings.upgrade}
              </Button>
            </div>
          </div>
        )}

        {profile?.is_plus && (
          <div className="text-center p-6 glass-card">
            <Check className="w-12 h-12 text-primary mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-1">{t.settings.plusActive}!</h3>
            <p className="text-sm text-muted-foreground">
              {t.settings.plusExpires}: {profile.plus_expires_at ? new Date(profile.plus_expires_at).toLocaleDateString() : '∞'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
