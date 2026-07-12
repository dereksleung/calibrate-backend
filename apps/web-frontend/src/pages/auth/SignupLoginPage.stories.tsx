import type { Meta, StoryObj } from "@storybook/react-vite";

import "../../styles.css";
import { SignupLoginPage } from "./SignupLoginPage";

const meta = {
  title: "Pages/Signup Login",
  component: SignupLoginPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SignupLoginPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CreateAccount: Story = {};
