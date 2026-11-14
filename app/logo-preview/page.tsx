// Dev-only logo gallery: every concept, variant and theme. Not linked from the nav; 404s in production.
import { notFound } from "next/navigation";
import ShieldOpsLogo, { DEFAULT_LOGO_CONCEPT, type LogoConcept, type LogoTheme, type LogoVariant } from "@/components/ShieldOpsLogo";
import { LOGO_NAMES } from "@/components/logo-concepts";

const CONCEPTS: LogoConcept[] = [1, 2, 3, 4];
const VARIANTS: LogoVariant[] = ["icon", "horizontal", "stacked"];
const SURFACES: { theme: LogoTheme; bg: string; fg: string }[] = [
  { theme: "light", bg: "#F2F4F7", fg: "#07182D" },
  { theme: "dark", bg: "#07182D", fg: "#F2F4F7" },
];

export default function LogoPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">ShieldOps logo preview</h1>
        <p className="text-muted">
          Default concept: {DEFAULT_LOGO_CONCEPT} ({LOGO_NAMES[DEFAULT_LOGO_CONCEPT]}). Change <code>DEFAULT_LOGO_CONCEPT</code> in <code>components/ShieldOpsLogo.tsx</code>.
        </p>
      </div>
      {CONCEPTS.map((c) => (
        <section key={c} className="space-y-3">
          <h2 className="text-lg font-semibold">
            {c}. {LOGO_NAMES[c]}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {SURFACES.map((s) => (
              <div key={s.theme} className="space-y-6 overflow-x-auto rounded-xl border p-6" style={{ background: s.bg, color: s.fg }}>
                <div className="flex flex-wrap items-center gap-8">
                  {VARIANTS.map((v) => (
                    <ShieldOpsLogo key={v} concept={c} variant={v} theme={s.theme} size={v === "stacked" ? 64 : 40} />
                  ))}
                </div>
                <div className="flex items-end gap-6 text-xs">
                  {[32, 16].map((px) => (
                    <span key={px} className="flex flex-col items-center gap-1.5">
                      <ShieldOpsLogo concept={c} theme={s.theme} size={px} />
                      {px}px
                    </span>
                  ))}
                  {(["mono-light", "mono-dark"] as const)
                    .filter((m) => m.endsWith(s.theme))
                    .map((m) => (
                      <span key={m} className="flex flex-col items-center gap-1.5">
                        <ShieldOpsLogo concept={c} theme={m} size={32} />
                        mono
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
