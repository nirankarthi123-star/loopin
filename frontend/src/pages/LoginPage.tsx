import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  RefreshCw,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { FormField, ErrorMessage } from "@/components/ui/shared.tsx";
import { useAuth } from "@/lib/authContext.tsx";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Please enter your campus email address.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setSubmitting(true);
    try {
      await signIn({ email: email.trim(), password });
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in. Please verify credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signIn({
        email: "niranjna.karthikeyan@vit.ac.in",
        password: "DemoPassword123!",
      });
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in as demo student.");
    } finally {
      setSubmitting(false);
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
        <h1 className="text-2xl font-bold tracking-tight text-ink">Sign in to your campus account</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Need it? Loop it. Borrow and lend across your university quad.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card p-6 sm:p-8 space-y-6">
          {/* Quick Demo One-Click Access */}
          <div className="rounded-xl border border-brand-200/70 bg-brand-50/70 p-4">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-brand-900">Project Review & Demo Mode</p>
                <p className="text-[11px] text-brand-700 leading-relaxed">
                  Click below to quickly enter as Niranjna Karthikeyan (VIT Chennai, 87 TrustScore).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={submitting}
              className="mt-3 w-full btn-primary text-xs py-2 justify-center shadow-brand-sm"
            >
              Enter as Demo Student
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-ink-subtle">Or continue with Cognito email</span>
            </div>
          </div>

          {error && <ErrorMessage message={error} />}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <FormField
              label="Campus Institutional Email"
              htmlFor="login-email"
              hint="Use your .ac.in or .edu university address"
            >
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input
                  id="login-email"
                  type="email"
                  placeholder="student@iitm.ac.in"
                  className="input pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </FormField>

            <FormField label="Password" htmlFor="login-password">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••••••"
                  className="input pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </FormField>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-ink-muted">
                <input type="checkbox" className="rounded border-surface-border text-brand-600 focus:ring-brand-500" />
                Remember this device
              </label>
              <a href="#" className="font-medium text-brand-600 hover:text-brand-700">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center py-2.5"
            >
              {submitting ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-ink-muted pt-2 border-t border-surface-border">
            Don&apos;t have an account yet?{" "}
            <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Create campus account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
