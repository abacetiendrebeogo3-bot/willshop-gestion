"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function StaggerItem({ children, className = "", as = "div", ...props }: { children: ReactNode; className?: string; as?: any; [x: string]: any }) {
  const Component = motion(as);
  return (
    <Component variants={itemVariants} className={className} {...props}>
      {children}
    </Component>
  );
}
