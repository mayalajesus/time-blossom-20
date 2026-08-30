import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authClient, isAuthConfigured } from "./auth-client";
import { resetSessionDefaultAvatar } from "./default-avatar";

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isAuthConfigured);

  useEffect(() => {
    if (!authClient) {
      setLoading(false);
      return;
    }

    let mounted = true;
    void authClient.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data } = authClient.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_IN") resetSessionDefaultAvatar();
      if (mounted) setSession(nextSession);
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ configured: isAuthConfigured, loading, session }),
    [loading, session],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
