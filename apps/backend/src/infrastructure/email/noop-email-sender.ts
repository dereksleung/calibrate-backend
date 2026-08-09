import type {
  AccountEmailVerificationCodeEmailInfo,
  IEmailSender,
  PasskeyAddedNotificationEmailInfo,
} from "@application/ports/email-sender.js";

/** Keeps passkey registration usable for local disposable accounts without a mail provider. */
export class NoopEmailSender implements IEmailSender {
  async sendAccountEmailVerificationCode(_message: AccountEmailVerificationCodeEmailInfo): Promise<void> {}

  async sendPasskeyAddedNotification(_message: PasskeyAddedNotificationEmailInfo): Promise<void> {}
}
