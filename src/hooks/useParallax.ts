import { useEffect, useRef, useState } from 'react';

export const useParallax = (speed: number = 0.5) => {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;

      const scrollTop = window.scrollY;
      const elementTop = ref.current.getBoundingClientRect().top + scrollTop;
      const distance = scrollTop - elementTop;

      setOffset(distance * speed);
    };

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(handleScroll);
        ticking = true;
      }
      ticking = false;
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [speed]);

  return { ref, offset };
};
