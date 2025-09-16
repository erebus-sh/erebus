import { Polar } from "@polar-sh/sdk";

export function createPolarSdk() {
  if (!process.env.POLAR_ORGANIZATION_TOKEN) {
    throw new Error("POLAR_ORGANIZATION_TOKEN must be set");
  }

  if (!process.env.POLAR_SERVER) {
    throw new Error("POLAR_SERVER must be set");
  }

  const polarOrganizationToken = process.env.POLAR_ORGANIZATION_TOKEN;
  const polarServer = process.env.POLAR_SERVER as "sandbox" | "production";

  return new Polar({
    accessToken: polarOrganizationToken,
    server: polarServer,
  });
}
