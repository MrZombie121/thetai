import { useState } from 'react';
import { X, Crown, Coins, Sparkles, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TCoinBadge } from './TCoinBadge';
import { LanguageSelector } from './LanguageSelector';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { profile, upgradeToPlusAccount } = useProfile();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isUpgrading, setIsUpgrading] = useState(false);

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

  const plusFeatures = [
    { icon: Zap, text: 'Unlimited messages' },
    { icon: Sparkles, text: 'Priority responses' },
    { icon: Crown, text: 'Exclusive features' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative glass-card w-full max-w-lg p-6 animate-scale-in">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4"
        >
          <X className="w-5 h-5" />
        </Button>

        <h2 className="text-2xl font-bold mb-6 gradient-text">{t.settings.title}</h2>

        {/* Language selector */}
        <div className="flex items-center justify-between mb-6 glass-card p-4">
          <span className="text-sm text-muted-foreground">{t.language.select}</span>
          <LanguageSelector />
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
