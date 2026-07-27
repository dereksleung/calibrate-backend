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
import { createSignupEmailVerificationHandoff } from "#/verticals/auth/signup-email-verification-handoff";
import { useRequestSignupEmailVerification } from "@calibrate/api-client";
import {
  RequestSignupEmailVerificationRequestBodySchema,
  type RequestSignupEmailVerificationRequestBody,
} from "@calibrate/api-contracts";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";

type SignUpLoginFormValues = RequestSignupEmailVerificationRequestBody;

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

function SignUpLoginForm() {
  const [requestError, setRequestError] = useState<string>();
  const navigate = useNavigate();
  const { mutateAsync: requestSignupEmailVerification } = useRequestSignupEmailVerification(apiTransport);

  const form = useForm({
    defaultValues: {
      email: "",
    } satisfies SignUpLoginFormValues,
    onSubmit: async ({ value }) => {
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
                    autoComplete="email"
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
            {isSubmitting ? "Sending code…" : "Send verification code"}
            {!isSubmitting && <ArrowRight aria-hidden="true" />}
          </Button>
        )}
      </form.Subscribe>
    </form>
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
          <h1 className="font-heading text-4xl font-light tracking-[-0.02em] text-primary">Calibrate</h1>
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
              Create your account
            </h2>
            <p className="mt-sm text-sm font-light text-on-surface-variant/80">
              Start with a recovery email. We&apos;ll send a six-digit verification code.
            </p>
          </div>
          <SignUpLoginForm />
        </section>

        <p className="mx-auto mt-lg max-w-[24rem] text-center text-[10px] leading-4 text-outline">
          By continuing, you agree to Calibrate&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}

export { SignUpLoginForm, SignupLoginPage };
