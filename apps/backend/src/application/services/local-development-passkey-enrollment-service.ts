import { IClock } from "@application/ports/clock.js";
import { IOpaqueTokenService } from "@application/ports/session-token-service.js";
import { ISignupEnrollmentAuthorizationRepository } from "@application/ports/signup-enrollment-authorization-repository.js";
import { randomUUID } from "node:crypto";

const LOCAL_ENROLLMENT_LIFETIME_SECONDS = 5 * 60;

export interface LocalDevelopmentPasskeyEnrollment {
  token: string;
  email: string;
  expiresAt: Date;
}

export interface ILocalDevelopmentPasskeyEnrollmentService {
  create(): Promise<LocalDevelopmentPasskeyEnrollment>;
}

/**
 * Creates disposable signup authorizations for a loopback-only development route.
 * These reserved emails are intentionally not deliverable recovery addresses.
 */
export class LocalDevelopmentPasskeyEnrollmentService implements ILocalDevelopmentPasskeyEnrollmentService {
  constructor(
    private readonly repository: ISignupEnrollmentAuthorizationRepository,
    private readonly tokenService: IOpaqueTokenService,
    private readonly clock: IClock,
  ) {}

  async create(): Promise<LocalDevelopmentPasskeyEnrollment> {
    const createdAt = this.clock.now();
    const expiresAt = new Date(createdAt.getTime() + LOCAL_ENROLLMENT_LIFETIME_SECONDS * 1000);
    const token = this.tokenService.create();
    const email = `local-${randomUUID()}@example.test`;

    await this.repository.createLocalDevelopmentAuthorization({
      authorization: {
        id: randomUUID(),
        email,
        tokenDigest: token.digest,
        sessionTransport: "cookie",
        mobilePlatform: null,
        createdAt,
        expiresAt,
      },
    });

    return { token: token.token, email, expiresAt };
  }
}

export class UnavailableLocalDevelopmentPasskeyEnrollmentService
  implements ILocalDevelopmentPasskeyEnrollmentService
{
  create(): Promise<LocalDevelopmentPasskeyEnrollment> {
    return Promise.reject(new Error("Local development enrollment unavailable"));
  }
}
