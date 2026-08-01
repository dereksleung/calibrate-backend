export interface SignupEmailVerificationCodeEmailInfo {
  email: string;
  code: string;
  expiresInMinutes: number;
  deliveryId: string;
}

export interface PasskeyAddedNotificationEmailInfo {
  email: string;
  deliveryId: string;
}

export interface IEmailSender {
  sendSignupEmailVerificationCode(message: SignupEmailVerificationCodeEmailInfo): Promise<void>;
  sendPasskeyAddedNotification(message: PasskeyAddedNotificationEmailInfo): Promise<void>;
}
