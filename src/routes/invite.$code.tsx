import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/world/auth-store";
import { acceptInvite } from "@/world/pairing.functions";

export const Route = createFileRoute("/invite/$code")({
  ssr: false,
  component: InvitePage,
});

function InvitePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading || !user || busy) return;
    setBusy(true);
    acceptInvite({ data: { code } })
      .then(() => navigate({ to: "/" }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Invitationen kunne ikke tages imod."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, code]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1d2620] px-4 text-[#e7e4d8]">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1d2620]/70 p-6 text-center shadow-lg backdrop-blur-md">
        <h1 className="text-lg text-[#f4f1e6]">En invitation til skoven</h1>
        {!user ? (
          <p className="mt-3 text-sm text-[#e7e4d8]/70">
            Log ind for at tage imod invitationen —{" "}
            <a href={`/sign-in?next=/invite/${code}`} className="underline">
              log ind her
            </a>
            .
          </p>
        ) : error ? (
          <p role="alert" className="mt-3 text-sm text-[#f0c9b0]">
            {error}
          </p>
        ) : (
          <p className="mt-3 text-sm text-[#e7e4d8]/70">Slipper ind i skoven…</p>
        )}
      </div>
    </main>
  );
}
