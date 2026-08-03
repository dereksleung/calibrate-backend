import { apiTransport } from "#/shared/api/api-client";
import { Button } from "#/shared/components/base/Button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldIcon,
  FieldInput,
  FieldInputWrapper,
  FieldLabel,
} from "#/shared/components/base/Field";
import { WarningBanner } from "#/shared/components/base/WarningBanner";
import { setAuthenticatedSession } from "#/verticals/auth/authenticated-session";
import {
  cancelPasskeyAuthentication,
  isBrowserPasskeyAuthenticationSupported,
  isConditionalPasskeyAuthenticationSupported,
  isPasskeyAuthenticationCancellation,
  startPasskeyAuthentication,
} from "#/verticals/auth/browser-passkey-authentication-adapter";
import { createSignupEmailVerificationHandoff } from "#/verticals/auth/signup-email-verification-handoff";
import {
  ApiError,
  parsePasskeyAuthenticationError,
  requestPasskeyAuthenticationOptions,
  useRequestSignupEmailVerification,
  verifyPasskeyAuthentication,
} from "@calibrate/api-client";
import {
  RequestSignupEmailVerificationRequestBodySchema,
  type PasskeyAuthenticationErrorCode,
  type RequestSignupEmailVerificationRequestBody,
} from "@calibrate/api-contracts";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SignUpLoginFormValues = RequestSignupEmailVerificationRequestBody;

const PASSKEY_AUTHENTICATION_ERROR_MESSAGES: Partial<
  Record<PasskeyAuthenticationErrorCode, string>
> = {
  ORIGIN_NOT_ALLOWED: "Passkey sign-in is unavailable from this site.",
  PASSKEY_AUTHENTICATION_UNAVAILABLE: "Passkey sign-in is temporarily unavailable.",
};

const DEFAULT_PASSKEY_AUTHENTICATION_ERROR_MESSAGE =
  "We couldn't verify that passkey. Try the Log in with Passkey button again, or use the email field to verify and recover your account.";

function firstContractError(field: "email", value: string): string | undefined {
  const result = RequestSignupEmailVerificationRequestBodySchema.shape[field].safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

function fieldErrors(errors: unknown[]): Array<{ message?: string }> {
  return errors.map((error) => ({
    message:
      typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String(error.message)
          : undefined,
  }));
}

function SignUpLoginForm({ onSubmitStart = () => undefined }: { onSubmitStart?: () => void }) {
  const [requestError, setRequestError] = useState<string>();
  const navigate = useNavigate();
  const { mutateAsync: requestSignupEmailVerification } =
    useRequestSignupEmailVerification(apiTransport);

  const form = useForm({
    defaultValues: {
      email: "",
    } satisfies SignUpLoginFormValues,
    onSubmit: async ({ value }) => {
      onSubmitStart();
      setRequestError(undefined);

      try {
        const response = await requestSignupEmailVerification(value.email);
        const handoff = createSignupEmailVerificationHandoff(value.email, response);

        await navigate({
          to: "/auth/otp",
          state: (previous) => ({
            ...previous,
            signupEmailVerification: handoff,
          }),
        });
      } catch {
        setRequestError("We couldn't send your verification code. Please try again.");
      }
    },
  });

  return (
    <form
      aria-label="Create account"
      className="flex flex-col gap-lg"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {requestError && <WarningBanner>{requestError}</WarningBanner>}
      <FieldGroup className="gap-lg">
        <form.Field
          name="email"
          validators={{
            onBlur: ({ value }) => firstContractError("email", value),
            onSubmit: ({ value }) => firstContractError("email", value),
          }}
        >
          {(field) => {
            const isInvalid = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Email Address</FieldLabel>
                <FieldInputWrapper>
                  <FieldInput
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={isInvalid}
                    autoComplete="email webauthn"
                    placeholder="example@calibrate.com"
                    type="email"
                  />
                  <FieldIcon>
                    <Mail />
                  </FieldIcon>
                </FieldInputWrapper>
                {isInvalid && <FieldError errors={fieldErrors(field.state.meta.errors)} />}
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            className="mt-md h-14 w-full gap-sm rounded-full text-xs shadow-[0_12px_24px_-12px_rgba(51,79,43,0.45)]"
            disabled={!canSubmit || isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Sending code…" : "Sign Up"}
            {!isSubmitting && <ArrowRight aria-hidden="true" />}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function PasskeyLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startedConditional = useRef(false);
  const cachedOptions = useRef<
    Awaited<ReturnType<typeof requestPasskeyAuthenticationOptions>> | undefined
  >(undefined);
  const [rememberDevice, setRememberDevice] = useState(true);
  const rememberDeviceRef = useRef(rememberDevice);
  const [state, setState] = useState<"ready" | "pending" | "unavailable" | "failed">("ready");
  const [error, setError] = useState<string>();
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(0);

  useEffect(() => {
    if (retryAfterSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setRetryAfterSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [retryAfterSeconds]);

  function showRateLimitError(caught: unknown) {
    const seconds =
      caught instanceof ApiError && caught.retryAfterSeconds ? caught.retryAfterSeconds : 60;
    setRetryAfterSeconds(seconds);
    setError("Too many passkey attempts. Please wait before trying again.");
  }

  const complete = async (
    options: Awaited<ReturnType<typeof requestPasskeyAuthenticationOptions>>,
    mode: "conditional" | "explicit",
  ) => {
    setState("pending");
    setError(undefined);
    try {
      const credential = await startPasskeyAuthentication(options.options, mode);
      const session = await verifyPasskeyAuthentication(apiTransport, {
        credential,
        rememberDevice: rememberDeviceRef.current,
      });
      setAuthenticatedSession(queryClient, session);
      await navigate({ to: "/" });
    } catch (caught) {
      if (isPasskeyAuthenticationCancellation(caught)) {
        setState("ready");
        return;
      }
      cachedOptions.current = undefined;
      const code = parsePasskeyAuthenticationError(caught);
      if (code === "PASSKEY_AUTHENTICATION_RATE_LIMITED") {
        showRateLimitError(caught);
      } else {
        setError(
          (code && PASSKEY_AUTHENTICATION_ERROR_MESSAGES[code]) ??
            DEFAULT_PASSKEY_AUTHENTICATION_ERROR_MESSAGE,
        );
      }
      setState(code === "PASSKEY_AUTHENTICATION_UNAVAILABLE" ? "unavailable" : "failed");
    }
  };

  useEffect(() => {
    if (startedConditional.current || !isBrowserPasskeyAuthenticationSupported()) return;
    startedConditional.current = true;
    let active = true;
    void (async () => {
      if (!(await isConditionalPasskeyAuthenticationSupported()) || !active) return;
      try {
        setState("pending");
        const options = await requestPasskeyAuthenticationOptions(apiTransport);
        if (!active) return;
        cachedOptions.current = options;
        await complete(options, "conditional");
      } catch (caught) {
        if (!active) return;
        if (parsePasskeyAuthenticationError(caught) === "PASSKEY_AUTHENTICATION_RATE_LIMITED") {
          showRateLimitError(caught);
          setState("failed");
          return;
        }
        setState("ready");
      }
    })();
    return () => {
      active = false;
      cancelPasskeyAuthentication();
    };
  }, []);

  async function startExplicitLogin() {
    try {
      cancelPasskeyAuthentication();
      const options =
        cachedOptions.current && new Date(cachedOptions.current.expiresAt).getTime() > Date.now()
          ? cachedOptions.current
          : await requestPasskeyAuthenticationOptions(apiTransport);
      cachedOptions.current = options;
      await complete(options, "explicit");
    } catch (caught) {
      cachedOptions.current = undefined;
      if (parsePasskeyAuthenticationError(caught) === "PASSKEY_AUTHENTICATION_RATE_LIMITED") {
        showRateLimitError(caught);
      } else {
        setError("We couldn't start a passkey request. Please try again.");
      }
      setState("failed");
    }
  }

  return (
    <div className="mt-lg border-t border-border pt-lg">
      {error && <WarningBanner className="mb-md">{error}</WarningBanner>}
      <label className="mb-md flex items-start gap-sm text-left text-sm text-on-surface-variant">
        <input
          checked={rememberDevice}
          className="mt-0.5 size-4 rounded border-border"
          disabled={state === "pending"}
          type="checkbox"
          onChange={(event) => {
            rememberDeviceRef.current = event.target.checked;
            setRememberDevice(event.target.checked);
          }}
        />
        <span>Keep me signed in on this device</span>
      </label>
      <Button
        className="h-12 w-full"
        disabled={
          state === "pending" ||
          state === "unavailable" ||
          retryAfterSeconds > 0 ||
          !isBrowserPasskeyAuthenticationSupported()
        }
        type="button"
        onClick={() => void startExplicitLogin()}
      >
        {state === "pending"
          ? "Waiting for your passkey…"
          : retryAfterSeconds > 0
            ? `Try again in ${retryAfterSeconds} ${retryAfterSeconds === 1 ? "second" : "seconds"}`
            : "Log in with passkey"}
      </Button>
    </div>
  );
}

function SignupLoginPage() {
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
        <header className="mb-xl flex flex-col items-center text-center">
          <div className="mb-lg flex size-16 items-center justify-center rounded-full border border-white/60 bg-white/40 shadow-sm backdrop-blur-md">
            <svg aria-hidden="true" className="size-8 text-primary" viewBox="0 0 24 24" fill="none">
              <path d="M12 21V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path
                d="M12 13C7.5 13 5 10.5 5 6c4.5 0 7 2.5 7 7Z"
                fill="currentColor"
                fillOpacity="0.16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 10c0-4.5 2.5-7 7-7 0 4.5-2.5 7-7 7Z"
                fill="currentColor"
                fillOpacity="0.16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="font-heading text-4xl font-light tracking-[-0.02em] text-primary">
            Calibrate
          </h1>
          <p className="mt-xs max-w-[24rem] text-sm font-light text-on-surface-variant/80">
            Mindful nourishment for a balanced life.
          </p>
        </header>

        <section className="glass-card rounded-4xl p-lg md:p-xl" aria-labelledby="signup-heading">
          <div className="mb-xl text-center">
            <h2
              id="signup-heading"
              className="font-heading text-2xl font-light tracking-[-0.01em] text-primary"
            >
              Sign Up or Log In
            </h2>
            <p className="mt-sm text-sm font-light text-on-surface-variant/80">
              To sign up, enter your email and click the Sign Up button.
            </p>
            <p className="mt-sm text-sm font-light text-on-surface-variant/80">
              Log in by clicking the email field, or the button below to show passkeys you already
              registered.
            </p>
          </div>
          <SignUpLoginForm onSubmitStart={cancelPasskeyAuthentication} />
          <PasskeyLogin />
        </section>

        <p className="mx-auto mt-lg max-w-[24rem] text-center text-[10px] leading-4 text-outline">
          By continuing, you agree to Calibrate&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}

export { SignUpLoginForm, SignupLoginPage };
