import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface PaymentSuccessModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onContinue: () => void;
}

export function PaymentSuccessModal({
  open,
  title = 'Pagamento confirmado!',
  description = 'Seu pagamento foi processado com sucesso.',
  onContinue,
}: PaymentSuccessModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              className="w-full max-w-sm bg-background rounded-3xl shadow-2xl border border-border/20 overflow-hidden"
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320, delay: 0.05 }}
            >
              <div className="flex flex-col items-center px-8 pt-10 pb-8 gap-5">

                {/* Animated check circle */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 16, stiffness: 280, delay: 0.15 }}
                  className="relative flex items-center justify-center"
                >
                  {/* Glow ring */}
                  <motion.div
                    className="absolute w-24 h-24 rounded-full bg-green-500/10"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.4, opacity: 0 }}
                    transition={{ delay: 0.5, duration: 0.6, ease: 'easeOut' }}
                  />

                  {/* SVG animated check */}
                  <svg
                    width="88"
                    height="88"
                    viewBox="0 0 88 88"
                    fill="none"
                    className="drop-shadow-sm"
                  >
                    {/* Background circle */}
                    <circle cx="44" cy="44" r="44" className="fill-green-50 dark:fill-green-950/40" />

                    {/* Animated circle border */}
                    <motion.circle
                      cx="44"
                      cy="44"
                      r="36"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      fill="none"
                      strokeLinecap="round"
                      className="text-green-500"
                      initial={{ pathLength: 0, rotate: -90 }}
                      animate={{ pathLength: 1, rotate: -90 }}
                      style={{ originX: '44px', originY: '44px', rotate: -90 }}
                      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
                    />

                    {/* Animated checkmark */}
                    <motion.path
                      d="M28 44 L39 55 L60 33"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      className="text-green-500"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.55 }}
                    />
                  </svg>
                </motion.div>

                {/* Text */}
                <motion.div
                  className="flex flex-col items-center gap-1.5 text-center"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.3 }}
                >
                  <h2 className="text-xl font-semibold text-foreground">{title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </motion.div>

                {/* Button */}
                <motion.div
                  className="w-full"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.85, duration: 0.3 }}
                >
                  <Button
                    onClick={onContinue}
                    className="w-full rounded-xl h-12 text-base font-medium"
                  >
                    Continuar
                  </Button>
                </motion.div>

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
