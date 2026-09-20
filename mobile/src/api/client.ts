import axios from "axios";
import { API_URL } from "../config";
import { clearSessionToken, getSessionToken } from "./session";
import { UNAUTHED_ERR_MSG } from "./types";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  // The web app uses an httpOnly cookie; mobile sends the same JWT as a
  // Bearer token (see server/auth.ts getBearerToken).
  withCredentials: true,
});

api.interceptors.request.use(async config => {
  const token = await getSessionToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler;
}

api.interceptors.response.use(
  response => response,
  async error => {
    if (axios.isAxiosError(error)) {
      const serverMessage = error.response?.data?.error;
      if (typeof serverMessage === "string" && serverMessage) {
        error.message = serverMessage;
      } else if (error.code === "ECONNABORTED" || error.message === "Network Error") {
        error.message = "Can't reach the server. Check your internet connection and try again.";
      }
      const isUnauthorized =
        error.response?.status === 401 || error.response?.data?.error === UNAUTHED_ERR_MSG;
      if (isUnauthorized) {
        await clearSessionToken();
        onSessionExpired?.();
      }
    }
    return Promise.reject(error);
  },
);
