import { useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/world/auth-store";
import { useEffect } from "react";

export const Route = createFileRoute("/sign-in")({
  ssr: false,
  validateSearch: z.object({ next: z.string().optional() }),
  component: SignInPage,
});

function SignInPage() {
  const { next } = useSearch({ from: "/sign-in" });
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) void navigate({ to: next ?? "/" });
  }, [user, next, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${next ?? "/"}` },
    });
    setBusy(false);
    if (signInError) setError(signInError.message);
    else setSent(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1d2620] px-4 text-[#e7e4d8]">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1d2620]/70 p-6 shadow-lg backdrop-blur-md">
        <h1 className="text-lg text-[#f4f1e6]">Spor</h1>
        <p className="mt-1 text-xs italic text-[#e7e4d8]/50">
          Log ind for at dele skoven med en anden — for at spille alene kræves ingen konto.
        </p>
        {sent ? (
          <p className="mt-4 text-sm text-[#e7e4d8]/80">
            Vi har sendt et login-link til <strong>{email}</strong>. Åbn det for at komme videre.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4">
            <label htmlFor="email" className="text-sm text-[#e7e4d8]/75">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="din@email.dk"
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#111813]/55 px-3 py-2 text-sm text-[#f4f1e6] outline-none placeholder:text-[#e7e4d8]/30 focus:border-white/25"
            />
            <button
              type="submit"
              disabled={busy || email.trim().length < 3}
              className="mt-3 w-full rounded-lg bg-[#e7e4d8]/18 px-3 py-2 text-sm text-[#f4f1e6] transition-colors hover:bg-[#e7e4d8]/28 disabled:opacity-40"
            >
              {busy ? "Sender…" : "Send login-link"}
            </button>
          </form>
        )}
        {error ? (
          <p role="alert" className="mt-3 text-xs text-[#f0c9b0]">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
