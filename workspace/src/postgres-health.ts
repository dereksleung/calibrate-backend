import { connect } from "node:net";

export function shouldStartComposePostgres(isPortOpen: boolean): boolean {
  return !isPortOpen;
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
