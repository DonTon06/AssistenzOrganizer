import Link from "next/link";
import { signOut } from "@/app/actions";

export function AppHeader() {
  return (
    <header className="border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-14 w-full max-w-xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold">
          Assistenz-Planer
        </Link>
        <form action={signOut}>
          <button type="submit" className="min-h-12 px-2 font-semibold text-brand underline">
            Abmelden
          </button>
        </form>
      </div>
    </header>
  );
}
