import type { CreatedSessionToken, ISessionTokenService } from "@application";

import { createHash, randomBytes } from "node:crypto";

export class NodeSessionTokenService implements ISessionTokenService {
  create(): CreatedSessionToken {
    const token = randomBytes(32).toString("base64url");
    return {
      token,
      digest: createHash("sha256").update(token).digest("base64url"),
    };
  }
}
