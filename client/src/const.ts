export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Navigate to the login/register page. Replaces the Manus OAuth flow.
export const startLogin = () => {
  window.location.href = "/login";
};
