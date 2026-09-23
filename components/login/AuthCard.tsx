"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";
import { CardChrome } from "./CardChrome";
import { RoleSelector } from "./RoleSelector";
import { PasswordField } from "./PasswordField";
import { AuthErrorBanner } from "./AuthErrorBanner";
import { ForgotPasswordModal } from "./ForgotPasswordModal";
import { InstitutionPicker } from "./InstitutionPicker";
import { GoogleIcon } from "./GoogleIcon";
import {
  AuthOutcome,
  Institution,
  portalFor,
  resendVerificationEmail,
  signIn,
  signInWithGoogle,
} from "./auth";
import { RoleId } from "./roles";

type ErrorStatus = Exclude<AuthOutcome["status"], "success">;

// Only the student flow has a real destination built (the assessment).
// Every other role's portal doesn't exist yet — this app has never had
// staff/institution pages, so route() returning null means "not built
// yet", not a bug to silently paper over with a fake redirect.
function routeFor(role: RoleId): string | null {
  return role === "student" ? "/assessment" : null;
}

function AuthModals({
  forgotOpen,
  onForgotClose,
  institutions,
  institutionPickerName,
  onInstitutionsClose,
  onInstitutionsContinue,
}: {
  forgotOpen: boolean;
  onForgotClose: () => void;
  institutions: Institution[] | null;
  institutionPickerName: string;
  onInstitutionsClose: () => void;
  onInstitutionsContinue: (institution: Institution) => void;
}) {
  return (
    <>
      <ForgotPasswordModal open={forgotOpen} onClose={onForgotClose} />
      {institutions && (
        <InstitutionPicker
          open={Boolean(institutions)}
          name={institutionPickerName}
          institutions={institutions}
          onClose={onInstitutionsClose}
          onContinue={onInstitutionsContinue}
        />
      )}
    </>
  );
}

export function AuthCard() {
  const router = useRouter();
  const [role, setRole] = useState<RoleId>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [authError, setAuthError] = useState<ErrorStatus | undefined>();
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[] | null>(null);
  const [pendingRole, setPendingRole] = useState<RoleId | null>(null);
  const [pendingName, setPendingName] = useState<string>("there");
  const [redirectPortal, setRedirectPortal] = useState<string | null>(null);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    if (redirectPath) router.push(redirectPath);
  }, [redirectPath, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(undefined);
    setLoading(true);

    const outcome = await signIn(email, password);
    setLoading(false);

    if (outcome.status !== "success") {
      setAuthError(outcome.status);
      return;
    }

    if (outcome.institutions.length > 1) {
      setPendingRole(outcome.resolvedRole);
      setPendingName(outcome.fullName?.split(" ")[0] || "there");
      setInstitutions(outcome.institutions);
      return;
    }

    setRedirectPortal(portalFor(outcome.resolvedRole));
    setRedirectPath(routeFor(outcome.resolvedRole));
  };

  const handleResend = async () => {
    setResendState("sending");
    await resendVerificationEmail(email);
    setResendState("sent");
  };

  if (redirectPortal) {
    return (
      <CardChrome>
        <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
          {redirectPath ? (
            <>
              <Loader2 size={22} className="animate-spin text-lp-accent-indigo" />
              <p className="mt-4 font-lp-body text-lp-body-sm font-medium text-lp-on-surface-variant">
                Redirecting to {redirectPortal}…
              </p>
            </>
          ) : (
            <p className="font-lp-body text-lp-body-sm font-medium text-lp-on-surface-variant">
              {redirectPortal} isn&apos;t available yet — you&apos;re signed in, but this role's
              workspace hasn&apos;t been built.
            </p>
          )}
        </div>
      </CardChrome>
    );
  }

  return (
    <>
      <CardChrome>
        <h1 className="font-lp-display text-lp-headline-md font-semibold tracking-tight text-lp-text-ink">
          Welcome back
        </h1>
        <p className="mt-1.5 font-lp-body text-lp-body-sm text-lp-text-muted">
          Sign in to continue your Capabilio journey.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5" noValidate>
          <RoleSelector value={role} onChange={setRole} />

          {authError && (
            <AuthErrorBanner
              status={authError}
              onResendVerification={authError === "unverified" ? handleResend : undefined}
            />
          )}
          {resendState === "sent" && (
            <p className="font-lp-mono text-lp-label-sm text-lp-accent-indigo">
              Verification email sent — check your inbox.
            </p>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-2 block font-lp-body text-lp-body-sm font-medium text-lp-on-surface-variant"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              className="w-full rounded border border-lp-border-hairline bg-lp-surface-card px-4 py-3 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted transition-colors focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
            />
          </div>

          <div>
            <PasswordField value={password} onChange={setPassword} />
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="mt-2 font-lp-mono text-lp-label-sm font-medium text-lp-text-muted underline-offset-2 hover:text-lp-accent-indigo hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <label className="flex items-center gap-2.5 font-lp-body text-lp-body-sm text-lp-on-surface-variant">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-lp-border-strong bg-lp-surface-card text-lp-accent-indigo accent-[var(--lp-accent-indigo)] focus:ring-2 focus:ring-lp-accent-indigo/25"
            />
            Remember me
          </label>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded bg-lp-text-ink py-3.5 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-lp-border-hairline" />
          <span className="font-lp-mono text-lp-label-sm tracking-wide text-lp-text-muted">OR</span>
          <span className="h-px flex-1 bg-lp-border-hairline" />
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="flex w-full items-center justify-center gap-2.5 rounded border border-lp-border-hairline bg-lp-surface-card py-3 font-lp-body text-lp-body-sm font-medium text-lp-text-ink transition-colors hover:bg-lp-surface-subtle"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            type="button"
            disabled
            title="Institution SSO is configured per-organization. Contact your institution admin to enable it."
            className="flex w-full items-center justify-center gap-2.5 rounded border border-lp-border-hairline bg-lp-surface-card py-3 font-lp-body text-lp-body-sm font-medium text-lp-text-ink opacity-60 transition-colors disabled:cursor-not-allowed"
          >
            <Lock size={15} className="text-lp-text-muted" />
            Continue with College / Institution SSO
          </button>
        </div>

        <p className="mt-6 text-center font-lp-body text-lp-body-sm text-lp-text-muted">
          Don&apos;t have a Capabilio account?{" "}
          <a href="/signup" className="font-medium text-lp-accent-indigo hover:underline">
            Create an account
          </a>
        </p>

        <div className="mt-7 border-t border-lp-border-hairline pt-5">
          <p className="flex items-start gap-2 font-lp-mono text-lp-label-sm leading-relaxed text-lp-text-muted">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-lp-text-muted" aria-hidden="true" />
            Your career journey, skills, projects, and verified work — securely connected in one
            place.
          </p>
        </div>
      </CardChrome>

      <AuthModals
        forgotOpen={forgotOpen}
        onForgotClose={() => setForgotOpen(false)}
        institutions={institutions}
        institutionPickerName={pendingName}
        onInstitutionsClose={() => setInstitutions(null)}
        onInstitutionsContinue={(institution) => {
          setInstitutions(null);
          setRedirectPortal(`${institution.name} — ${pendingRole ? portalFor(pendingRole) : "Portal"}`);
          setRedirectPath(pendingRole ? routeFor(pendingRole) : null);
        }}
      />
    </>
  );
}
