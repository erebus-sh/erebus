import { Slot } from "@radix-ui/react-slot";
import type { ReactNode } from "react";

export function slot(
  obj:
    | {
        enabled?: boolean;
        component?: ReactNode;
      }
    | undefined,
  def: ReactNode,
  customComponentProps?: object,
  disabled?: ReactNode,
): ReactNode {
  if (obj?.enabled === false) return disabled;
  if (obj?.component !== undefined)
    return <Slot {...customComponentProps}>{obj.component}</Slot>;

  return def;
}

export function slots<Comp extends Record<string, ReactNode>>(
  variant: keyof Comp,
  obj:
    | {
        enabled?: boolean;
        configuration?: Comp;
      }
    | undefined,
  def: ReactNode,
): ReactNode {
  if (obj?.enabled === false) return;
  if (obj?.configuration?.[variant] !== undefined)
    return <Slot>{obj.configuration[variant]}</Slot>;

  return def;
}
