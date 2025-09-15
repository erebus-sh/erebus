"use client";

import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { useEffect } from "react";
import { Reason } from "@/app/enums/reason";

export const MessagesClientSide = () => {
  const [reason, setReason] = useQueryState("reason");

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
      if (reason === Reason.EXPIRED) {
        toast.error(
          "Your subscription has expired. Please renew your subscription to continue.",
        );
        setReason(null);
      } else if (reason === Reason.FIRST_TIME) {
        toast.error("You need to subscribe before you can access the console.");
        setReason(null);
      }
    })();
  }, [reason, setReason]);

  return <></>;
};
