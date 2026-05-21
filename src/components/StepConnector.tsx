import { motion } from 'framer-motion';

interface StepConnectorProps {
  stepCount: number;
  activeStep?: number;
}

export const StepConnector = ({ stepCount, activeStep = 0 }: StepConnectorProps) => {
  // Calculate the animated progress
  const progress = (activeStep / (stepCount - 1)) * 100;

  return (
    <motion.div className="hidden md:block absolute top-20 left-0 right-0 h-1 bg-primary/10 rounded-full overflow-hidden">
      {/* Progress bar that animates with scroll */}
      <motion.div
        className="h-full bg-gradient-to-r from-transparent via-primary to-transparent"
        initial={{ width: '0%' }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />

      {/* Glow effect on progress bar */}
      <motion.div
        className="absolute h-full w-8 bg-primary/20 blur-lg"
        initial={{ left: '-100%' }}
        animate={{ left: `${progress}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </motion.div>
  );
};
