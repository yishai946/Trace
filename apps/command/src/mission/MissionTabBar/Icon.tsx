import type { ReactNode } from 'react';

/** Icons from wireframe Cm04: 24 viewBox, 1.8 stroke, shown at 20px. */
export function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
