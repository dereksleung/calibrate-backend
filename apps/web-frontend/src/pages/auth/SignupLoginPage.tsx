import { requestEmailOtp, useRequestEmailOtp } from "@calibrate/api-client";
import { RequestEmailOtpRequestBodySchema, type RequestEmailOtpRequestBody } from "@calibrate/api-contracts";
import { useForm } from "@tanstack/react-form";
import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/shared/components/tabs/Tabs";
import { useNavigate } from "@tanstack/react-router";

type SignUpLoginFormValues = RequestEmailOtpRequestBody;

function firstContractError(field: "email", value: string): string | undefined {
  const result = RequestEmailOtpRequestBodySchema.shape[field].safeParse(value);
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

  const { mutateAsync: onSubmitEmail } = useRequestEmailOtp(apiTransport, {
    onSuccess: () => {
      navigate({ to: "/auth/otp" });
    },
    onError: (error) => {
      console.log("🚀 ~ SignUpLoginForm ~ error:", error)
      setRequestError("We couldn't create your account. Please try again.");
    }
  }); 

  const form = useForm({
    defaultValues: {
      email: "",
    } satisfies SignUpLoginFormValues,
    onSubmit: async ({ value }) => {
      setRequestError(undefined);
      navigate({ to: "/auth/otp" });
      try {
        await onSubmitEmail(value.email);
      } catch {
        setRequestError("We couldn't create your account. Please try again.");
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
            {isSubmitting ? "Creating account…" : "Start Journey"}
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
          <h1 className="font-heading text-4xl font-light tracking-[-0.02em] text-primary">
            Calibrate
          </h1>
          <p className="mt-xs max-w-[24rem] text-sm font-light text-on-surface-variant/80">
            Mindful nourishment for a balanced life.
          </p>
        </header>

        <section className="glass-card rounded-4xl p-lg md:p-xl" aria-label="Authentication">
          <Tabs defaultValue="unified-sign-up-in">
            <TabsList aria-label="Authentication method" className="mb-xl">
              <TabsTrigger value="unified-sign-up-in">Unified Sign Up / In</TabsTrigger>
            </TabsList>
            <TabsContent value="unified-sign-up-in">
              <SignUpLoginForm
                onSubmitEmail={(credentials) => requestEmailOtp(apiTransport, credentials)}
              />
            </TabsContent>
          </Tabs>
        </section>

        <p className="mx-auto mt-lg max-w-[24rem] text-center text-[10px] leading-4 text-outline">
          By continuing, you agree to Calibrate&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}

export { SignUpLoginForm, SignupLoginPage };
