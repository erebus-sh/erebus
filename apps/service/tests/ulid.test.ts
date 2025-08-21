import { it, expect } from "vitest";
import { monotonicFactory, decodeTime } from "ulid";
import { hashStringToSeed } from "@/lib/hash";
import { seededRandom } from "@/lib/seed";

it("compares ULIDs using < > and decodeTime", () => {
  const seed = hashStringToSeed("test-seed");
  const prng = seededRandom(seed);
  const ulidGen = monotonicFactory(prng);
  const t = Date.now();

  // Generate 5 ULIDs with the same timestamp
  const ulids: string[] = [];
  for (let i = 0; i < 5; i++) {
    ulids.push(ulidGen(t));
  }

  console.log("\nGenerated ULIDs:");
  ulids.forEach((u, i) => console.log(`ULID[${i}]: ${u}`));

  // Check strict lexicographic order: prev < next should be true, prev > next should be false
  for (let i = 1; i < ulids.length; i++) {
    const prev = ulids[i - 1];
    const next = ulids[i];

    console.log(`Compare lex: ULID[${i - 1}] < ULID[${i}] = ${prev < next}`);
    expect(prev < next).toBe(true); // ULID is lexically sorted

    console.log(`Compare lex: ULID[${i - 1}] > ULID[${i}] = ${prev > next}`);
    expect(prev > next).toBe(false); // Should not be greater
  }

  // Check decodeTime equivalence (all should be same!)
  for (let i = 1; i < ulids.length; i++) {
    const prev = decodeTime(ulids[i - 1]);
    const next = decodeTime(ulids[i]);

    console.log(
      `Compare time: decodeTime[${i - 1}] === decodeTime[${i}] = ${prev === next}`,
    );
    expect(prev).toBe(next); // SAME millisecond
  }
});

it("generates 100K ULIDs and checks for collisions", () => {
  const input = "some random string";
  const seed = hashStringToSeed(input);

  const prng = seededRandom(seed);
  const ulidGen = monotonicFactory(prng);

  const t = Date.now();

  const seen = new Set<string>();
  let collision = null;
  let collisionIndex = -1;
  let firstUlid = "";
  let lastUlid = "";

  for (let i = 0; i < 100000; i++) {
    const ulid = ulidGen(t);
    if (i === 0) firstUlid = ulid;
    if (i === 99999) lastUlid = ulid;
    if (seen.has(ulid)) {
      collision = ulid;
      collisionIndex = i;
      break;
    }
    seen.add(ulid);
    // Print a sample every 10,000
    if (i % 10000 === 0 || i === 99999) {
      console.log(`Sample ULID at index ${i}: ${ulid}`);
    }
  }

  if (collision) {
    console.log(`Collision detected at index ${collisionIndex}: ${collision}`);
  } else {
    console.log("No collisions detected in 20,000 ULIDs.");
  }

  console.log(`First ULID: ${firstUlid}`);
  console.log(`Last ULID: ${lastUlid}`);
  console.log(`Total unique ULIDs: ${seen.size}`);

  expect(collision).toBeNull();

  // Also check determinism for the first ULID
  const prng2 = seededRandom(seed);
  const ulidGen2 = monotonicFactory(prng2);
  const ulid1b = ulidGen2(t);
  expect(firstUlid).toBe(ulid1b);

  const decodedTime = decodeTime(firstUlid);
  expect(decodedTime).toBe(t);
});
