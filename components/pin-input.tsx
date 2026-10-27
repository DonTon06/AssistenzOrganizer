"use client";

import { useState } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A 6-digit PIN field with a large on-screen keypad. The keypad helps people
 * who find small keys hard to hit; the field itself works with the phone's
 * keyboard, screen readers and voice control.
 */
export function PinInput({
  id,
  name,
  label,
  autoComplete = "current-password",
  invalid,
  autoFocus,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete?: "current-password" | "new-password";
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");

  const press = (digit: string) => setValue((v) => (v.length < 6 ? v + digit : v));
  const remove = () => setValue((v) => v.slice(0, -1));

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="text-base font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="min-h-14 rounded-xl border-2 border-border bg-background px-4 text-center font-mono text-3xl tracking-[0.5em]"
      />
      <div className="grid grid-cols-3 gap-3" role="group" aria-label={`Ziffernfeld für ${label}`}>
        {KEYS.map((k) => (
          <PadKey key={k} onClick={() => press(k)} label={k} />
        ))}
        <PadKey onClick={() => setValue("")} label="Leeren" text="C" />
        <PadKey onClick={() => press("0")} label="0" />
        <PadKey onClick={remove} label="Letzte Ziffer löschen" text="⌫" />
      </div>
    </div>
  );
}

function PadKey({ onClick, label, text }: { onClick: () => void; label: string; text?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="min-h-16 rounded-2xl border-2 border-border bg-background text-2xl font-semibold active:bg-surface"
    >
      {text ?? label}
    </button>
  );
}
