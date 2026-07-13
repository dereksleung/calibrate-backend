export interface AuthenticationCodeEmail {
  email: string;
  code: string;
  expiresInMinutes: number;
}

export interface IEmailSender {
  sendAuthenticationCode(message: AuthenticationCodeEmail): Promise<void>;
}
