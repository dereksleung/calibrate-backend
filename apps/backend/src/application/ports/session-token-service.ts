export interface CreatedOpaqueToken {
  token: string;
  digest: string;
}

export interface IOpaqueTokenService {
  create(): CreatedOpaqueToken;
}
