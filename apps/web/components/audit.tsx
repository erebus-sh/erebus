import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/ui/timeline";
import { formatRelativeTime } from "@/utils/timeLanguage";
import Image from "next/image";

export interface AuditProps {
  id: string;
  date: string;
  title: string;
  action: string;
  description: string;
  image: string;
}

export default function Audit({ items }: { items: AuditProps[] }) {
  return (
    <Timeline>
      {items.map((item, index) => (
        <TimelineItem
          key={item.id}
          step={index + 1}
          className="group-data-[orientation=vertical]/timeline:ms-10 group-data-[orientation=vertical]/timeline:not-last:pb-8"
        >
          <TimelineHeader>
            <TimelineSeparator className="group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-6.5" />
            <TimelineTitle className="mt-0.5">
              {item.title}{" "}
              <span className="text-muted-foreground text-sm font-normal">
                {item.action}
              </span>
            </TimelineTitle>
            <TimelineIndicator className="bg-primary/10 group-data-completed/timeline-item:bg-primary group-data-completed/timeline-item:text-primary-foreground flex size-6 items-center justify-center border-none group-data-[orientation=vertical]/timeline:-left-7">
              <Image
                src={item.image}
                alt={item.title}
                className="size-6 rounded-full"
              />
            </TimelineIndicator>
          </TimelineHeader>
          <TimelineContent className="text-foreground mt-2 rounded-lg border px-4 py-3">
            {item.description}
            <TimelineDate className="mt-1 mb-0">
              {formatRelativeTime(item.date)}
            </TimelineDate>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
}
