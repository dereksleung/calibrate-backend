export interface SignupEmailVerificationCodeEmailInfo {
  email: string;
  code: string;
  expiresInMinutes: number;
  deliveryId: string;
}

export interface IEmailSender {
  sendSignupEmailVerificationCode(message: SignupEmailVerificationCodeEmailInfo): Promise<void>;
}
