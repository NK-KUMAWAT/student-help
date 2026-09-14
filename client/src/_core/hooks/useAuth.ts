import { authApi, queryKeys } from "@/lib/api";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.authMe,
    queryFn: authApi.me,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.authMe, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      // Ignore unauthorized errors on logout.
      if (error && typeof error === "object" && "response" in error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 401) return;
      }
      throw error;
    } finally {
      queryClient.setQueryData(queryKeys.authMe, null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
    }
  }, [logoutMutation, queryClient]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [meQuery.data, meQuery.error, meQuery.isLoading, logoutMutation.error, logoutMutation.isPending]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    if (redirectPath) {
      window.location.href = redirectPath;
    } else {
      window.location.href = "/login";
    }
  }, [redirectOnUnauthenticated, redirectPath, logoutMutation.isPending, meQuery.isLoading, state.user]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
