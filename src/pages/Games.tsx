import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gamepad2, Brain, Zap, Calculator, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FloatingShapes } from '@/components/FloatingShapes';
import { TCoinBadge } from '@/components/TCoinBadge';
import { MemoryGame } from '@/components/games/MemoryGame';
import { MathGame } from '@/components/games/MathGame';
import { ReactionGame } from '@/components/games/ReactionGame';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type GameType = 'memory' | 'math' | 'reaction' | null;

export default function Games() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { profile, updateTcoins } = useProfile();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [activeGame, setActiveGame] = useState<GameType>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleGameWin = async (game: GameType, performance: number) => {
    let reward = 0;
    let message = '';

    switch (game) {
      case 'memory':
        // Fewer moves = more coins (max 20 coins for 8 moves)
        reward = Math.max(5, 25 - performance);
        message = t.games.memoryWin.replace('{moves}', performance.toString()).replace('{coins}', reward.toString());
        break;
      case 'math':
        // 2 coins per correct answer
        reward = performance * 2;
        message = t.games.mathWin.replace('{score}', performance.toString()).replace('{coins}', reward.toString());
        break;
      case 'reaction':
        // Faster reaction = more coins (under 250ms = 15 coins)
        if (performance < 250) reward = 15;
        else if (performance < 300) reward = 12;
        else if (performance < 400) reward = 8;
        else reward = 5;
        message = t.games.reactionWin.replace('{time}', performance.toString()).replace('{coins}', reward.toString());
        break;
    }

    try {
      await updateTcoins.mutateAsync({
        amount: reward,
        type: 'earn',
        description: `Game reward: ${game}`
      });
      
      toast({
        title: t.games.congratulations,
        description: message,
      });
    } catch (error) {
      toast({
        title: t.auth.somethingWrong,
        variant: 'destructive',
      });
    }

    setActiveGame(null);
  };

  const games = [
    {
      id: 'memory' as const,
      icon: Brain,
      title: t.games.memory,
      description: t.games.memoryDesc,
      reward: '5-25',
    },
    {
      id: 'math' as const,
      icon: Calculator,
      title: t.games.math,
      description: t.games.mathDesc,
      reward: '20',
    },
    {
      id: 'reaction' as const,
      icon: Zap,
      title: t.games.reaction,
      description: t.games.reactionDesc,
      reward: '5-15',
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <FloatingShapes />
      
      <div className="relative z-10 container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/')} variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold gradient-text">{t.games.title}</h1>
            </div>
          </div>
          <TCoinBadge amount={profile?.tcoins ?? 0} />
        </div>

        {/* Active Game */}
        {activeGame && (
          <Card className="glass-card mb-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t.games[activeGame]}</CardTitle>
              <Button onClick={() => setActiveGame(null)} variant="ghost" size="sm">
                {t.games.close}
              </Button>
            </CardHeader>
            <CardContent className="flex justify-center py-8">
              {activeGame === 'memory' && (
                <MemoryGame onWin={(moves) => handleGameWin('memory', moves)} />
              )}
              {activeGame === 'math' && (
                <MathGame onWin={(score) => handleGameWin('math', score)} />
              )}
              {activeGame === 'reaction' && (
                <ReactionGame onWin={(time) => handleGameWin('reaction', time)} />
              )}
            </CardContent>
          </Card>
        )}

        {/* Game Selection */}
        {!activeGame && (
          <div className="grid gap-4 md:grid-cols-3">
            {games.map((game) => (
              <Card
                key={game.id}
                className={cn(
                  "glass-card cursor-pointer transition-all duration-300",
                  "hover:scale-105 hover:border-primary/50"
                )}
                onClick={() => setActiveGame(game.id)}
              >
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-2">
                    <game.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{game.title}</CardTitle>
                  <CardDescription>{game.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm">
                    <Coins className="w-4 h-4 text-secondary" />
                    <span className="text-muted-foreground">{t.games.reward}:</span>
                    <span className="font-bold text-secondary">{game.reward} TCoins</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
