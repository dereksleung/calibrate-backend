export interface RecordSecurityEventInput {
  id: string;
  userId: string;
  eventType: string;
  createdAt: Date;
}

export interface ISecurityEventRepository {
  record(event: RecordSecurityEventInput): Promise<void>;
}
