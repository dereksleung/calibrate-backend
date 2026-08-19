import { createServer } from "node:net";

export type DevPortPair = { frontend: number; backend: number };

export async function canBindLocalhost(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "localhost", () => {
      server.close((error) => resolve(error === undefined));
    });
  });
}

export async function selectPortPair(startPort = 3000): Promise<DevPortPair> {
  const firstPort = startPort % 2 === 0 ? startPort : startPort + 1;

  for (let frontend = firstPort; frontend <= 65_534; frontend += 2) {
    const backend = frontend + 1;
    if ((await canBindLocalhost(frontend)) && (await canBindLocalhost(backend))) {
      return { frontend, backend };
    }
  }

  throw new Error("No adjacent localhost port pair is available");
}
