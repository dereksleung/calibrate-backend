import type { SignupEmailVerificationPurpose } from "./email-otp-challenge-repository.js";

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
  purpose: SignupEmailVerificationPurpose;
  hmacFormatVersion: number;
  hmacKeyVersion: number;
}

export interface IEmailOtpCodeService {
  createChallenge(purpose: SignupEmailVerificationPurpose): CreatedEmailOtpCode;
  verifyChallenge(props: VerifyEmailOtpCodeProps): boolean;
}
