import type { Meta, StoryObj } from "@storybook/react-vite";

import "../../../styles.css";
import { WarningBanner } from "./WarningBanner";

const meta = {
  title: "Shared/Warning Banner",
  component: WarningBanner,
  decorators: [
    (Story) => (
      <div
        className="bg-surface-container-low p-md font-sans"
        style={{ width: "min(22rem, calc(100vw - 2rem))" }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WarningBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthenticationError: Story = {};
