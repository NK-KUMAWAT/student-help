import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { authApi, queryKeys } from "../api";
import { clearSessionToken } from "../api/session";

export function useAuth() {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.authMe,
    queryFn: authApi.me,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
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
        if (status !== 401) throw error;
      }
    } finally {
      await clearSessionToken();
      queryClient.clear();
      queryClient.setQueryData(queryKeys.authMe, null);
    }
  }, [logoutMutation, queryClient]);

  const state = useMemo(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    }),
    [meQuery.data, meQuery.error, meQuery.isLoading, logoutMutation.error, logoutMutation.isPending],
  );

  return { ...state, refresh: () => meQuery.refetch(), logout };
}
