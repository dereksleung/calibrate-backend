import type { AccountEmailVerificationPurpose } from "./email-otp-challenge-repository.js";

export interface CreatedEmailOtpCode {
  challengeId: string;
  code: string;
  codeDigest: string;
  hmacFormatVersion: number;
  hmacKeyVersion: number;
}

export interface VerifyEmailOtpCodeProps {
  challengeId: string;
  code: string;
  codeDigest: string;
  purpose: AccountEmailVerificationPurpose;
  hmacFormatVersion: number;
  hmacKeyVersion: number;
}

export interface IEmailOtpCodeService {
  createChallenge(purpose: AccountEmailVerificationPurpose): CreatedEmailOtpCode;
  verifyChallenge(props: VerifyEmailOtpCodeProps): boolean;
}
