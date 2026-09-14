import { authApi } from "@/lib/api";
import { Sparkles, LogIn, UserPlus, ShieldCheck, KeyRound, Mail, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Mode = "login" | "register" | "forgot" | "reset";

function errorMessage(error: unknown, fallback: string): string {
  return (
    (error && typeof error === "object" && "response" in error
      ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
      : undefined) ||
    (error instanceof Error ? error.message : fallback)
  );
}

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === "register") {
        await authApi.register({ name: name.trim(), email: email.trim(), password });
        toast.success("Account created.");
        setLocation("/");
      } else if (mode === "login") {
        await authApi.login({ email: email.trim(), password });
        toast.success("Welcome back.");
        setLocation("/");
      } else if (mode === "forgot") {
        const result = await authApi.forgotPassword({ email: email.trim() });
        if (result.resetCode) {
          setResetCode(result.resetCode);
          setMode("reset");
          toast.success(`Reset code generated: ${result.resetCode}`);
        } else {
          toast.success("If that email exists, a reset code has been sent.");
        }
      } else if (mode === "reset") {
        await authApi.resetPassword({ token: resetToken.trim(), password });
        toast.success("Password updated. Please log in.");
        setMode("login");
        setPassword("");
        setResetToken("");
        setResetCode("");
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Something went wrong"));
    } finally {
      setSubmitting(false);
    }
  };

  const heading =
    mode === "login" ? "Welcome sir"
    : mode === "register" ? "Start your placement journey today."
    : mode === "forgot" ? "Reset your password"
    : "Set a new password";

  const copy =
    mode === "login" ? "Log in to continue your placement journey."
    : mode === "register" ? "Save your skills, resume signal, roadmap, and role matches in one calm workspace."
    : mode === "forgot" ? "Enter your account email and we'll send a reset link."
    : "Choose a new password for your account.";

  const submitLabel =
    mode === "login" ? "Log in"
    : mode === "register" ? "Create account"
    : mode === "forgot" ? "Send reset link"
    : "Update password";

  const submitIcon =
    mode === "login" ? <LogIn size={16} />
    : mode === "register" ? <UserPlus size={16} />
    : mode === "forgot" ? <Mail size={16} />
    : <KeyRound size={16} />;

  return (
    <div className="auth-screen">
      <div className="auth-orbit auth-orbit--one" />
      <div className="auth-orbit auth-orbit--two" />
      <main className="auth-card">
        <div className="auth-card__brand">
          <div className="brand-mark"><img src="/img1.jpeg" alt="NK Care logo" /></div>
          <div>
            <strong>student care help</strong>
            <span>support for every student</span>
          </div>
        </div>
        <div className="auth-card__content">
          <p className="eyebrow eyebrow--green"><span className="status-dot" /> YOUR CAREER WORKSPACE</p>
          <h1>{heading}</h1>
          <p className="auth-card__copy">{copy}</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <label>
                Full name
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  minLength={2}
                  autoComplete="name"
                />
              </label>
            ) : null}
            {mode === "reset" ? (
              <label>
                Reset code
                <input
                  value={resetToken}
                  onChange={e => setResetToken(e.target.value)}
                  placeholder={resetCode ? `e.g. ${resetCode}` : "Enter 6-digit code"}
                  required
                  minLength={6}
                  maxLength={6}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                />
              </label>
            ) : null}
            {mode === "forgot" || mode === "login" || mode === "register" ? (
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </label>
            ) : null}
            {mode === "login" || mode === "register" || mode === "reset" ? (
              <label className="password-field">
                {mode === "reset" ? "New password" : "Password"}
                <div className="password-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={6}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            ) : null}
            <button className="primary-button auth-button" type="submit" disabled={submitting}>
              {submitIcon}
              {submitting ? "Please wait…" : submitLabel}
            </button>
            {mode === "login" ? (
              <button
                type="button"
                className="auth-forgot"
                onClick={() => { setMode("forgot"); setPassword(""); }}
              >
                Forgot password?
              </button>
            ) : null}
          </form>
          <p className="auth-note">
            {mode === "login" ? "New here? "
              : mode === "forgot" || mode === "reset" ? "Remembered it? "
              : "Already have an account? "}
            <button
              type="button"
              className="auth-switch"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setPassword("");
                setResetToken("");
              }}
            >
              {mode === "login" ? "Create an account"
                : mode === "forgot" || mode === "reset" ? "Back to log in"
                : "Log in instead"}
            </button>
          </p>
        </div>
        <div className="auth-card__footer">
          <span><ShieldCheck size={14} /> Secure sign-in</span>
          <span><Sparkles size={14} /> Personal profile</span>
        </div>
      </main>
    </div>
  );
}
