// ShieldOps mark: a glass force-field dome with a honeycomb shell and a check core.
// A threat spark ricochets off the top-right while a pulse ripples through the field
// and light sweeps across the glass (all CSS in globals.css; off for reduced motion).
import { useId } from "react";
import { logoSvg } from "./logo-svg";

export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  const p = `so${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return <span role="img" aria-label="ShieldOps logo" className={`so-logo inline-block ${className}`} dangerouslySetInnerHTML={{ __html: logoSvg(p) }} />;
}
