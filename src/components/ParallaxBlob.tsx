import { useParallax } from '@/hooks/useParallax';

interface ParallaxBlobProps {
  speed: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: number;
  color: string;
  delay?: number;
  blurAmount?: number;
}

export const ParallaxBlob = ({
  speed,
  position,
  size,
  color,
  delay = 0,
  blurAmount = 140,
}: ParallaxBlobProps) => {
  const { ref, offset } = useParallax(speed);

  const positionClasses = {
    'top-left': `top-[${-size / 2}px] left-[${-size / 2}px]`,
    'top-right': `top-[${-size / 4}px] right-[${-size / 2}px]`,
    'bottom-left': `bottom-[${-size / 4}px] left-[${-size / 3}px]`,
    'bottom-right': `bottom-[${-size / 3}px] right-[${-size / 3}px]`,
  };

  return (
    <div
      ref={ref}
      className="absolute rounded-full opacity-50 will-change-transform"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: color,
        filter: `blur(${blurAmount}px)`,
        transform: `translateY(${offset}px)`,
        animationDelay: `${delay}s`,
      }}
    />
  );
};
