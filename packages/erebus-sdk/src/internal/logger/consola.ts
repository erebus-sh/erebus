import { createConsola } from "consola";

export const logger = createConsola({
  level: 3,
  formatOptions: {
    colors: true,
    date: true,
    compact: false,
    columns:
      typeof process !== "undefined" && process.stdout && process.stdout.columns
        ? process.stdout.columns
        : 80,
  },
  defaults: {
    tag: "Erebus",
  },
});
