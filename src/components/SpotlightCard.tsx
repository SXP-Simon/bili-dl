import React, { useRef, useState } from 'react';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * 丝滑光斑与物理微质感卡片
 * 具备缓慢进入/缓慢消散（Slow Activation & Slow Fade-out）的径向光晕、边界呼吸高光与按下微回弹
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
      className={`relative overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground p-3.5 shadow-2xs transition-[transform,box-shadow,border-color] duration-350 ease-out hover:border-primary/50 hover:shadow-[0_8px_24px_-4px_rgba(140,230,80,0.18),0_2px_8px_-2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 active:scale-[0.985] active:translate-y-0 cursor-pointer group select-none ${className}`}
    >
      {/* 独立光斑渲染层：进入时柔和显现，离开后缓慢消除（500ms 缓退），极具呼吸层次感 */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(460px circle at ${position.x}px ${position.y}px, color-mix(in oklch, var(--primary) 14%, transparent), transparent 75%)`,
          willChange: 'opacity',
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
};
