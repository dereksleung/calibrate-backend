import type {
  ISecurityEventRepository,
  RecordSecurityEventInput,
} from "@application/ports/security-event-repository.js";

import type { DatabaseClient } from "../database-client.js";

export class PostgresSecurityEventRepository implements ISecurityEventRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async record(event: RecordSecurityEventInput): Promise<void> {
    await this.databaseClient
      .insertInto("security_events")
      .values({
        id: event.id,
        user_id: event.userId,
        event_type: event.eventType,
        created_at: event.createdAt,
      })
      .execute();
  }
}
