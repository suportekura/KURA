// Kura Animation System
// Inspired by iOS, Linear, Stripe — short, natural, performant

import { type Variants } from 'framer-motion';

// ─── Timing Constants ───
export const DURATION = {
  micro: 0.12,
  fast: 0.18,
  normal: 0.24,
  slow: 0.3,
} as const;

// ─── Easing Curves ───
const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
const easeInOut: [number, number, number, number] = [0.45, 0, 0.55, 1];

export const EASE = {
  out: easeOut,
  inOut: easeInOut,
  spring: { type: 'spring' as const, stiffness: 400, damping: 30 },
  springGentle: { type: 'spring' as const, stiffness: 300, damping: 25 },
};

// ─── Variant Presets ───

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
};

export const slideRightVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.fast, ease: easeOut },
  },
};

export const gridStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

export const gridItem: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATION.normal, ease: easeOut },
  },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.normal, ease: easeOut },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.fast, ease: easeInOut },
  },
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.fast } },
  exit: { opacity: 0, transition: { duration: DURATION.micro } },
};

// ─── Interactive Props ───

export const tapFeedback = {
  whileTap: { scale: 0.97 },
  transition: EASE.spring,
};

export const cardInteraction = {
  whileHover: { scale: 1.02, y: -2 },
  whileTap: { scale: 0.98 },
  transition: { duration: DURATION.micro, ease: easeOut },
};

export const navInteraction = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
  transition: EASE.spring,
};
