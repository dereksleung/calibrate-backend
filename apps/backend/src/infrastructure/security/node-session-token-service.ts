import type { CreatedOpaqueToken, IOpaqueTokenService } from "@application/ports/session-token-service.js";

import { createHash, randomBytes } from "node:crypto";

export class NodeOpaqueTokenService implements IOpaqueTokenService {
  create(): CreatedOpaqueToken {
    const token = randomBytes(32).toString("base64url");
    return {
      token,
      digest: createHash("sha256").update(token).digest("base64url"),
    };
  }
}
