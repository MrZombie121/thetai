import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

interface MemoryGameProps {
  onWin: (moves: number) => void;
}

const EMOJIS = ['🎮', '🎯', '🎨', '🎭', '🎪', '🎬', '🎤', '🎧'];

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export function MemoryGame({ onWin }: MemoryGameProps) {
  const { t } = useLanguage();
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  const initializeGame = () => {
    const shuffledEmojis = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: index,
        emoji,
        isFlipped: false,
        isMatched: false,
      }));
    setCards(shuffledEmojis);
    setFlippedCards([]);
    setMoves(0);
    setIsChecking(false);
  };

  useEffect(() => {
    initializeGame();
  }, []);

  const handleCardClick = (cardId: number) => {
    if (isChecking) return;
    if (flippedCards.length >= 2) return;
    if (cards[cardId].isMatched) return;
    if (flippedCards.includes(cardId)) return;

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);
    
    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, isFlipped: true } : card
    ));

    if (newFlipped.length === 2) {
      setMoves(prev => prev + 1);
      setIsChecking(true);
      
      const [first, second] = newFlipped;
      if (cards[first].emoji === cards[second].emoji) {
        setCards(prev => prev.map(card => 
          card.id === first || card.id === second 
            ? { ...card, isMatched: true } 
            : card
        ));
        setFlippedCards([]);
        setIsChecking(false);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(card => 
            card.id === first || card.id === second 
              ? { ...card, isFlipped: false } 
              : card
          ));
          setFlippedCards([]);
          setIsChecking(false);
        }, 1000);
      }
    }
  };

  useEffect(() => {
    if (cards.length > 0 && cards.every(card => card.isMatched)) {
      onWin(moves);
    }
  }, [cards, moves, onWin]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-md">
        <span className="text-muted-foreground">{t.games.moves}: {moves}</span>
        <Button onClick={initializeGame} variant="outline" size="sm">
          {t.games.restart}
        </Button>
      </div>
      
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            disabled={card.isMatched || isChecking}
            className={cn(
              'w-14 h-14 sm:w-16 sm:h-16 rounded-xl text-2xl font-bold transition-all duration-300 transform',
              card.isFlipped || card.isMatched
                ? 'bg-primary/20 border-primary/50 rotate-0'
                : 'bg-muted border-border hover:bg-muted/80 rotate-y-180',
              'border-2 flex items-center justify-center',
              card.isMatched && 'opacity-60 scale-95'
            )}
          >
            {(card.isFlipped || card.isMatched) ? card.emoji : '?'}
          </button>
        ))}
      </div>
    </div>
  );
}
