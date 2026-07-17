export type MobilePlatform = "ios" | "android";
export type SessionTransport = "cookie" | "bearer";

export type SessionClient =
  | {
      transport: "cookie";
      mobilePlatform: null;
    }
  | {
      transport: "bearer";
      mobilePlatform: MobilePlatform;
    };