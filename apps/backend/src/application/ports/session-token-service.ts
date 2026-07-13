export interface CreatedSessionToken {
  token: string;
  digest: string;
}

export interface ISessionTokenService {
  create(): CreatedSessionToken;
}
