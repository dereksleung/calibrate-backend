import { z } from "zod";
import { ApiError } from "./errors.js";
import { validateBySchema } from "./common/validate-by-schema.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ApiHeaders = HeadersInit | Promise<HeadersInit>;

export interface ApiTransportOptions {
  baseUrl: string;
  fetch?: FetchLike;
  getAccessToken?: () => string | null | Promise<string | null>;
  getHeaders?: () => ApiHeaders;
}

export interface ApiRequestOptions<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  path: string;
  method?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  responseBodySchema: TSchema;
}

export interface ApiTransport {
  request<TSchema extends z.ZodTypeAny>(
    options: ApiRequestOptions<TSchema>
  ): Promise<z.infer<TSchema>>;
}

function buildUrl(baseUrl: string, path: string, query?: ApiRequestOptions["query"]): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return `${normalizedBase}${normalizedPath}${queryString ? `?${queryString}` : ""}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

async function buildHeaders(options: ApiTransportOptions, requestHeaders?: HeadersInit, body?: unknown): Promise<Headers> {
  const headers = new Headers(await options.getHeaders?.());
  const accessToken = await options.getAccessToken?.();

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  new Headers(requestHeaders).forEach((value, key) => {
    headers.set(key, value);
  });

  return headers;
}

export function createApiTransport(options: ApiTransportOptions): ApiTransport {
  return {
    async request<TSchema extends z.ZodTypeAny>({
      path,
      method = "GET",
      query,
      body,
      headers: requestHeaders,
      signal,
      responseBodySchema,
    }: ApiRequestOptions<TSchema>): Promise<z.infer<TSchema>> {
      const fetchImplementation = options.fetch ?? globalThis.fetch?.bind(globalThis);

      if (!fetchImplementation) {
        throw new Error("ApiTransport requires a fetch implementation in this runtime.");
      }

      const response = await fetchImplementation(buildUrl(options.baseUrl, path, query), {
        method,
        credentials: "include",
        headers: await buildHeaders(options, requestHeaders, body),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      const responseBody = await readResponseBody(response);

      if (!response.ok) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
        throw new ApiError({
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          retryAfterSeconds:
            retryAfterSeconds !== undefined &&
            Number.isFinite(retryAfterSeconds) &&
            retryAfterSeconds > 0
              ? retryAfterSeconds
              : undefined,
        });
      }

      return validateBySchema({
        data: responseBody,
        schema: responseBodySchema,
        url: path,
        logMessage: `Response validation failed for ${path}`,
      });
    },
  };
}
