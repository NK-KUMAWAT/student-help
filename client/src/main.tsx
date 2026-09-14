import { api } from "@/lib/api";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!axios.isAxiosError(error)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized =
    error.response?.status === 401 ||
    error.response?.data?.error === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Avoid redirect loop on the login page itself.
  if (window.location.pathname === "/login") return;
  window.location.href = "/login";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Add a response interceptor to surface a friendly message for 401s.
api.interceptors.response.use(
  response => response,
  error => {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      error.message = error.response.data.error;
    }
    return Promise.reject(error);
  },
);

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
