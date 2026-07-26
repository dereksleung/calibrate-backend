import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "#/shared/components/base/Button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "#/verticals/auth/components/InputOtp.tsx";

const DEFAULT_RESEND_AFTER_SECONDS = 60;

type OtpPageProps = {
  email?: string;
  resendAfterSeconds?: number;
};

function OtpPage({
  email,
  resendAfterSeconds = DEFAULT_RESEND_AFTER_SECONDS,
}: OtpPageProps) {
  const displayEmail = email ?? "example@calibrate.com";
  const [otpCode, setOtpCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(resendAfterSeconds);

  useEffect(() => {
    setResendCountdown(resendAfterSeconds);
  }, [resendAfterSeconds]);

  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  function handleResend() {
    setResendCountdown(resendAfterSeconds);
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
              <span className="font-semibold text-on-background">{displayEmail}</span>
            </p>
          </div>

          <div className="mt-xl flex justify-center">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
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
            <Button
              className="h-14 w-full gap-sm rounded-full text-xs shadow-[0_12px_24px_-12px_rgba(51,79,43,0.45)]"
              disabled
              type="button"
            >
              Verify Code
            </Button>

            <div className="flex flex-col items-center gap-sm">
              <p className="text-xs text-on-surface-variant/70">
                Didn&apos;t receive a code?
                {resendCountdown > 0 ? (
                  <>
                    {" "}
                    Resend in{" "}
                    <span className="font-semibold text-on-background">{resendCountdown}s</span>
                  </>
                ) : null}
              </p>
              <Button
                variant="ghost"
                className="h-auto px-0 py-xs text-xs font-bold tracking-[0.12em] text-primary uppercase hover:bg-transparent"
                disabled={resendCountdown > 0}
                type="button"
                onClick={handleResend}
              >
                Resend Code
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
