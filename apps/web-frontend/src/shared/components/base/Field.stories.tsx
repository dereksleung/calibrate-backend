import type { Meta, StoryObj } from "@storybook/react-vite";
import { Lock, Mail, UserRound } from "lucide-react";

import "../../../styles.css";

import {
  Field,
  FieldInputWrapper,
  FieldError,
  FieldGroup,
  FieldIcon,
  FieldInput,
  FieldLabel,
} from "./Field";

const meta = {
  title: "Shared/Field",
  component: Field,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div
        className="rounded-3xl bg-surface-container-low/80 p-md font-sans"
        style={{ width: "min(22rem, calc(100vw - 2rem))" }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

function EmailField({ invalid = false }: { invalid?: boolean }) {
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={invalid ? "email-error" : "email"}>Email Address</FieldLabel>
      <FieldInputWrapper>
        <FieldInput
          aria-invalid={invalid}
          id={invalid ? "email-error" : "email"}
          placeholder="example@zen.com"
          type="email"
        />
        <FieldIcon>
          <Mail />
        </FieldIcon>
      </FieldInputWrapper>
    </Field>
  );
}

export const Normal: Story = {
  render: () => (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="create-name">Full Name</FieldLabel>
        <FieldInputWrapper>
          <FieldInput id="create-name" placeholder="Your Name" type="text" />
          <FieldIcon>
            <UserRound />
          </FieldIcon>
        </FieldInputWrapper>
      </Field>

      <EmailField />

      <Field>
        <FieldLabel htmlFor="create-password">Create Password</FieldLabel>
        <FieldInputWrapper>
          <FieldInput id="create-password" placeholder="••••••••" type="password" />
          <FieldIcon>
            <Lock />
          </FieldIcon>
        </FieldInputWrapper>
      </Field>

      <Field>
        <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
        <FieldInputWrapper>
          <FieldInput id="confirm-password" placeholder="••••••••" type="password" />
          <FieldIcon>
            <Lock />
          </FieldIcon>
        </FieldInputWrapper>
      </Field>
    </FieldGroup>
  ),
};

export const ErrorState: Story = {
  render: () => (
    <FieldGroup>
      <EmailField invalid />

      <Field data-invalid>
        <FieldLabel htmlFor="error-password">Password</FieldLabel>
        <FieldInputWrapper>
          <FieldInput aria-invalid id="error-password" placeholder="••••••••" type="password" />
          <FieldIcon>
            <Lock />
          </FieldIcon>
        </FieldInputWrapper>
        <FieldError 
          errors={[
            { message: "Password must be at least 8 characters long Longer error Longer error Longer error Longer error." },
            { message: "Password must contain at least one uppercase letter." },
            { message: "Password must contain at least one number." },
          ]} 
        />
      </Field>
    </FieldGroup>
  ),
};
