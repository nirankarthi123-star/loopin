import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  RefreshCw,
  Mail,
  Lock,
  User,
  GraduationCap,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import { FormField, ErrorMessage } from "@/components/ui/shared.tsx";
import { useAuth } from "@/lib/authContext.tsx";

export function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, confirmSignUp, signIn } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [campus, setCampus] = useState("campus-vit-chennai");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Email verification confirmation state
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid campus email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!agreed) {
      setError("You must agree to the LoopIn Campus Honor Code to join.");
      return;
    }

    setLoading(true);
    try {
      const res = await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        campusId: campus,
      });

      if (res.userConfirmed) {
        // Auto-confirmed (or demo auto-sign)
        await signIn({ email: email.trim(), password });
        navigate("/dashboard");
      } else {
        // Show verification code input step
        setNeedsConfirmation(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to register account. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!confirmationCode.trim()) {
      setError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setLoading(true);
    try {
      await confirmSignUp(email.trim(), confirmationCode.trim());
      setVerificationSuccess(true);
      // Automatically attempt sign in
      try {
        await signIn({ email: email.trim(), password });
        navigate("/dashboard");
      } catch {
        // Redirect to login if sign-in requires credentials again
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid verification code. Please check your email.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-brand">
            <RefreshCw className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold text-ink">LoopIn</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Join your campus Loop</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Connect with 300+ students sharing tools, textbooks, and gear.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card p-6 sm:p-8 space-y-6">
          {error && <ErrorMessage message={error} />}

          {verificationSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold text-ink">Account Verified!</h2>
              <p className="text-sm text-ink-muted">
                Your campus email is confirmed. Redirecting you to your dashboard...
              </p>
            </div>
          ) : needsConfirmation ? (
            <form onSubmit={handleConfirmCode} className="space-y-4" noValidate>
              <div className="text-center pb-2">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-ink">Enter Verification Code</h2>
                <p className="text-xs text-ink-muted mt-1">
                  We sent a 6-digit verification code to <strong className="text-ink">{email}</strong>. Please enter it below to activate your account.
                </p>
              </div>

              <FormField label="Verification Code" htmlFor="confirm-code" required hint="6-digit code from email">
                <input
                  id="confirm-code"
                  type="text"
                  placeholder="e.g. 123456"
                  className="input text-center text-lg tracking-widest font-mono"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  maxLength={6}
                />
              </FormField>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5 shadow-brand"
              >
                {loading ? "Verifying..." : "Confirm & Sign In"}
              </button>

              <button
                type="button"
                onClick={() => setNeedsConfirmation(false)}
                className="btn-ghost w-full justify-center text-xs text-ink-muted"
              >
                Back to registration
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <FormField label="Full Name" htmlFor="reg-name" required>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    id="reg-name"
                    type="text"
                    placeholder="e.g. Niranjna Karthikeyan"
                    className="input pl-10"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </FormField>

              <FormField
                label="Campus Institutional Email"
                htmlFor="reg-email"
                required
                hint="Requires verification code sent to your university inbox"
              >
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    id="reg-email"
                    type="email"
                    placeholder="your.name@iitm.ac.in"
                    className="input pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </FormField>

              <FormField label="Select Campus" htmlFor="reg-campus" required>
                <div className="relative">
                  <GraduationCap className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <select
                    id="reg-campus"
                    className="input pl-10"
                    value={campus}
                    onChange={(e) => setCampus(e.target.value)}
                  >
                    <option value="campus-vit-chennai">VIT Chennai (Active Campus)</option>
                    <option value="campus-iit-madras">IIT Madras (Partner Campus)</option>
                    <option value="campus-iit-delhi">IIT Delhi (Expanding)</option>
                    <option value="campus-mit">MIT (Cambridge)</option>
                  </select>
                </div>
              </FormField>

              <FormField label="Create Password" htmlFor="reg-password" required hint="At least 8 characters">
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    id="reg-password"
                    type="password"
                    placeholder="••••••••••••"
                    className="input pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </FormField>

              <div className="rounded-xl border border-surface-border bg-surface-muted p-3 text-xs text-ink-muted">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 rounded border-surface-border text-brand-600 focus:ring-brand-500"
                  />
                  <span>
                    I pledge to uphold the <strong className="text-ink">Campus Honor Code</strong>: I will take care of borrowed items, return them by the due date, and foster campus trust.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5 shadow-brand"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-ink-muted pt-2 border-t border-surface-border">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
