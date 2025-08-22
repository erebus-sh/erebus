import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Terminal } from "./terminal";
import { Spotlight } from "@/components/ui/spotlight-new";

export function Hero({ id }: { id: string }) {
  return (
    <section id={id} className="py-20 sm:py-32 md:py-40">
      <Spotlight />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="sm:text-center md:mx-auto md:max-w-2xl lg:col-span-6 lg:text-left">
            <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Erebus
              <span className="text-primary block">
                Realtime as a Service. Designed for Edge.
              </span>
            </h1>
            <p className="text-muted-foreground mt-3 text-base sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
              Drop-in real-time messaging at the edge. Erebus runs your pub/sub
              backend on global infrastructure — fast, stateful, and dead
              simple.
            </p>
            <div className="mt-8 sm:mx-auto sm:max-w-lg sm:text-center lg:mx-0 lg:text-left">
              <a href={process.env.NEXT_PUBLIC_DOCS_URL} target="_blank">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full text-lg"
                >
                  Get started now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>
          <div className="relative mt-12 sm:mx-auto sm:max-w-lg lg:col-span-6 lg:mx-0 lg:mt-0 lg:flex lg:max-w-none lg:items-center">
            <Terminal />
          </div>
        </div>
      </div>
    </section>
  );
}
