import { expect, test } from "vitest";
import { shuffleString } from "../utils/shuffle";
import { nanoid } from "nanoid";

test("shuffleString produces a permutation of the input for 100 random ids of varying length", () => {
  // Generate 100 random ids with lengths from 2 to 32
  for (let i = 0; i < 100; i++) {
    const len = 2 + Math.floor(i * (30 / 99)); // 2 to 32
    const original = nanoid(len);
    const shuffled = shuffleString(original);

    // Should be same length
    expect(shuffled.length).toBe(original.length);
    expect(shuffled).not.toBe(original);

    // Should be a permutation: same chars, same counts
    const origSorted = original.split("").sort().join("");
    const shufSorted = shuffled.split("").sort().join("");
    expect(shufSorted).toBe(origSorted);

    console.log(original, shuffled);

    // Should not always be the same as original (but sometimes it can be, so we don't assert inequality)
  }
});
