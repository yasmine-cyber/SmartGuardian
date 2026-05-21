import { motion } from 'framer-motion';

interface CharacterRevealProps {
  text: string;
  delay?: number;
  stagger?: number;
  className?: string;
}

export const CharacterReveal = ({
  text,
  delay = 0,
  stagger = 0.05,
  className = '',
}: CharacterRevealProps) => {
  const characters = text.split('');

  return (
    <motion.div initial="hidden" animate="visible" className={className}>
      {characters.map((char, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{
            duration: 0.4,
            delay: delay + i * stagger,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {char}
        </motion.span>
      ))}
    </motion.div>
  );
};
