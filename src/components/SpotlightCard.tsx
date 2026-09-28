import React, { useRef, useState } from 'react';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  spotlightColor?: string;
}

/**
 * React Bits 风格的光斑跟随卡片 (Spotlight Card)
 * 鼠标在卡片上方移动时，呈现径向光晕追随效果
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = '',
  onClick,
  spotlightColor = 'rgba(255, 102, 153, 0.15)',
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
          ? `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`
          : undefined,
      }}
      className={`relative overflow-hidden rounded-2xl border border-white/20 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF6699]/60 hover:shadow-lg hover:shadow-pink-500/10 active:scale-[0.985] cursor-pointer ${className}`}
    >
      {children}
    </div>
  );
};
