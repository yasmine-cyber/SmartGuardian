import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface AnimatedStepProps {
  num: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  index: number;
  total: number;
}

export const AnimatedStep = ({
  num,
  title,
  desc,
  icon: Icon,
  index,
  total,
}: AnimatedStepProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        delay: index * 0.15,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative bg-card rounded-2xl p-7 border border-border shadow-sm hover:shadow-md transition-all group"
    >
      {/* Step number background */}
      <motion.div
        className="text-7xl font-extrabold text-primary/8 absolute top-3 right-5"
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.15 + 0.1 }}
      >
        {num}
      </motion.div>

      {/* Icon container with animated background */}
      <motion.div
        className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors"
        whileHover={{ scale: 1.1, rotate: -5 }}
        transition={{ duration: 0.3 }}
      >
        <Icon className="w-6 h-6 text-primary" />
      </motion.div>

      {/* Title */}
      <motion.h3
        className="text-lg font-bold text-card-foreground mb-2"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: index * 0.15 + 0.15 }}
      >
        {title}
      </motion.h3>

      {/* Description */}
      <motion.p
        className="text-muted-foreground text-sm leading-relaxed"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: index * 0.15 + 0.2 }}
      >
        {desc}
      </motion.p>

      {/* Connector line to next step */}
      {index < total - 1 && (
        <motion.div
          className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-primary/20 to-primary/5"
          initial={{ scaleX: 0, transformOrigin: 'left' }}
          whileInView={{ scaleX: 1 }}
          transition={{ delay: index * 0.15 + 0.4 }}
        />
      )}

      {/* Hover accent glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/0 transition-all pointer-events-none"
      />
    </motion.div>
  );
};
