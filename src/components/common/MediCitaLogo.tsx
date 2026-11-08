import { useId } from "react";

import { cn } from "@/lib/utils";

/** Isotipo MediCita: corazón con pulso y estetoscopio, degradado #0ea5e9 → #0284c7. */
export function MediCitaIcon({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const g = `mc-grad-${id}`;
  return (
    <svg viewBox="0 0 64 64" className={cn("size-9", className)} role="img" aria-label="MediCita" fill="none" width="36" height="36" style={{ maxHeight: 40, maxWidth: 40 }}>
      <defs>
        <linearGradient id={g} x1="8" y1="6" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset="0.45" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      {/* Corazón */}
      <path
        d="M32 50 C18 41 11 33 11 23.5 C11 16.5 16.5 11 23 11 C27 11 30.2 13 32 16 C33.8 13 37 11 41 11 C47.5 11 53 16.5 53 23.5 C53 33 46 41 32 50 Z"
        fill={`url(#${g})`}
        opacity="0.9"
      />
      {/* Auriculares del estetoscopio */}
      <path d="M17 8 C11 10 9 16 10 23 M47 8 C53 10 55 16 54 23" stroke={`url(#${g})`} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="18" cy="7.5" r="3" fill={`url(#${g})`} />
      <circle cx="46" cy="7.5" r="3" fill={`url(#${g})`} />
      {/* Pulso */}
      <path d="M6 29 H22 L26 21 L31 37 L35 26 L38 29 H50" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Tubo y campana */}
      <path d="M32 50 V54 C32 59 38 61 42 58 C46 55 47 50 50 47" stroke={`url(#${g})`} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="51.5" cy="43.5" r="5" stroke={`url(#${g})`} strokeWidth="3.5" fill="none" />
    </svg>
  );
}

/** Logo horizontal: isotipo + "MediCita". */
export function MediCitaLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <MediCitaIcon className="size-9 shrink-0" />
      <span className="text-xl font-extrabold tracking-tight">
        <span className="text-foreground">Medi</span>
        <span className="text-primary dark:text-sky-400">Cita</span>
      </span>
    </span>
  );
}
