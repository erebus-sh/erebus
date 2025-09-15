"use client";

import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { useEffect } from "react";

export const MessagesClientSide = () => {
  const [expired, setExpired] = useQueryState("expired");

  useEffect(() => {
    (async () => {
      /*
       * I hate react, I swear to god man WTF
       * I need this because for some reason, the toast is not
       * showing up if you immediately call it, because I guess
       * some SSR render pipeline BS, bruhhhhhh!
       *
       */
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (expired) {
        toast.error(
          "Your subscription has expired. Please renew your subscription to continue.",
        );
        setExpired(null);
      }
    })();
  }, [expired, setExpired]);

  return <></>;
};
