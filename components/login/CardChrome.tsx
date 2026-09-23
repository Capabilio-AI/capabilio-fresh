"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Badge } from "../ui";

interface CardChromeProps {
  children: ReactNode;
  label?: string;
}

export function CardChrome({ children, label = "capabilio / auth-gateway" }: CardChromeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md overflow-hidden rounded-xl border border-lp-border-hairline bg-lp-surface-card shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-lp-border-hairline bg-lp-surface-subtle px-space-md py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-lp-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-lp-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-lp-border-strong" />
          <span className="ml-2 font-lp-mono text-lp-label-sm text-lp-text-muted">{label}</span>
        </div>
        <Badge tone="indigo">SECURE</Badge>
      </div>
      <div className="p-8">{children}</div>
    </motion.div>
  );
}
