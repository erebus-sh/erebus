import { Hono } from "hono";

export const wellUnknownRoute = new Hono().get("/", (c) => {
  return c.text(
    [
      "Make your choice",
      "Let it be the one you need",
      "Don't lose your way",
      "Just for any old thing",
      " ",
      " ",
      "It's not what you thought",
      "It's what you needed to see",
    ]
      .join("\n")
      .trim(),
    200,
  );
});
