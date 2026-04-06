import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo, useRef } from 'react';
import leafIcon from '@/assets/leaf-icon.png';
import kuraLogo from '@/assets/kura-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
  persistent?: boolean;
}

// Floating particle component
function Particle({ delay, x, y }: { delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: Math.random() * 3 + 1.5,
        height: Math.random() * 3 + 1.5,
        background: 'radial-gradient(circle, rgba(200,215,180,0.6) 0%, rgba(200,215,180,0) 70%)',
        left: `${x}%`,
        top: `${y}%`,
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.7, 0],
        scale: [0, 1.2, 0.8],
        y: [0, -20, -35],
        x: [0, (Math.random() - 0.5) * 15],
      }}
      transition={{
        duration: 1.2,
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

export function SplashScreen({ onComplete, persistent = false }: SplashScreenProps) {
  const [phase, setPhase] = useState<'intro' | 'morph' | 'done'>('intro');

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    if (persistent) return () => { document.body.style.overflow = ''; };

    // After intro animation, start morph
    const morphTimer = setTimeout(() => {
      setPhase('morph');
    }, 2200);

    // After morph completes, finish
    const doneTimer = setTimeout(() => {
      setPhase('done');
      document.body.style.overflow = '';
      onComplete();
    }, 3100); // 2200 + 900ms morph

    return () => {
      clearTimeout(morphTimer);
      clearTimeout(doneTimer);
      document.body.style.overflow = '';
    };
  }, [onComplete, persistent]);

  // Generate particles once
  const particles = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      delay: 1.4 + Math.random() * 0.4,
      x: 40 + Math.random() * 20,
      y: 40 + Math.random() * 20,
    })), []
  );

  if (phase === 'done') return null;

  const isMorphing = phase === 'morph';

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #343f2e 0%, #3a4634 60%, #2f3a29 100%)',
      }}
      animate={isMorphing ? { opacity: 0 } : { opacity: 1 }}
      transition={isMorphing ? { duration: 0.8, delay: 0.1, ease: [0.45, 0, 0.55, 1] } : {}}
    >
      {/* Grain texture overlay */}
      <motion.div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
        animate={isMorphing ? { opacity: 0 } : {}}
        transition={{ duration: 0.4 }}
      />

      {/* Vignette */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(15,20,15,0.5) 100%)',
        }}
        animate={isMorphing ? { opacity: 0 } : {}}
        transition={{ duration: 0.4 }}
      />

      {/* Glow behind "a" */}
      {!isMorphing && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(160,190,130,0.15) 0%, transparent 70%)',
            transform: 'translate(30px, -10px)',
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.3, 1.5] }}
          transition={{ delay: 1.2, duration: 1.0, ease: 'easeOut' }}
        />
      )}

      {/* Particles */}
      {!isMorphing && particles.map((p) => (
        <Particle key={p.id} delay={p.delay} x={p.x} y={p.y} />
      ))}

      {/* Logo group — morphs to top-left header position */}
      <motion.div
        className="relative flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.88, y: 12 }}
        animate={
          isMorphing
            ? {
                opacity: 0,
                scale: 0.18,
                x: '-35vw',
                y: '-42vh',
              }
            : { opacity: 1, scale: 1, y: 0, x: 0 }
        }
        transition={
          isMorphing
            ? {
                duration: 0.8,
                ease: [0.65, 0, 0.35, 1],
                opacity: { duration: 0.6, delay: 0.25 },
              }
            : {
                delay: 0.3,
                duration: 1.0,
                ease: [0.25, 0.46, 0.45, 0.94],
              }
        }
      >
        {/* "Kura" logo image */}
        <img
          src={kuraLogo}
          alt="Kura"
          className="w-80 sm:w-96 h-auto"
        />

        {/* Right leaf (appears first) */}
        <motion.div
          className="absolute overflow-hidden"
          style={{ right: '3.5%', top: '20%', width: 28, height: 28 }}
          initial={{ opacity: 0, scale: 0, rotate: -20 }}
          animate={isMorphing ? { opacity: 0, scale: 0 } : { opacity: 1, scale: 1, rotate: 0 }}
          transition={
            isMorphing
              ? { duration: 0.3 }
              : { delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }
          }
        >
          <img
            src={leafIcon}
            alt=""
            width={28}
            height={28}
            style={{ clipPath: 'inset(0 0 0 45%)' }}
          />
        </motion.div>

        {/* Left leaf (appears second) */}
        <motion.div
          className="absolute overflow-hidden"
          style={{ right: '3.5%', top: '20%', width: 28, height: 28 }}
          initial={{ opacity: 0, scale: 0, rotate: 20 }}
          animate={isMorphing ? { opacity: 0, scale: 0 } : { opacity: 1, scale: 1, rotate: 0 }}
          transition={
            isMorphing
              ? { duration: 0.3 }
              : { delay: 1.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }
          }
        >
          <img
            src={leafIcon}
            alt=""
            width={28}
            height={28}
            style={{ clipPath: 'inset(0 55% 0 0)' }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
