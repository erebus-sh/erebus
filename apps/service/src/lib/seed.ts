// Simple PRNG seeded from string hash
export function seededRandom(seed: number): () => number {
  let state = seed;
  return function () {
    // xorshift32
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    // Convert to [0,1)
    return (state >>> 0) / 0xffffffff;
  };
}
