export const SPRING_INTERACTION =
  'transition-[transform,box-shadow,border-color,background-color,color,opacity] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform';

export const SPRING_PRESSABLE = `${SPRING_INTERACTION} hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.985]`;

export const INTERACTIVE_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/38 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]';

export const APPLE_FLAT_SURFACE =
  'shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.62)] backdrop-blur-sm dark:shadow-[0_1px_2px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]';
