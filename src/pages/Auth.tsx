import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingShapes } from '@/components/FloatingShapes';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(6, 'Пароль должен быть минимум 6 символов'),
  displayName: z.string().min(2, 'Имя должно быть минимум 2 символа').optional(),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({
        email,
        password,
        displayName: !isLogin ? displayName : undefined,
      });
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            newErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login')) {
            toast({
              title: 'Ошибка входа',
              description: 'Неверный email или пароль',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Ошибка',
              description: error.message,
              variant: 'destructive',
            });
          }
        }
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Пользователь существует',
              description: 'Этот email уже зарегистрирован. Попробуйте войти.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Ошибка регистрации',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Добро пожаловать!',
            description: 'Аккаунт успешно создан. Вам начислено 100 TCoins!',
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <FloatingShapes />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary glow-primary mb-4">
            <span className="text-3xl font-bold text-primary-foreground">θ</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text">ThetAI</h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? 'Войдите в свой аккаунт' : 'Создайте аккаунт'}
          </p>
        </div>

        {/* Form */}
        <div className="glass-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Имя</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ваше имя"
                    className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-3 outline-none focus:border-primary transition-colors"
                  />
                </div>
                {errors.displayName && (
                  <p className="text-destructive text-xs mt-1">{errors.displayName}</p>
                )}
              </div>
            )}

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-3 outline-none focus:border-primary transition-colors"
                />
              </div>
              {errors.email && (
                <p className="text-destructive text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-12 py-3 outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="gradient"
              size="xl"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Войти' : 'Создать аккаунт'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              {isLogin ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
              <span className="text-primary font-medium">
                {isLogin ? 'Зарегистрироваться' : 'Войти'}
              </span>
            </button>
          </div>
        </div>

        {/* Bonus info */}
        {!isLogin && (
          <div className="mt-4 text-center animate-fade-in">
            <p className="text-sm text-muted-foreground">
              🎁 При регистрации вы получите <span className="text-tcoin font-semibold">100 TCoins</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
