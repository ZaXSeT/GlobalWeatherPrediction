"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Fades and lifts its children into view once. Honours the operating-system
 * "reduce motion" preference by rendering the content statically instead.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  immediate = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Animate on mount rather than when scrolled into view (use above the fold). */
  immediate?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;

  const hidden = { opacity: 0, y: 16 };
  const shown = { opacity: 1, y: 0 };
  const tx = { duration: 0.5, delay, ease: "easeOut" as const };

  if (immediate) {
    return (
      <motion.div className={className} initial={hidden} animate={{ ...shown, transition: tx }}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={hidden}
      whileInView={{ ...shown, transition: tx }}
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}

