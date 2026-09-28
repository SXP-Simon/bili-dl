import React, { useRef, useState } from 'react';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * TweakCN 现代轻质感卡片
 * 具备柔和投影、微质感悬停与自然触控反馈
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
          ? `radial-gradient(360px circle at ${position.x}px ${position.y}px, color-mix(in oklch, var(--primary) 6%, var(--card)), var(--card))`
          : undefined,
      }}
      className={`relative overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-xs p-3.5 transition-all duration-200 hover:border-border hover:shadow-md hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 cursor-pointer ${className}`}
    >
      {children}
    </div>
  );
};
