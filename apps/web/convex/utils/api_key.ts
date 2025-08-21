import { customAlphabet } from "nanoid";

const API_KEY_LENGTH = 48;
const API_KEY_PREFIX_PROD = "sk-er-";
const API_KEY_PREFIX_DEV = "dv-er-";

export function generateApiKey(isDev: boolean) {
  const nanoid = customAlphabet(
    "0123456789_abcdefghijklmnopqrstuvwxyz",
    API_KEY_LENGTH,
  );
  return isDev
    ? API_KEY_PREFIX_DEV + nanoid(API_KEY_LENGTH)
    : API_KEY_PREFIX_PROD + nanoid(API_KEY_LENGTH);
}
