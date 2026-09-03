import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createApiDataSource } from "./api-data-source";
import type { AccountDeletionStatus } from "./account-data-source";
import { useAuth } from "./auth-context";
import type { Locale } from "./i18n";

type AccountLifecycleValue = {
  loading: boolean;
  error: string | null;
  status: AccountDeletionStatus | null;
  refresh: () => Promise<void>;
  acceptLegalTerms: (
    locale: Locale,
  ) => Promise<{ success: true } | { success: false; error: string }>;
  cancelDeletion: () => Promise<{ success: true } | { success: false; error: string }>;
};

const AccountLifecycleContext = createContext<AccountLifecycleValue | null>(null);

export function AccountLifecycleProvider({ children }: { children: ReactNode }) {
  const { loading: authLoading, session } = useAuth();
  const dataSource = useMemo(() => createApiDataSource(), []);
  const [status, setStatus] = useState<AccountDeletionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!session) {
      setStatus(null);
      return;
    }
    setLoading(true);
    const result = await dataSource.getAccountDeletionStatus();
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setStatus(result.data);
    setError(null);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setStatus(null);
      setError(null);
      setLoading(false);
      return;
    }
    void refresh();
    // A new authenticated subject must always receive a fresh lifecycle state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session?.user.id]);

  const value = useMemo<AccountLifecycleValue>(
    () => ({
      // Fail closed during the render between Auth resolving and the lifecycle
      // request effect starting, so protected content never flashes briefly.
      loading: authLoading || Boolean(session && !status && !error) || loading,
      error,
      status,
      refresh,
      acceptLegalTerms: async (locale) => {
        const result = await dataSource.acceptLegalTerms(locale);
        if (!result.success) return result;
        setStatus(result.data);
        setError(null);
        return { success: true };
      },
      cancelDeletion: async () => {
        const result = await dataSource.cancelAccountDeletion();
        if (!result.success) return result;
        await refresh();
        return { success: true };
      },
    }),
    // `refresh` intentionally follows the current authenticated session captured by this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authLoading, dataSource, error, loading, status, session],
  );

  return (
    <AccountLifecycleContext.Provider value={value}>{children}</AccountLifecycleContext.Provider>
  );
}

export function useAccountLifecycle() {
  const context = useContext(AccountLifecycleContext);
  if (!context) throw new Error("useAccountLifecycle must be used inside AccountLifecycleProvider");
  return context;
}
