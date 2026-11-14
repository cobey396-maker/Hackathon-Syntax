// ShieldOps logo: icon, horizontal lockup, or stacked lockup. Flat colour only.
// Change DEFAULT_LOGO_CONCEPT to switch the whole app to another concept.
import type { CSSProperties } from "react";
import { LOGO_BODIES } from "./logo-concepts";

export type LogoConcept = 1 | 2 | 3 | 4;
export type LogoVariant = "icon" | "horizontal" | "stacked";
export type LogoTheme = "light" | "dark" | "mono-light" | "mono-dark";

export const DEFAULT_LOGO_CONCEPT: LogoConcept = 3;
export const LOGO_NAME = "ShieldOps";

// p = primary, s = secondary, k = knockout (must match the surface behind the logo)
const THEMES: Record<LogoTheme, { p: string; s: string; k: string; shield: string; ops: string }> = {
  light: { p: "#049FD9", s: "#005073", k: "#F2F4F7", shield: "#07182D", ops: "#005073" },
  dark: { p: "#049FD9", s: "#00BCEB", k: "#07182D", shield: "#F2F4F7", ops: "#00BCEB" },
  "mono-light": { p: "#07182D", s: "#07182D", k: "#F2F4F7", shield: "#07182D", ops: "#07182D" },
  "mono-dark": { p: "#F2F4F7", s: "#F2F4F7", k: "#07182D", shield: "#F2F4F7", ops: "#F2F4F7" },
};

export default function ShieldOpsLogo({
  concept = DEFAULT_LOGO_CONCEPT,
  variant = "icon",
  theme = "dark",
  size = 40,
  knockout,
  className,
}: {
  concept?: LogoConcept;
  variant?: LogoVariant;
  theme?: LogoTheme;
  size?: number; // icon height in px
  knockout?: string; // overrides the theme's knockout colour to match the real background
  className?: string;
}) {
  const t = THEMES[theme];
  const alone = variant === "icon";
  const vars = { "--so-p": t.p, "--so-s": t.s, "--so-k": knockout ?? t.k, display: "block", flexShrink: 0 } as CSSProperties;

  const icon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="10 4 80 94"
      width={(size * 80) / 94}
      height={size}
      style={vars}
      className={alone ? className : undefined}
      {...(alone ? { role: "img", "aria-label": LOGO_NAME } : { "aria-hidden": true })}
      dangerouslySetInnerHTML={{ __html: LOGO_BODIES[concept] }}
    />
  );
  if (alone) return icon;

  const stacked = variant === "stacked";
  return (
    <span
      role="img"
      aria-label={LOGO_NAME}
      className={className}
      style={{ display: "inline-flex", flexDirection: stacked ? "column" : "row", alignItems: "center", gap: stacked ? 16 : size * 0.3 }}
    >
      {icon}
      <span
        aria-hidden
        style={{
          fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
          fontSize: size * (stacked ? 0.4 : 0.74),
          lineHeight: 1,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontWeight: 700, color: t.shield }}>Shield</span>
        <span style={{ fontWeight: 500, color: t.ops }}>Ops</span>
      </span>
    </span>
  );
}
