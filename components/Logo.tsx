// ShieldOps mark: a shield (defense) with a three-node path that forms a check mark,
// read left to right as investigate -> authorize -> verify. Matches app/icon.svg.
import { useId } from "react";

export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  const id = useId();
  const s = `${id}-s`;
  const c = `${id}-c`;
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="ShieldOps logo">
      <defs>
        <linearGradient id={s} x1="10" y1="4" x2="54" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00bceb" />
          <stop offset="1" stopColor="#049fd9" />
        </linearGradient>
        <linearGradient id={c} x1="18" y1="42" x2="46" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#6ee7b7" />
        </linearGradient>
      </defs>
      <path
        d="M32 6 52 13.5V30c0 13-8.6 22.6-20 27.5C20.6 52.6 12 43 12 30V13.5Z"
        fill="#0b1e36"
        stroke={`url(#${s})`}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M32 11.5 47.5 17.3V30c0 10-6.3 17.8-15.5 22.1" fill="none" stroke="#00bceb" strokeOpacity=".35" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20.5 32.5 28.5 40.5 44 24.5" fill="none" stroke={`url(#${c})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20.5" cy="32.5" r="3.2" fill="#00bceb" />
      <circle cx="28.5" cy="40.5" r="3.2" fill="#ffffff" />
      <circle cx="44" cy="24.5" r="3.2" fill="#34d399" />
    </svg>
  );
}
