import type { DevPortPair } from "./ports.js";

export type DevBindings = {
  ports: DevPortPair;
  frontendUrl: string;
  backendUrl: string;
  viteApiBaseUrl: string;
  corsOrigin: string;
  webauthnOrigin: string;
};

export function deriveDevBindings(ports: DevPortPair): DevBindings {
  const frontendUrl = `http://localhost:${ports.frontend}`;
  const backendUrl = `http://localhost:${ports.backend}`;

  return {
    ports,
    frontendUrl,
    backendUrl,
    viteApiBaseUrl: `${backendUrl}/api/v1`,
    corsOrigin: frontendUrl,
    webauthnOrigin: frontendUrl,
  };
}
