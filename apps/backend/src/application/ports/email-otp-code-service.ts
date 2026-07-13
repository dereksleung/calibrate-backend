export interface CreatedEmailOtpCode {
  challengeId: string;
  code: string;
  codeDigest: string;
  hmacFormatVersion: number;
  hmacKeyVersion: number;
}

export interface IEmailOtpCodeService {
  createChallenge(purpose: "authentication"): CreatedEmailOtpCode;
}
