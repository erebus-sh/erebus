import { Polar } from "@polar-sh/sdk";

const polarAccessToken = process.env.POLAR_ACCESS_TOKEN!;
const polarServer = process.env.POLAR_SERVER! as "sandbox" | "production";

export const polarSdk = new Polar({
  accessToken: polarAccessToken,
  server: polarServer,
});
