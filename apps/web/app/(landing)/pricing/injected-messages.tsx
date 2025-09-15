import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { useEffect } from "react";

export const InjectedMessagesClientSide = () => {
  const [expired, setExpired] = useQueryState("expired");

  useEffect(() => {
    if (expired) {
      toast.error(
        "Your subscription has expired. Please renew your subscription to continue.",
      );
      setExpired(null);
    }
  }, [expired, setExpired]);

  return <></>;
};
