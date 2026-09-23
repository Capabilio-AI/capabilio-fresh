"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";

export function SectionLabel({
  children,
  tone = "ochre",
}: {
  children: ReactNode;
  tone?: "ochre" | "indigo";
}) {
  return (
    <span
      className={clsx(
        "font-lp-mono text-lp-label-md font-semibold uppercase tracking-wider",
        tone === "ochre" ? "text-lp-accent-ochre" : "text-lp-accent-indigo"
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  label,
  labelTone = "ochre",
  title,
  subtitle,
  align = "left",
}: {
  label?: string;
  labelTone?: "ochre" | "indigo";
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={clsx("flex max-w-3xl flex-col gap-space-xs", align === "center" && "mx-auto text-center")}>
      {label && <SectionLabel tone={labelTone}>{label}</SectionLabel>}
      <h2 className="font-lp-display text-lp-display-mobile md:text-lp-headline-lg lg:text-lp-display tracking-tight text-lp-text-ink">
        {title}
      </h2>
      {subtitle && <p className="font-lp-body text-lp-body-lg text-lp-text-muted">{subtitle}</p>}
    </div>
  );
}

export function Reveal({
  children,
  delay = 0,
  className,
  y = 14,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Card({
  children,
  className,
  hover = true,
  emphasis = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      className={clsx(
        "lp-card rounded-lg",
        emphasis && "border-2 border-lp-text-ink shadow-md",
        hover && "transition-colors duration-200 hover:border-lp-text-ink",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  dot = true,
  className,
}: {
  children: ReactNode;
  tone?: "indigo" | "ochre" | "error" | "neutral" | "ink";
  dot?: boolean;
  className?: string;
}) {
  const tones: Record<string, string> = {
    indigo: "bg-lp-surface-subtle text-lp-accent-indigo border-lp-border-hairline",
    ochre: "bg-lp-surface-subtle text-lp-accent-ochre border-lp-border-hairline",
    error: "bg-lp-error-container text-lp-on-error-container border-transparent",
    neutral: "bg-lp-surface-subtle text-lp-text-muted border-lp-border-hairline",
    ink: "bg-lp-surface-card text-lp-text-ink border-lp-border-hairline",
  };
  const dotColor: Record<string, string> = {
    indigo: "bg-lp-accent-indigo",
    ochre: "bg-lp-accent-ochre",
    error: "bg-lp-error",
    neutral: "bg-lp-text-muted",
    ink: "bg-lp-text-ink",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-lp-mono text-lp-label-sm font-medium",
        tones[tone],
        className
      )}
    >
      {dot && <span className={clsx("h-1.5 w-1.5 rounded-full", dotColor[tone])} />}
      {children}
    </span>
  );
}

export function SkillBar({
  label,
  value,
  target,
  max = 100,
  tone = "ink",
}: {
  label: string;
  value: number;
  target?: number;
  max?: number;
  tone?: "ink" | "indigo" | "ochre" | "muted";
}) {
  const colors: Record<string, string> = {
    ink: "bg-lp-text-ink",
    indigo: "bg-lp-accent-indigo",
    ochre: "bg-lp-accent-ochre",
    muted: "bg-lp-border-strong",
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-lp-body text-lp-body-sm">
        <span className="font-medium text-lp-text-ink">{label}</span>
        <span className="font-lp-mono text-lp-text-muted">
          {value}
          {target ? ` / ${target} target` : ` / ${max}`}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-lp-surface-subtle">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${(value / max) * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={clsx("h-full rounded-full", colors[tone])}
        />
        {target && (
          <div
            className="absolute inset-y-0 w-0.5 bg-lp-accent-ochre"
            style={{ left: `${(target / max) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  href = "#",
  className,
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded bg-lp-text-ink px-6 py-3 font-lp-body text-lp-body-sm font-medium text-lp-surface-card transition-colors hover:bg-lp-inverse-surface active:scale-[0.99]",
        className
      )}
    >
      {children}
    </a>
  );
}

export function SecondaryButton({
  children,
  href = "#",
  className,
}: {
  children: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded border border-lp-border-hairline bg-lp-surface-card px-5 py-3 font-lp-body text-lp-body-sm font-medium text-lp-text-ink transition-colors hover:bg-lp-surface-subtle",
        className
      )}
    >
      {children}
    </a>
  );
}

export function StatusDot({ tone }: { tone: "indigo" | "ochre" | "error" | "neutral" }) {
  const colors: Record<string, string> = {
    indigo: "bg-lp-accent-indigo",
    ochre: "bg-lp-accent-ochre",
    error: "bg-lp-error",
    neutral: "bg-lp-border-strong",
  };
  return <span className={clsx("inline-block h-2 w-2 rounded-full", colors[tone])} />;
}
