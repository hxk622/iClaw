import type { CSSProperties, ReactNode } from 'react';

const SEARCH_ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1fr)',
  gap: 14,
};

const SEARCH_WITH_OBJECT_ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1fr) minmax(0,320px)',
  gap: 14,
};

const SELECTOR_ROW_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 180px))',
  gap: 12,
};

const STACK_STYLE: CSSProperties = {
  display: 'grid',
  gap: 14,
};

const FIELD_CONTROL_STYLE: CSSProperties = {
  minHeight: 44,
};

export function AdminFilterStack({ children }: { children: ReactNode }) {
  return <div style={STACK_STYLE}>{children}</div>;
}

export function AdminSearchRow({ children }: { children: ReactNode }) {
  return <div style={SEARCH_ROW_STYLE}>{children}</div>;
}

export function AdminSearchWithObjectRow({ children }: { children: ReactNode }) {
  return <div style={SEARCH_WITH_OBJECT_ROW_STYLE}>{children}</div>;
}

export function AdminSelectorRow({ children }: { children: ReactNode }) {
  return <div style={SELECTOR_ROW_STYLE}>{children}</div>;
}

export function adminFilterControlStyle(extra?: CSSProperties): CSSProperties {
  return extra ? { ...FIELD_CONTROL_STYLE, ...extra } : FIELD_CONTROL_STYLE;
}
