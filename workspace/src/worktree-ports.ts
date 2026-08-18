import { canBindLocalhost, selectPortPair, type DevPortPair } from "@calibrate/dev-bindings";

export async function resolveStickyPortPair(
  previous: DevPortPair | undefined,
  startPort = 3000,
): Promise<DevPortPair> {
  if (
    previous &&
    (await canBindLocalhost(previous.frontend)) &&
    (await canBindLocalhost(previous.backend))
  ) {
    return previous;
  }

  return selectPortPair(startPort);
}
