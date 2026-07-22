export interface AuthenticationCodeEmailInfo {
  email: string;
  code: string;
  expiresInMinutes: number;
  deliveryId: string;
}

export interface IEmailSender {
  sendAuthenticationCode(message: AuthenticationCodeEmailInfo): Promise<void>;
}
