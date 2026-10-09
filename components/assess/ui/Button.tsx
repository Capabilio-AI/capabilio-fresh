import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "accent";
type Size = "md" | "lg";

const BASE = "group relative inline-flex select-none items-center justify-center gap-2 rounded-full font-bold transition-[transform,box-shadow,background-color,color,opacity] duration-200 ease-out focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.97] motion-reduce:transition-none";
const VARIANT: Record<Variant, string> = {
  primary: "bg-[var(--m-ink)] text-white shadow-[0_14px_26px_-14px_rgb(23_19_31/0.8),inset_0_1px_0_rgb(255_255_255/0.18)] hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-14px_rgb(23_19_31/0.85),inset_0_1px_0_rgb(255_255_255/0.22)] disabled:hover:translate-y-0",
  accent: "bg-[var(--m-accent)] text-white shadow-[0_14px_26px_-12px_var(--m-accent),inset_0_1px_0_rgb(255_255_255/0.3)] hover:-translate-y-0.5 hover:brightness-105 disabled:hover:translate-y-0",
  secondary: "a-glass-soft text-[var(--m-ink)] hover:-translate-y-0.5 hover:bg-white/75 disabled:hover:translate-y-0",
  ghost: "text-[var(--m-muted)] hover:bg-white/55 hover:text-[var(--m-ink)]",
};
const SIZE: Record<Size, string> = { md: "px-5 py-2.5 text-[14px]", lg: "px-7 py-3.5 text-[15.5px]" };

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconAfter?: ReactNode;
  /** keyboard hint shown on the right, e.g. "Enter" */
  hint?: string;
}

export function Button({ variant = "primary", size = "md", loading, icon, iconAfter, hint, className = "", children, disabled, ...rest }: Props) {
  return (
    <button type="button" disabled={disabled || loading} className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
      {iconAfter && !loading ? <span className="transition-transform duration-200 group-hover:translate-x-0.5">{iconAfter}</span> : null}
      {hint && <kbd className="ml-1 hidden rounded-md bg-white/15 px-1.5 py-0.5 font-sans text-[11px] font-bold tracking-wide sm:inline">{hint}</kbd>}
    </button>
  );
}
