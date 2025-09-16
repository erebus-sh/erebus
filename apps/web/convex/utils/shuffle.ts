/**
 * Shuffles the characters of a string and **guarantees a different result**
 * when the input has more than 1 unique character.
 *
 * Combines Fisher–Yates algorithm with a post-check to force a visible change.
 *
 * @param str - Input string to shuffle.
 * @returns A shuffled string that is **not equal to the input**, if possible.
 */
export function shuffleStringAndObfuscate(str: string): string {
  const original = str.split("");

  // If too short or identical chars (like "aaa"), nothing to shuffle.
  const distinct = new Set(original);
  if (original.length < 2 || distinct.size < 2) {
    return str;
  }

  // Fisher–Yates shuffle
  const shuffled = [...original];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Force change if result equals input (occasional edge case)
  if (shuffled.join("") === str) {
    const i = 0;
    let j = 1;
    while (shuffled[j] === shuffled[i] && j < shuffled.length) j++;
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // TODO: test if this will work
  // Obfuscate the shuffled string
  let obfuscated = "";
  for (let i = 0; i < shuffled.length; i++) {
    const code = shuffled[i].charCodeAt(0) + 1;
    // Ensure the result is an English letter (a-z, A-Z) or digit (0-9)
    let nextChar = String.fromCharCode(code);

    if (/[a-zA-Z0-9]/.test(nextChar)) {
      obfuscated += nextChar;
    } else {
      // If not, wrap around: for 'z' -> 'a', 'Z' -> 'A', '9' -> '0'
      if (shuffled[i] === "z") obfuscated += "a";
      else if (shuffled[i] === "Z") obfuscated += "A";
      else if (shuffled[i] === "9") obfuscated += "0";
      else obfuscated += shuffled[i]; // fallback, should rarely happen
    }
  }

  return obfuscated;
}
