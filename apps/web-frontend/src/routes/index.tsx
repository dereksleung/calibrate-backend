import { DashboardV2Container } from "#/pages/dashboard/DashboardV2/DashboardV2Container.tsx";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: DashboardV2Container });
