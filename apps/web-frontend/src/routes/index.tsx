import { Dashboard } from "#/pages/dashboard/Dashboard.tsx";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Dashboard });
