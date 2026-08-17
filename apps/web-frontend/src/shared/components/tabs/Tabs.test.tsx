// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

afterEach(cleanup);

describe("Tabs", () => {
  it("renders the Stitch-inspired pill treatment by default", () => {
    render(
      <Tabs defaultValue="sign-in">
        <TabsList aria-label="Authentication">
          <TabsTrigger value="sign-in">Sign In</TabsTrigger>
          <TabsTrigger value="create-account">Create Account</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    const tabList = screen.getByRole("tablist", { name: "Authentication" });
    const selectedTab = screen.getByRole("tab", { name: "Sign In" });

    expect(tabList.className).toContain("rounded-full");
    expect(tabList.className).toContain("bg-surface-container-high/50");
    expect(selectedTab.className).toContain("rounded-full");
    expect(selectedTab.className).toContain("data-active:bg-surface-container-lowest");
  });

  it("switches the selected tab and its visible panel", () => {
    render(
      <Tabs defaultValue="sign-in">
        <TabsList aria-label="Authentication">
          <TabsTrigger value="sign-in">Sign In</TabsTrigger>
          <TabsTrigger value="create-account">Create Account</TabsTrigger>
        </TabsList>
        <TabsContent value="sign-in">Welcome back</TabsContent>
        <TabsContent value="create-account">Create your account</TabsContent>
      </Tabs>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Create Account" }));

    expect(screen.getByRole("tab", { name: "Create Account" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Create your account");
  });
});
