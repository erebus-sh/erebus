import { EventCreateCustomer } from "@polar-sh/sdk/models/components/eventcreatecustomer.js";
import { createPolarSdk } from "../lib/polar";
import { EventCreateExternalCustomer } from "@polar-sh/sdk/models/components/eventcreateexternalcustomer.js";

/**
 * Helper function to retrieve a Polar customer by user ID.
 * Convex automatically adds the userId as metadata when creating customers
 * in the Polar portal, allowing us to look up customers by their internal user ID.
 *
 * @param userId - The internal user ID from our system
 * @returns The Polar customer object associated with the user
 */
async function helperGetPolarCustomerByUserId(userId: string) {
  const polarSdk = createPolarSdk();
  const res = await polarSdk.customers.list({
    metadata: { userId },
  });
  return res.result.items[0];
}

/**
 * Ingests usage meter events for a user in the Polar billing portal.
 *
 * This function creates and sends "Erebus Gateway Messages" events to Polar for each unit
 * of usage consumed by the user. Polar uses these events to track usage against meters,
 * which can trigger billing based on configured pricing rules and thresholds.
 *
 * Each event represents one unit of usage (e.g., one message sent through the gateway).
 * Polar automatically determines which pricing triggers or meters to update based on
 * the customer subscription.
 *
 * @param userId - The internal user ID from our system
 * @param count - Number of usage events to ingest (each represents one unit of usage)
 * @returns Promise resolving to the Polar API response from ingesting events
 */
export async function ingestMetersForUserId(userId: string, count: number) {
  const polarSdk = createPolarSdk();

  // Find the user's Polar customer record using their internal user ID
  // This works because Convex stores the userId in customer metadata during creation
  const userPolarCustomer = await helperGetPolarCustomerByUserId(userId);

  // Ingest a usage event for the user in Polar.
  // - The event name ("Erebus Gateway Messages") can be any name.
  // - The `event` metadata field ("websocket-message") must match the meter filter in the polar console.
  // - The `webSocketMessages` field provides the numeric value to be summed for usage aggregation.
  // - The timestamp is set to the current time.
  return await polarSdk.events.ingest({
    events: [
      {
        name: "Erebus Gateway Messages", // Event name, can be any name.
        customerId: userPolarCustomer.id, // Polar customer ID for this user.
        metadata: {
          event: "websocket-message", // Used by Polar meter filter to match this event.
          webSocketMessages: count, // Number of messages to increment usage by (for "Sum" aggregation).
        },
        timestamp: new Date(), // Current timestamp for the event.
      },
    ],
  });
}

/**
 * Retrieves a comprehensive usage snapshot for a user across all their meters.
 *
 * This function aggregates usage data from all meters associated with the user,
 * providing totals for consumed units, credited units, and current balance.
 * The balance represents the net usage after credits are applied.
 *
 * @param userId - The internal user ID from our system
 * @returns Object containing total consumed units, credited units, and balance
 */
export async function getUsageSnapshotForUser(userId: string) {
  const polar = createPolarSdk();

  const userPolarCustomer = await helperGetPolarCustomerByUserId(userId);

  // Fetch all meters for this customer, paginated (limit 100 per page)
  const pages = await polar.customerMeters.list({
    externalCustomerId: userPolarCustomer.id,
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

  // Process each page of meters, calculating totals for each meter
  for await (const page of pages) {
    for (const m of page.result.items) {
      const consumed = Number(m.consumedUnits ?? 0);
      const credited = Number(m.creditedUnits ?? 0);
      // Balance is net usage after credits; use Polar's balance if available, otherwise calculate
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

/**
 * Retrieves total usage for a specific customer across multiple meters within a date range.
 *
 * This function queries Polar's meter quantities API to get usage data for the specified
 * meters and time period. It aggregates usage across all provided meter IDs to give
 * a total usage count for the period.
 *
 * @param externalCustomerId - The Polar external customer ID
 * @param meterIds - Array of meter IDs to query usage for
 * @param start - Start date for the usage period
 * @param end - End date for the usage period
 * @returns Total usage units across all specified meters for the period
 */
export async function getUsageForUserInPeriod(
  externalCustomerId: string,
  meterIds: string[],
  start: Date,
  end: Date,
) {
  const polar = createPolarSdk();
  let total = 0;

  // Aggregate usage across all specified meters for the time period
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
