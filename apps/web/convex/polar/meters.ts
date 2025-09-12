import { polarSdk } from "../lib/polar";

export async function ingestMetersForUserId(userId: string) {
  return await polarSdk.events.ingest({
    events: [
      {
        name: "Erebus Gateway Messages",
        customerId: userId,
      },
    ],
  });
}

export async function getMetersForUserId(userId: string) {
  return await polarSdk.customerMeters.get({
    id: userId,
  });
}
