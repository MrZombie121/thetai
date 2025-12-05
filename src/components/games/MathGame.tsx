import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

interface MathGameProps {
  onWin: (score: number) => void;
}

interface Problem {
  a: number;
  b: number;
  operator: '+' | '-' | '×';
  answer: number;
}

const GAME_DURATION = 60; // seconds
const PROBLEMS_TO_WIN = 10;

export function MathGame({ onWin }: MathGameProps) {
  const { t } = useLanguage();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const generateProblem = useCallback((): Problem => {
    const operators: ('+' | '-' | '×')[] = ['+', '-', '×'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let a: number, b: number, answer: number;
    
    switch (operator) {
      case '+':
        a = Math.floor(Math.random() * 50) + 1;
        b = Math.floor(Math.random() * 50) + 1;
        answer = a + b;
        break;
      case '-':
        a = Math.floor(Math.random() * 50) + 20;
        b = Math.floor(Math.random() * a);
        answer = a - b;
        break;
      case '×':
        a = Math.floor(Math.random() * 12) + 1;
        b = Math.floor(Math.random() * 12) + 1;
        answer = a * b;
        break;
    }
    
    return { a, b, operator, answer };
  }, []);

  const startGame = () => {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setIsPlaying(true);
    setProblem(generateProblem());
    setUserAnswer('');
    setFeedback(null);
  };

  useEffect(() => {
    if (!isPlaying) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsPlaying(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    if (score >= PROBLEMS_TO_WIN && isPlaying) {
      setIsPlaying(false);
      onWin(score);
    }
  }, [score, isPlaying, onWin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem || !isPlaying) return;

    const numAnswer = parseInt(userAnswer);
    if (numAnswer === problem.answer) {
      setScore(prev => prev + 1);
      setFeedback('correct');
    } else {
      setFeedback('wrong');
    }

    setTimeout(() => {
      setProblem(generateProblem());
      setUserAnswer('');
      setFeedback(null);
    }, 300);
  };

  if (!isPlaying && timeLeft === GAME_DURATION) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-muted-foreground text-center">
          {t.games.mathDesc}
        </p>
        <Button onClick={startGame} variant="gradient">
          {t.games.start}
        </Button>
      </div>
    );
  }

  if (!isPlaying && timeLeft === 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-xl font-bold">{t.games.timeUp}</p>
        <p className="text-muted-foreground">{t.games.finalScore}: {score}</p>
        <Button onClick={startGame} variant="gradient">
          {t.games.playAgain}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center justify-between w-full max-w-xs">
        <span className="text-muted-foreground">{t.games.score}: {score}/{PROBLEMS_TO_WIN}</span>
        <span className={cn(
          "font-mono font-bold",
          timeLeft <= 10 ? "text-destructive" : "text-primary"
        )}>
          {timeLeft}s
        </span>
      </div>

      {problem && (
        <div className={cn(
          "text-4xl font-bold py-4 px-8 rounded-xl transition-colors",
          feedback === 'correct' && "bg-green-500/20",
          feedback === 'wrong' && "bg-destructive/20"
        )}>
          {problem.a} {problem.operator} {problem.b} = ?
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="?"
          className="w-24 text-center text-xl"
          autoFocus
        />
        <Button type="submit" variant="gradient">
          {t.games.check}
        </Button>
      </form>
    </div>
  );
}
