import { baseClient } from "./baseClient";
import { ErebusSession } from "./session";
import { ErebusError } from "../internal/error";
import {
  type GrantRequest,
  secretKeySchema,
} from "../../../schemas/request/grantChannelRequest";

export class ErebusService {
  private readonly client: ReturnType<typeof baseClient>;
  private grantRequest: GrantRequest = {
    userId: "",
    channel: "",
    topics: [],
    expiresAt: 0,
    secret_key: "dv-er-abcdefghijklmnopqrstuvwxyzABCDEFGsH1234abcdddddd",
  };
  constructor({
    secret_api_key,
    base_url,
  }: {
    secret_api_key: string;
    base_url?: string;
  }) {
    // Validate the secret_api_key using the regex from grantChannelRequest.ts
    if (!secretKeySchema.safeParse(secret_api_key).success) {
      throw new ErebusError("Invalid API key format");
    }
    this.grantRequest.secret_key = secret_api_key;
    this.client = baseClient({ base_url: base_url ?? "https://api.erebus.sh" });
  }

  public async prepareSession({ userId }: { userId: string }) {
    if (!userId) {
      throw new ErebusError(
        "User ID is required to create a session. Use the ErebusService.prepareSession() method.",
      );
    }
    this.grantRequest.userId = userId;
    return new ErebusSession(this.grantRequest, this.client);
  }
}
