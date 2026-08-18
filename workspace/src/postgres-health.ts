import { connect } from "node:net";

export function shouldStartComposePostgres(isPortOpen: boolean): boolean {
  return !isPortOpen;
}

export type PostgresReadinessProbe = () => Promise<void>;

export type PostgresReadinessOptions = {
  retryDelayMs?: number;
  timeoutMs?: number;
};

export async function waitForPostgresReady(
  probe: PostgresReadinessProbe,
  { retryDelayMs = 250, timeoutMs = 60_000 }: PostgresReadinessOptions = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (true) {
    try {
      await probe();
      return;
    } catch (error: unknown) {
      lastError = error;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      break;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.min(retryDelayMs, remainingMs));
    });
  }

  const lastErrorMessage = lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new Error(`Postgres did not become ready within ${timeoutMs}ms.${lastErrorMessage}`);
}

export async function isTcpPortOpen(host: string, port: number, timeoutMs = 1_000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const finish = (isOpen: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(isOpen);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}
