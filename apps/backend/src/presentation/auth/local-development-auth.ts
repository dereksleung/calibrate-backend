const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const LOOPBACK_CLIENT_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export interface LocalDevelopmentRequestCheck {
  environment: string | undefined;
  origin: string | undefined;
  expectedOrigin: string;
  clientIp: string | undefined;
}

export function isLocalDevelopmentRequest({
  environment,
  origin,
  expectedOrigin,
  clientIp,
}: LocalDevelopmentRequestCheck): boolean {
  if (
    environment === "production" ||
    !origin ||
    origin !== expectedOrigin ||
    !LOOPBACK_CLIENT_IPS.has(clientIp ?? "")
  ) {
    return false;
  }

  try {
    const expected = new URL(expectedOrigin);
    const actual = new URL(origin);
    return (
      expected.origin === actual.origin &&
      expected.protocol === "http:" &&
      LOOPBACK_HOSTNAMES.has(expected.hostname)
    );
  } catch {
    return false;
  }
}
