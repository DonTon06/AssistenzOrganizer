import type { ComponentProps, ReactNode } from "react";

// Shared building blocks. Tap targets are at least 48px high and text sizes
// are in rem so the layout follows the user's font size.

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main id="inhalt" className="mx-auto w-full max-w-xl flex-1 px-4 pb-12 pt-6">
      {children}
    </main>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </section>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-brand text-brand-foreground"
      : "border-2 border-brand text-brand bg-transparent";
  return (
    <button
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl px-5 text-lg font-semibold disabled:opacity-60 ${styles} ${className}`}
      {...props}
    />
  );
}

export function TextField({
  label,
  hint,
  id,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; id: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-base font-semibold">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hinweis`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        aria-describedby={hint ? `${id}-hinweis` : undefined}
        className="min-h-12 rounded-xl border-2 border-border bg-background px-4 text-lg"
        {...props}
      />
    </div>
  );
}

export function FormMessage({ error, children }: { error?: boolean; children: ReactNode }) {
  return (
    <p role={error ? "alert" : "status"} className={error ? "font-semibold text-danger" : ""}>
      {children}
    </p>
  );
}

/** A small label. Each tone also differs in text, never in colour alone. */
export function Badge({
  tone = "muted",
  children,
}: {
  tone?: "ok" | "open" | "gap" | "late" | "muted";
  children: ReactNode;
}) {
  const styles = {
    ok: "bg-ok-surface text-ok",
    open: "bg-surface text-foreground border border-border",
    gap: "bg-gap-surface text-gap",
    late: "bg-late-surface text-late",
    muted: "bg-surface text-muted border border-border",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-semibold ${styles}`}>
      {children}
    </span>
  );
}
