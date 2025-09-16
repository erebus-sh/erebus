import { EclipseIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

interface BannerProps {
  text: string;
  textLink: string;
  textLinkHref: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export default function Banner({
  text,
  textLink,
  textLinkHref,
  icon: Icon,
}: BannerProps) {
  const iconStyle = "me-3 -mt-0.5 inline-flex opacity-60";
  return (
    <div className="dark bg-muted text-foreground px-4 py-3">
      <p className="text-center text-sm">
        {Icon ? (
          <Icon
            className={iconStyle}
            aria-hidden="true"
            width={16}
            height={16}
          />
        ) : (
          <EclipseIcon
            className={iconStyle}
            aria-hidden="true"
            width={16}
            height={16}
          />
        )}
        {text} <span className="text-muted-foreground">·</span>{" "}
        <a
          href={textLinkHref}
          className="font-medium underline hover:no-underline"
        >
          {textLink}
        </a>
      </p>
    </div>
  );
}
