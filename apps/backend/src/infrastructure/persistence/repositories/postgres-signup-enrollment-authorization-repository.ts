import type {
  ConsumeAndCreateEnrollmentAuthorizationProps,
  ISignupEnrollmentAuthorizationRepository,
} from "@application/ports/signup-enrollment-authorization-repository.js";

import type { DatabaseClient } from "../database-client.js";

export class PostgresSignupEnrollmentAuthorizationRepository
  implements ISignupEnrollmentAuthorizationRepository
{
  constructor(private readonly databaseClient: DatabaseClient) {}

  async consumeAndCreate(props: ConsumeAndCreateEnrollmentAuthorizationProps): Promise<boolean> {
    return this.databaseClient.transaction().execute(async (trx) => {
      const authorization = props.authorization;
      let consumeQuery = trx
        .updateTable("email_otp_challenges")
        .set({ consumed_at: props.consumedAt })
        .where("id", "=", props.challengeId)
        .where("purpose", "=", "signup-email-verification")
        .where("session_transport", "=", authorization.sessionTransport)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null)
        .where("expires_at", ">", props.consumedAt)
        .whereRef("attempt_count", "<", "max_attempts");

      consumeQuery =
        authorization.mobilePlatform === null
          ? consumeQuery.where("mobile_platform", "is", null)
          : consumeQuery.where("mobile_platform", "=", authorization.mobilePlatform);

      const consumed = await consumeQuery.executeTakeFirst();
      if (Number(consumed.numUpdatedRows) !== 1) return false;

      let invalidateQuery = trx
        .updateTable("signup_enrollment_authorizations")
        .set({ invalidated_at: props.consumedAt })
        .where("email", "=", authorization.email)
        .where("session_transport", "=", authorization.sessionTransport)
        .where("consumed_at", "is", null)
        .where("invalidated_at", "is", null);

      invalidateQuery =
        authorization.mobilePlatform === null
          ? invalidateQuery.where("mobile_platform", "is", null)
          : invalidateQuery.where("mobile_platform", "=", authorization.mobilePlatform);

      await invalidateQuery.execute();
      await trx
        .insertInto("signup_enrollment_authorizations")
        .values({
          id: authorization.id,
          email: authorization.email,
          token_digest: authorization.tokenDigest,
          session_transport: authorization.sessionTransport,
          mobile_platform: authorization.mobilePlatform,
          webauthn_user_handle: null,
          created_at: authorization.createdAt,
          expires_at: authorization.expiresAt,
          consumed_at: null,
          invalidated_at: null,
        })
        .execute();
      return true;
    });
  }
}
