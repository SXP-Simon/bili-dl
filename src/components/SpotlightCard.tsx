import React, { useRef, useState } from 'react';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * 丝滑光斑与物理微质感卡片
 * 具备顺滑的进入/离开缓动（Cubic-bezier Spring）、边界呼吸高光与按下回弹
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        background: isHovered
          ? `radial-gradient(420px circle at ${position.x}px ${position.y}px, color-mix(in oklch, var(--primary) 12%, var(--card)), var(--card))`
          : undefined,
      }}
      className={`relative overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground p-3.5 shadow-2xs transition-all duration-250 ease-out hover:border-primary/50 hover:shadow-[0_8px_24px_-4px_rgba(140,230,80,0.18),0_2px_8px_-2px_rgba(0,0,0,0.04)] hover:-translate-y-1 active:scale-[0.985] active:translate-y-0 active:shadow-2xs cursor-pointer group select-none ${className}`}
    >
      {children}
    </div>
  );
};
