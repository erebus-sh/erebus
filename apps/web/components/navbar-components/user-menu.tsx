"use client";

import {
  BoltIcon,
  // BookOpenIcon,
  // Layers2Icon,
  LogOutIcon,
  // PinIcon,
  // UserPenIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { toast } from "sonner";

interface User {
  avatar: string;
  name: string;
  email: string;
}

export default function UserMenu({ user }: { user: User }) {
  const { signOut } = useAuthActions();
  const [customerPortalUrl, setCustomerPortalUrl] = useState<string | null>(
    null,
  );
  const generateCustomerPortalUrl = useAction(
    api.polar.generateCustomerPortalUrl,
  );
  useEffect(() => {
    (async () => {
      const result = await generateCustomerPortalUrl();
      setCustomerPortalUrl(result.url);
    })();

    // Only run on mount or when slug changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
          <Avatar>
            <AvatarImage src={user.avatar} alt="Profile image" />
            <AvatarFallback>
              {user.name.charAt(0) + user.name.charAt(1)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-w-64" align="end">
        <DropdownMenuLabel className="flex min-w-0 flex-col">
          <span className="text-foreground truncate text-sm font-medium">
            {user.name}
          </span>
          <span className="text-muted-foreground truncate text-xs font-normal">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              if (customerPortalUrl) {
                window.open(customerPortalUrl, "_blank");
              } else {
                toast.error("Please wait a moment and try again.");
              }
            }}
          >
            <BoltIcon size={16} className="opacity-60" aria-hidden="true" />
            <span>Billing Portal</span>
          </DropdownMenuItem>
          {/* <DropdownMenuItem>
            <Layers2Icon size={16} className="opacity-60" aria-hidden="true" />
            <span>Option 2</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <BookOpenIcon size={16} className="opacity-60" aria-hidden="true" />
            <span>Option 3</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <PinIcon size={16} className="opacity-60" aria-hidden="true" />
            <span>Option 4</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <UserPenIcon size={16} className="opacity-60" aria-hidden="true" />
            <span>Option 5</span>
          </DropdownMenuItem> */}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOutIcon
            size={16}
            className="opacity-60"
            aria-hidden="true"
            onClick={() => void signOut()}
          />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
