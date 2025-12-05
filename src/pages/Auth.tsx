import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingShapes } from '@/components/FloatingShapes';
import { OtpInput } from '@/components/OtpInput';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

type AuthStep = 'credentials' | 'otp';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pendingAuth, setPendingAuth] = useState<{ email: string; password: string } | null>(null);
  
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const authSchema = z.object({
    email: z.string().email(t.auth.emailPlaceholder),
    password: z.string().min(6, t.auth.passwordPlaceholder),
    displayName: z.string().min(2, t.auth.namePlaceholder).optional(),
  });

  useEffect(() => {
    if (user && step !== 'otp') {
      navigate('/');
    }
  }, [user, navigate, step]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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

  const sendOtpEmail = async (userEmail: string, type: 'signup' | 'login') => {
    const { error } = await supabase.functions.invoke('send-otp', {
      body: { email: userEmail, type },
    });
    return { error };
  };

  const verifyOtpCode = async (userEmail: string, code: string) => {
    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: { email: userEmail, code },
    });
    return { data, error };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // For both login and signup, first send OTP for verification
      const { error: otpError } = await sendOtpEmail(email, isLogin ? 'login' : 'signup');
      
      if (otpError) {
        setIsLoading(false);
        toast({
          title: t.auth.somethingWrong,
          variant: 'destructive',
        });
        return;
      }
      
      // Store credentials for later
      setPendingAuth({ email, password });
      setResendCooldown(60);
      setIsLoading(false);
      
      // Delay step change to avoid DOM conflict with browser extensions
      requestAnimationFrame(() => {
        setStep('otp');
        toast({
          title: t.auth.emailSent,
        });
      });
    } catch (error) {
      setIsLoading(false);
      toast({
        title: t.auth.somethingWrong,
        variant: 'destructive',
      });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpCode.length !== 6) {
      toast({
        title: t.auth.invalidOtp,
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Verify our custom OTP
      const { data, error } = await verifyOtpCode(email, otpCode);
      
      if (error || !data?.valid) {
        toast({
          title: data?.error === 'Invalid or expired code' ? t.auth.otpExpired : t.auth.invalidOtp,
          variant: 'destructive',
        });
        return;
      }

      // OTP is valid, now perform the actual auth
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: pendingAuth?.email || email,
          password: pendingAuth?.password || password,
        });
        
        if (signInError) {
          toast({
            title: t.auth.invalidCredentials,
            variant: 'destructive',
          });
          return;
        }
      } else {
        // Sign up the user (auto-confirmed)
        const { error: signUpError } = await supabase.auth.signUp({
          email: pendingAuth?.email || email,
          password: pendingAuth?.password || password,
          options: {
            data: {
              display_name: displayName || email.split('@')[0]
            }
          }
        });
        
        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            toast({
              title: t.auth.userExists,
              variant: 'destructive',
            });
          } else {
            toast({
              title: t.auth.somethingWrong,
              variant: 'destructive',
            });
          }
          return;
        }
      }
      
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setIsLoading(true);
    try {
      const { error } = await sendOtpEmail(email, isLogin ? 'login' : 'signup');
      if (error) {
        toast({
          title: t.auth.somethingWrong,
          variant: 'destructive',
        });
      } else {
        setResendCooldown(60);
        toast({
          title: t.auth.emailSent,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setOtpCode('');
    setPendingAuth(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <FloatingShapes />
      
      {/* Language selector */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary glow-primary mb-4">
            <span className="text-3xl font-bold text-primary-foreground">θ</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text">ThetAI</h1>
          <p className="text-muted-foreground mt-2">
            {step === 'otp' 
              ? t.auth.verifyEmail 
              : isLogin 
                ? t.auth.signIn 
                : t.auth.signUp}
          </p>
        </div>

        {/* Form */}
        <div className="glass-card p-6">
          {/* Credentials Form - hidden when on OTP step */}
          <div className={step === 'credentials' ? 'block' : 'hidden'}>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">{t.auth.displayName}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t.auth.namePlaceholder}
                      className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-3 outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  {errors.displayName && (
                    <p className="text-destructive text-xs mt-1">{errors.displayName}</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">{t.auth.email}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.auth.emailPlaceholder}
                    className="w-full bg-muted/50 border border-border rounded-lg pl-10 pr-4 py-3 outline-none focus:border-primary transition-colors"
                  />
                </div>
                {errors.email && (
                  <p className="text-destructive text-xs mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">{t.auth.password}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.auth.passwordPlaceholder}
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
                    {isLogin ? t.auth.signIn : t.auth.signUp}
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
                {isLogin ? t.auth.noAccount : t.auth.hasAccount}{' '}
                <span className="text-primary font-medium">
                  {isLogin ? t.auth.signUp : t.auth.signIn}
                </span>
              </button>
            </div>
          </div>

          {/* OTP Form - hidden when on credentials step */}
          <div className={step === 'otp' ? 'block' : 'hidden'}>
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t.auth.otpSent}
                </p>
                <p className="font-medium text-foreground">{email}</p>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-3 block text-center">
                  {t.auth.enterCode}
                </label>
                <OtpInput
                  value={otpCode}
                  onChange={setOtpCode}
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                variant="gradient"
                size="xl"
                className="w-full"
                disabled={isLoading || otpCode.length !== 6}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {t.auth.verify}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t.auth.back}
                </button>
                
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-4 h-4" />
                  {resendCooldown > 0 ? `${t.auth.resendIn} ${resendCooldown}${t.auth.seconds}` : t.auth.resendCode}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Bonus info */}
        {!isLogin && step === 'credentials' && (
          <div className="mt-4 text-center animate-fade-in">
            <p className="text-sm text-muted-foreground">
              🎁 <span className="text-tcoin font-semibold">100 TCoins</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
