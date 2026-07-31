import { apiTransport } from "#/shared/api/api-client";
import { Button } from "#/shared/components/base/Button";
import { WarningBanner } from "#/shared/components/base/WarningBanner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "#/verticals/auth/components/InputOtp.tsx";
import {
  createSignupEmailVerificationHandoff,
  createPasskeyEnrollmentHandoff,
  type SignupEmailVerificationHandoff,
} from "#/verticals/auth/signup-email-verification-handoff";
import { useRequestSignupEmailVerification, useVerifySignupEmailVerification } from "@calibrate/api-client";
import { useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";

type OtpPageProps = {
  handoff: SignupEmailVerificationHandoff;
};

function getResendCountdown(handoff: SignupEmailVerificationHandoff): number {
  const availableAtEpochMs = handoff.requestedAtEpochMs + handoff.resendAfterSeconds * 1000;

  return Math.max(0, Math.ceil((availableAtEpochMs - Date.now()) / 1000));
}

function OtpPage({ handoff }: OtpPageProps) {
  const navigate = useNavigate();
  const { isPending, mutateAsync: requestSignupEmailVerification } =
    useRequestSignupEmailVerification(apiTransport);
  const { isPending: isVerifying, mutateAsync: verifySignupEmailVerification } =
    useVerifySignupEmailVerification(apiTransport);
  const [otpCode, setOtpCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(() => getResendCountdown(handoff));
  const [resendError, setResendError] = useState<string>();
  const [verificationError, setVerificationError] = useState<string>();
  const expiryMinutes = Math.ceil(handoff.expiresInSeconds / 60);

  useEffect(() => {
    setResendCountdown(getResendCountdown(handoff));
    setResendError(undefined);
  }, [handoff.challengeId, handoff.requestedAtEpochMs, handoff.resendAfterSeconds]);

  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  async function handleResend() {
    setResendError(undefined);

    try {
      const response = await requestSignupEmailVerification(handoff.email);
      const replacement = createSignupEmailVerificationHandoff(handoff.email, response);

      await navigate({
        replace: true,
        state: (previous) => ({
          ...previous,
          signupEmailVerification: replacement,
        }),
        to: "/auth/otp",
      });
    } catch {
      setResendError("We couldn't resend your verification code. Please try again.");
    }
  }

  async function handleVerify() {
    setVerificationError(undefined);
    if (!/^[0-9]{6}$/.test(otpCode)) {
      setVerificationError("Enter the 6-digit code from your email.");
      return;
    }
    try {
      const response = await verifySignupEmailVerification({ challengeId: handoff.challengeId, code: otpCode });
      const enrollment = createPasskeyEnrollmentHandoff(handoff.email, response);
      await navigate({
        to: "/auth/passkey-enrollment",
        state: (previous) => ({ ...previous, passkeyEnrollment: enrollment }),
      });
    } catch {
      setVerificationError("This verification code is invalid or has expired. Request a new code and try again.");
    }
  }

  return (
    <main className="auth-page-background relative min-h-dvh overflow-hidden px-gutter py-xl text-on-background md:px-xl md:py-xxl">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-[80px] md:size-96"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-24 -left-24 size-72 rounded-full bg-primary/5 blur-[80px] md:size-96"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[32rem] flex-col">
        <section className="glass-card rounded-4xl p-lg md:p-xl" aria-label="Email verification">
          <div className="flex flex-col items-center text-center">
            <div className="mb-lg flex size-16 items-center justify-center rounded-full bg-primary/10">
              <MailCheck aria-hidden="true" className="size-8 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-light tracking-[-0.02em] text-primary md:text-3xl">
              Check your email
            </h1>
            <p className="mt-sm max-w-[20rem] text-sm font-light text-on-surface-variant/80">
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-on-background">{handoff.email}</span>
            </p>
            <p className="mt-xs text-xs text-on-surface-variant/70">
              This code expires in {expiryMinutes} {expiryMinutes === 1 ? "minute" : "minutes"}.
            </p>
          </div>

          <div className="mt-xl flex justify-center">
            <InputOTP aria-label="Verification code" maxLength={6} value={otpCode} onChange={setOtpCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="mt-xl flex flex-col gap-md">
            {verificationError && <WarningBanner>{verificationError}</WarningBanner>}
            {resendError && <WarningBanner>{resendError}</WarningBanner>}
            <Button
              className="h-14 w-full gap-sm rounded-full text-xs shadow-[0_12px_24px_-12px_rgba(51,79,43,0.45)]"
              disabled={isVerifying}
              type="button"
              onClick={() => void handleVerify()}
            >
              {isVerifying ? "Verifying…" : "Verify Code"}
            </Button>

            <div className="flex flex-col items-center gap-sm">
              <p className="text-xs text-on-surface-variant/70">
                Didn&apos;t receive a code?
                {resendCountdown > 0 ? (
                  <>
                    {" "}
                    Resend in <span className="font-semibold text-on-background">{resendCountdown}s</span>
                  </>
                ) : null}
              </p>
              <Button
                variant="ghost"
                className="h-auto px-0 py-xs text-xs font-bold tracking-[0.12em] text-primary uppercase hover:bg-transparent"
                disabled={resendCountdown > 0 || isPending}
                type="button"
                onClick={() => void handleResend()}
              >
                {isPending ? "Sending…" : "Resend Code"}
              </Button>
            </div>
          </div>
        </section>

        <p className="mx-auto mt-lg max-w-[24rem] text-center text-[10px] leading-4 text-outline">
          By continuing, you agree to Calibrate&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}

export { OtpPage };
