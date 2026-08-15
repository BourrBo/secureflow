import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type { ApiUser } from "./api";
import { toast } from "sonner";
import { BUSINESS_EMAIL_BLOCKED_MESSAGE, isBusinessEmail } from "./businessEmail";

type OAuthProvider = "google" | "github";

type AuthContextValue = {
  user: ApiUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (b: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }) => Promise<void>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionToUser(session: Session | null): ApiUser | null {
  if (!session?.user) return null;
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = typeof meta.full_name === "string" ? meta.full_name : undefined;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    first_name:
      (typeof meta.first_name === "string" && meta.first_name) || fullName?.split(" ")[0] || "",
    last_name:
      (typeof meta.last_name === "string" && meta.last_name) ||
      fullName?.split(" ").slice(1).join(" ") ||
      "",
    avatar_url:
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    /** Personal-email accounts are rejected for every sign-in method — including
     * Google/GitHub, where there is no signup form to validate at. */
    const enforceBusinessEmail = (next: Session | null): boolean => {
      const email = next?.user?.email;
      if (!next || !email || isBusinessEmail(email)) return true;
      setSession(null);
      setLoading(false);
      void supabase.auth.signOut().finally(() => {
        toast.error(BUSINESS_EMAIL_BLOCKED_MESSAGE);
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      });
      return false;
    };

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!enforceBusinessEmail(data.session)) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;
      if (!enforceBusinessEmail(newSession)) return;
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: sessionToUser(session),
      session,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      signUp: async (b) => {
        const { error } = await supabase.auth.signUp({
          email: b.email,
          password: b.password,
          options: {
            data: { first_name: b.first_name ?? "", last_name: b.last_name ?? "" },
          },
        });
        if (error) throw new Error(error.message);
      },
      signInWithOAuth: async (provider) => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw new Error(error.message);
        // Browser navigates to the provider's consent screen here and back
        // to redirectTo afterwards — nothing left to await locally.
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
