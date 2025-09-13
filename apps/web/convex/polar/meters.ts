import { EventCreateCustomer } from "@polar-sh/sdk/models/components/eventcreatecustomer.js";
import { polarSdk } from "../lib/polar";

export async function ingestMetersForUserId(userId: string, count: number) {
  let events: EventCreateCustomer[] = [];
  for (let i = 0; i < count; i++) {
    events.push({
      name: "Erebus Gateway Messages",
      customerId: userId,
    });
  }
  return await polarSdk.events.ingest({
    events: events,
  });
}

export async function getMetersForUserId(userId: string) {
  return await polarSdk.customerMeters.get({
    id: userId,
  });
}
