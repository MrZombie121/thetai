export function FloatingShapes() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Primary orb */}
      <div 
        className="floating-orb w-96 h-96 bg-primary/20 -top-20 -left-20 animate-float"
      />
      
      {/* Secondary orb */}
      <div 
        className="floating-orb w-80 h-80 bg-secondary/20 top-1/3 -right-20 animate-float-delayed"
      />
      
      {/* Accent orb */}
      <div 
        className="floating-orb w-64 h-64 bg-primary/10 bottom-20 left-1/4 animate-float"
      />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
    </div>
  );
}