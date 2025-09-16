import { createPolarSdk } from "../lib/polar";
import { EventCreateExternalCustomer } from "@polar-sh/sdk/models/components/eventcreateexternalcustomer.js";

export async function ingestMetersForUserId(email: string, count: number) {
  const polarSdk = createPolarSdk();
  let events: EventCreateExternalCustomer[] = [];
  for (let i = 0; i < count; i++) {
    events.push({
      name: "Erebus Gateway Messages",
      externalCustomerId: email,
    });
  }
  return await polarSdk.events.ingest({ events });
}

export async function getUsageSnapshotForUser(externalCustomerId: string) {
  const polar = createPolarSdk();

  const pages = await polar.customerMeters.list({
    externalCustomerId, // filter by your own user/project id
    limit: 100,
  });

  const perMeter: Array<{
    meterId: string;
    meterName?: string | null;
    consumed: number;
    credited: number;
    balance: number;
  }> = [];

  let totals = { consumed: 0, credited: 0, balance: 0 };

  for await (const page of pages) {
    for (const m of page.result.items) {
      const consumed = Number(m.consumedUnits ?? 0);
      const credited = Number(m.creditedUnits ?? 0);
      const balance = Number(m.balance ?? credited - consumed);

      perMeter.push({
        meterId: m.meterId,
        meterName: m.meter?.name ?? null,
        consumed,
        credited,
        balance,
      });

      totals.consumed += consumed;
      totals.credited += credited;
      totals.balance += balance;
    }
  }

  return {
    consumedUnits: totals.consumed,
    creditedUnits: totals.credited,
    balance: totals.balance,
  };
}

export async function getUsageForUserInPeriod(
  externalCustomerId: string,
  meterIds: string[],
  start: Date,
  end: Date,
) {
  const polar = createPolarSdk();
  let total = 0;

  for (const id of meterIds) {
    const res = await polar.meters.quantities({
      id,
      startTimestamp: start,
      endTimestamp: end,
      interval: "day",
      externalCustomerId, // filter to your user
    });
    total += Number(res.total ?? 0);
  }
  return total;
}
