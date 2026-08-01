import type { WebAuthnRegistrationOptions } from "@application/ports/webauthn-registration-port.js";

import {
  PasskeyRegistrationOptionsResponseSchema,
  type PasskeyRegistrationOptionsResponse,
} from "@calibrate/api-contracts";

export class PasskeyRegistrationOptionsResponseMapper {
  public static toResponse(options: WebAuthnRegistrationOptions): PasskeyRegistrationOptionsResponse {
    return PasskeyRegistrationOptionsResponseSchema.parse(options);
  }
}
