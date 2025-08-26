import { Hono } from "hono";
import { decodeBin } from "@/lib/utils";

const toYou = [
  decodeBin(
    "082f3c3263175f0e03475b4a5f0b3b20",
    process.env.SECRET_YOU ?? "wrong_key",
  ),
  decodeBin(
    "092b23772a1a101914474c4a5542372b2b772e2c1b101514025c",
    process.env.SECRET_YOU ?? "wrong_key",
  ),
  decodeBin(
    "01213970374e5c140202185b5f172a6539362e",
    process.env.SECRET_YOU ?? "wrong_key",
  ),
  decodeBin(
    "0f3b242363085f095106565b100d34216e233f2a0057",
    process.env.SECRET_YOU ?? "wrong_key",
  ),
  decodeBin(
    "0c3a702463005f0f511050434442212a3b77232b01451c1913",
    process.env.SECRET_YOU ?? "wrong_key",
  ),
  decodeBin(
    "0c3a70246319581a0547414d454236202b3332274e441451145d47",
    process.env.SECRET_YOU ?? "wrong_key",
  ),
  decodeBin("707c6565", process.env.SECRET_YOU ?? "wrong_key"),
];

const scram = [2, 11, 3, 5, 6, 6, 11, 1, 4, 0, 7, 7, 7]
  .map((i) => "uyImois...s "[i] ?? "")
  .join("");

export const youRoute = new Hono()
  .get(`/${process.env.PATH_TO_YOU_1}`, (c) => {
    const random = toYou[Math.floor(Math.random() * toYou.length)];
    const you = Array(5 + Math.floor(Math.random() * 50))
      .fill(scram)
      .join("\n");

    return c.text([random, "", you].join("\n").trim(), 200);
  })
  .get(`/${process.env.PATH_TO_YOU_2}`, (c) => {
    const you = Array(5 + Math.floor(Math.random() * 50))
      .fill(scram)
      .join("\n");

    return c.text([you].join("\n").trim(), 200);
  });
