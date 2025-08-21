import ky from "ky";

const CLIENT_NAME = "erebus-service-client";

interface BaseClientOptions {
  base_url?: string;
}

export const baseClient = ({ base_url }: BaseClientOptions) =>
  ky.create({
    prefixUrl: base_url ?? "https://api.erebus.sh/v1/",
    headers: {
      "content-type": "application/json",
    },
    hooks: {
      beforeRequest: [
        (request) => {
          request.headers.set("x-client", CLIENT_NAME);
        },
      ],
    },
  });
