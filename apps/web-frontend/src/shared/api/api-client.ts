import { createApiTransport } from "@calibrate/api-client";

/** Base URL for REST calls; uses the runtime `fetch` (so tests can `vi.spyOn(globalThis, "fetch")`). */
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export const apiTransport = createApiTransport({
  baseUrl: apiBaseUrl,
});
