export interface AccountEmailVerificationCodeEmailInfo {
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
  sendAccountEmailVerificationCode(message: AccountEmailVerificationCodeEmailInfo): Promise<void>;
  sendPasskeyAddedNotification(message: PasskeyAddedNotificationEmailInfo): Promise<void>;
}
