import { useEffect, useRef } from 'react';

export function FloatingShapes() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const shapes = container.querySelectorAll('.shape');
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      shapes.forEach((shape, i) => {
        const factor = (i + 1) * 0.5;
        const translateX = (x - 0.5) * 30 * factor;
        const translateY = (y - 0.5) * 30 * factor;
        (shape as HTMLElement).style.transform = `translate(${translateX}px, ${translateY}px)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Primary orb */}
      <div 
        className="shape floating-orb w-96 h-96 bg-primary/20 -top-20 -left-20 animate-float"
        style={{ animationDelay: '0s' }}
      />
      
      {/* Secondary orb */}
      <div 
        className="shape floating-orb w-80 h-80 bg-secondary/20 top-1/3 -right-20 animate-float-delayed"
        style={{ animationDelay: '2s' }}
      />
      
      {/* Accent orb */}
      <div 
        className="shape floating-orb w-64 h-64 bg-primary/10 bottom-20 left-1/4 animate-float"
        style={{ animationDelay: '4s' }}
      />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      
      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
      }} />
    </div>
  );
}
