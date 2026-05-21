import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { useTilt } from '@/hooks/useTilt';
import { useState } from 'react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  category?: string;
  categoryColor?: string;
  index?: number;
  emoji?: string;
}

export const FeatureCard = ({
  icon: Icon,
  title,
  description,
  category,
  categoryColor = 'text-primary',
  index = 0,
  emoji,
}: FeatureCardProps) => {
  const { ref: tiltRef, transform } = useTilt(0.5);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      ref={tiltRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative h-full"
      style={{
        transform: isHovered ? transform : 'none',
        transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all h-full overflow-hidden">
        {/* Animated top border glow */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
          initial={{ scaleX: 0, transformOrigin: 'left' }}
          whileHover={{ scaleX: 1 }}
          transition={{ duration: 0.4 }}
        />

        {/* Background gradient animate on hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100"
          transition={{ duration: 0.3 }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Category badge */}
          {category && (
            <div className="mb-4 inline-flex w-fit">
              <motion.span
                className={`text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 ${categoryColor}`}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.08 + 0.1 }}
              >
                {category}
              </motion.span>
            </div>
          )}

          {/* Icon container with animated background */}
          <motion.div
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4 group-hover:from-primary/25 group-hover:to-primary/10 transition-colors"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ duration: 0.3 }}
          >
            <Icon className="w-6 h-6 text-primary" />
          </motion.div>

          {/* Title with animated checkmark */}
          <div className="flex items-start gap-2 mb-3">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              transition={{ delay: index * 0.08 + 0.15 }}
              className="flex-shrink-0 mt-1"
            >
              <svg
                className="w-4 h-4 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                viewBox="0 0 24 24"
              >
                <motion.path
                  d="M5 13l4 4L19 7"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  transition={{
                    delay: index * 0.08 + 0.2,
                    duration: 0.5,
                  }}
                />
              </svg>
            </motion.div>
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed flex-grow">
            {description}
          </p>

          {/* Emoji (optional) */}
          {emoji && (
            <motion.div
              className="mt-4 text-3xl"
              whileHover={{ scale: 1.2, rotate: -10 }}
              transition={{ duration: 0.3 }}
            >
              {emoji}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
