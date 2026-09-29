"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export function StaggerGroup({ children, className = "", as = "div" }: { children: ReactNode; className?: string; as?: any }) {
  const Component = motion(as);
  return (
    <Component
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </Component>
  );
}
