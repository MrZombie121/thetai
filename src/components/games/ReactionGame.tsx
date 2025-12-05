import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

interface ReactionGameProps {
  onWin: (avgTime: number) => void;
}

type GameState = 'waiting' | 'ready' | 'click' | 'early' | 'result';

const ROUNDS_TO_PLAY = 5;

export function ReactionGame({ onWin }: ReactionGameProps) {
  const { t } = useLanguage();
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [startTime, setStartTime] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [round, setRound] = useState(0);

  const startRound = useCallback(() => {
    setGameState('ready');
    const delay = Math.random() * 3000 + 1500; // 1.5-4.5 seconds
    
    const timeout = setTimeout(() => {
      setGameState('click');
      setStartTime(Date.now());
    }, delay);

    return () => clearTimeout(timeout);
  }, []);

  const handleClick = () => {
    if (gameState === 'waiting') {
      setRound(1);
      setReactionTimes([]);
      startRound();
    } else if (gameState === 'ready') {
      setGameState('early');
    } else if (gameState === 'click') {
      const time = Date.now() - startTime;
      setCurrentTime(time);
      setReactionTimes(prev => [...prev, time]);
      setGameState('result');
    } else if (gameState === 'early') {
      setRound(1);
      setReactionTimes([]);
      startRound();
    } else if (gameState === 'result') {
      if (round >= ROUNDS_TO_PLAY) {
        const avgTime = Math.round(
          reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
        );
        onWin(avgTime);
        setGameState('waiting');
        setRound(0);
      } else {
        setRound(prev => prev + 1);
        startRound();
      }
    }
  };

  useEffect(() => {
    if (gameState === 'ready') {
      const cleanup = startRound();
      return cleanup;
    }
  }, []);

  const getButtonText = () => {
    switch (gameState) {
      case 'waiting':
        return t.games.clickToStart;
      case 'ready':
        return t.games.wait;
      case 'click':
        return t.games.clickNow;
      case 'early':
        return t.games.tooEarly;
      case 'result':
        return round >= ROUNDS_TO_PLAY 
          ? t.games.seeResults 
          : t.games.nextRound;
    }
  };

  const getButtonColor = () => {
    switch (gameState) {
      case 'waiting':
        return 'bg-primary hover:bg-primary/90';
      case 'ready':
        return 'bg-destructive hover:bg-destructive/90';
      case 'click':
        return 'bg-green-500 hover:bg-green-600';
      case 'early':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'result':
        return 'bg-primary hover:bg-primary/90';
    }
  };

  const avgTime = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

  return (
    <div className="flex flex-col items-center gap-6">
      {round > 0 && (
        <div className="flex items-center justify-between w-full max-w-xs">
          <span className="text-muted-foreground">
            {t.games.round}: {round}/{ROUNDS_TO_PLAY}
          </span>
          {avgTime > 0 && (
            <span className="text-primary font-mono">
              {t.games.avg}: {avgTime}ms
            </span>
          )}
        </div>
      )}

      <button
        onClick={handleClick}
        className={cn(
          "w-64 h-64 rounded-2xl text-xl font-bold text-white transition-all duration-200",
          "flex flex-col items-center justify-center gap-2",
          "shadow-lg active:scale-95",
          getButtonColor()
        )}
      >
        <span>{getButtonText()}</span>
        {gameState === 'result' && (
          <span className="text-3xl font-mono">{currentTime}ms</span>
        )}
      </button>

      {gameState === 'waiting' && (
        <p className="text-muted-foreground text-center max-w-xs">
          {t.games.reactionDesc}
        </p>
      )}
    </div>
  );
}
