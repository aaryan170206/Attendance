
import type { Session } from "@supabase/supabase-js";
import type { FormEvent, PointerEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./Auth.css";
import { supabase } from "./lib/supabase";

type AuthGateProps = {
  children: ReactNode;
};

type AuthStatus =
  | "loading"
  | "signed-out"
  | "checking"
  | "authorized"
  | "error";

export default function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  // Password visibility states.
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  // Reveal password only while the pointer is held down.
  function handleReveal(
    event: PointerEvent<HTMLButtonElement>,
    setVisibility: (visible: boolean) => void
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setVisibility(true);
  }

  function handleHide(
    setVisibility: (visible: boolean) => void
  ) {
    setVisibility(false);
  }

  // Restore the existing session and listen for authentication changes.
  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!active) return;

      setSession(currentSession);

      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setForgotMode(false);
        setError("");
        setSuccess("");
        setPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        setShowConfirmPassword(false);
        setStatus("signed-out");
        return;
      }

      setStatus(currentSession ? "checking" : "signed-out");
    });

    async function restoreSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setError(error.message);
        setStatus("error");
        return;
      }

      setSession(data.session);
      setStatus(data.session ? "checking" : "signed-out");
    }

    void restoreSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Verify that the authenticated user is a platform administrator.
  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
      if (!session) return;

      setStatus("checking");

      const { data, error } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setError(`Unable to verify access: ${error.message}`);
        setStatus("error");
        return;
      }

      if (!data) {
        await supabase.auth.signOut();

        if (active) {
          setSession(null);
          setError(
            "This account does not have Super Admin privileges. Contact an existing Super Admin."
          );
          setStatus("signed-out");
        }

        return;
      }

      setError("");
      setStatus("authorized");
    }

    if (session && !recoveryMode) {
      void verifyAdmin();
    }

    return () => {
      active = false;
    };
  }, [session, recoveryMode]);

  // Sign in with the existing administrator account.
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setPassword("");
    setShowPassword(false);
  }

  // Send a password recovery email.
  async function handleForgotPassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: window.location.origin,
      }
    );

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(
      "Password recovery email sent. Open the link in your email to set a new password."
    );
  }

  // Save the new password after opening the recovery link.
  async function handleUpdatePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setSubmitting(false);
      setError(error.message);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();

    setSubmitting(false);

    if (signOutError) {
      setError(
        `Your password was updated, but sign-out failed: ${signOutError.message}. Please sign out before continuing.`
      );
      return;
    }

    setRecoveryMode(false);
    setForgotMode(false);
    setSession(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);

    setSuccess(
      "Your password has been updated successfully. You can now sign in."
    );
    setStatus("signed-out");
  }

  // Reusable press-and-hold password visibility button.
  function PasswordEye({
    visible,
    setVisibility,
    label,
  }: {
    visible: boolean;
    setVisibility: (visible: boolean) => void;
    label: string;
  }) {
    return (
      <button
        type="button"
        className="auth-password-eye"
        aria-label={`Hold to reveal ${label}`}
        title={`Hold to reveal ${label}`}
        onPointerDown={(event) =>
          handleReveal(event, setVisibility)
        }
        onPointerUp={() => handleHide(setVisibility)}
        onPointerLeave={() => handleHide(setVisibility)}
        onPointerCancel={() => handleHide(setVisibility)}
        onLostPointerCapture={() => handleHide(setVisibility)}
        onContextMenu={(event) => event.preventDefault()}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    );
  }

  // Password recovery form.
  if (recoveryMode) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">AttendFlow</div>

          <div className="auth-eyebrow">ACCOUNT RECOVERY</div>

          <h1>Set new password</h1>

          <p className="auth-description">
            Create a new password for your AttendFlow Super Admin
            account.
          </p>

          <form onSubmit={handleUpdatePassword}>
            <label htmlFor="new-password">New password</label>

            <div className="auth-password-field">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter your new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />

              <PasswordEye
                visible={showPassword}
                setVisibility={setShowPassword}
                label="new password"
              />
            </div>

            <label htmlFor="confirm-password">
              Confirm new password
            </label>

            <div className="auth-password-field">
              <input
                id="confirm-password"
                type={
                  showConfirmPassword ? "text" : "password"
                }
                autoComplete="new-password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                minLength={8}
                required
              />

              <PasswordEye
                visible={showConfirmPassword}
                setVisibility={setShowConfirmPassword}
                label="confirmed password"
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button
              className="auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Updating password..." : "Update password"}
            </button>
          </form>

          <div className="auth-footer">
            Your administrator access will remain unchanged.
          </div>
        </div>
      </div>
    );
  }

  // Loading and authorization verification.
  if (status === "loading" || status === "checking") {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">AttendFlow</div>
          <p>Verifying your administrator access...</p>
        </div>
      </div>
    );
  }

  // Authorized administrators can access the dashboard.
  if (status === "authorized") {
    return <>{children}</>;
  }

  // Authorization or verification error.
  if (status === "error") {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">AttendFlow</div>

          <h1>Verification failed</h1>

          <p>{error}</p>

          <button
            className="auth-submit"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Forgot password form.
  if (forgotMode) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-brand">AttendFlow</div>

          <div className="auth-eyebrow">ACCOUNT RECOVERY</div>

          <h1>Forgot password?</h1>

          <p className="auth-description">
            Enter your administrator email address. We'll send you
            a link to reset your password.
          </p>

          <form onSubmit={handleForgotPassword}>
            <label htmlFor="recovery-email">Email address</label>

            <input
              id="recovery-email"
              type="email"
              autoComplete="username"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            {error && <div className="auth-error">{error}</div>}

            {success && (
              <div className="auth-success">{success}</div>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Sending email..." : "Send recovery link"}
            </button>
          </form>

          <button
            className="auth-text-button"
            type="button"
            onClick={() => {
              setForgotMode(false);
              setError("");
              setSuccess("");
            }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // Normal login screen.
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">AttendFlow</div>

        <div className="auth-eyebrow">PLATFORM CONTROL</div>

        <h1>Welcome back</h1>

        <p className="auth-description">
          Sign in to access the AttendFlow Super Admin dashboard.
        </p>

        <form onSubmit={handleLogin}>
          <label htmlFor="admin-email">Email address</label>

          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="admin-password">Password</label>

          <div className="auth-password-field">
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <PasswordEye
              visible={showPassword}
              setVisibility={setShowPassword}
              label="password"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          {success && (
            <div className="auth-success">{success}</div>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <button
          className="auth-text-button"
          type="button"
          onClick={() => {
            setForgotMode(true);
            setError("");
            setSuccess("");
          }}
        >
          Forgot password?
        </button>

        <div className="auth-footer">
          Authorized administrators only
        </div>
      </div>
    </div>
  );
}
