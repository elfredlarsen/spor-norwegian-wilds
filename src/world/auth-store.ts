import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthStore = {
  session: Session | null;
  user: User | null;
  /** True until the first getSession() resolves, so we don't flash the sign-in screen. */
  loading: boolean;
  setSession: (session: Session | null) => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  loading: true,
  setSession: (session) => set({ session, user: session?.user ?? null, loading: false }),
}));

let started = false;

/** Call once, near the app root. Keeps the store in sync with Supabase's own session state. */
export function startAuthListener() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.getSession().then(({ data }) => useAuthStore.getState().setSession(data.session));
  supabase.auth.onAuthStateChange((_event, session) => useAuthStore.getState().setSession(session));
}
