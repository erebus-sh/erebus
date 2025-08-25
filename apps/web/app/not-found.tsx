import Link from "next/link";
import Logo from "@/components/navbar-components/logo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle watermark logo */}
      <div className="absolute top-8 left-8 opacity-30 pointer-events-none">
        <Logo size="sm" />
      </div>

      {/* Main content container with golden ratio proportions */}
      <div className="flex min-h-screen">
        {/* Left side - Content */}
        <div className="flex-1 flex flex-col justify-center px-16 py-24">
          <div className="max-w-md space-y-16">
            {/* Connection lost message */}
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
                404
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed font-light">
                The requested endpoint is unavailable or has been disconnected
                from the network.
              </p>
            </div>

            {/* Navigation link */}
            <div>
              <Link
                href="/"
                className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors group"
              >
                Reconnect to home
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="ml-2 transition-transform group-hover:translate-x-1"
                >
                  <path
                    d="M6 12L10 8L6 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Right side - Abstract network visualization */}
        <div className="flex-1 relative flex items-center justify-center p-16">
          <div className="relative w-full h-full max-w-lg max-h-lg">
            {/* Primary spiral - golden ratio based */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                width="320"
                height="320"
                viewBox="0 0 320 320"
                fill="none"
                className="text-muted-foreground/20"
              >
                <defs>
                  <radialGradient id="spiralGradient" cx="50%" cy="50%" r="50%">
                    <stop
                      offset="0%"
                      stopColor="currentColor"
                      stopOpacity="0.1"
                    />
                    <stop
                      offset="100%"
                      stopColor="currentColor"
                      stopOpacity="0"
                    />
                  </radialGradient>
                </defs>

                {/* Golden ratio spiral */}
                <path
                  d="M160 160 Q200 120, 240 160 Q280 200, 240 240 Q200 280, 160 240 Q120 200, 160 160"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="animate-pulse"
                  style={{ animationDuration: "4s" }}
                />

                {/* Inner spiral */}
                <path
                  d="M160 160 Q180 140, 200 160 Q220 180, 200 200 Q180 220, 160 200 Q140 180, 160 160"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  opacity="0.6"
                  className="animate-pulse"
                  style={{ animationDuration: "3s", animationDelay: "1s" }}
                />

                {/* Concentric circles */}
                <circle
                  cx="160"
                  cy="160"
                  r="60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  opacity="0.3"
                />
                <circle
                  cx="160"
                  cy="160"
                  r="90"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.3"
                  opacity="0.2"
                />
                <circle
                  cx="160"
                  cy="160"
                  r="120"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.2"
                  opacity="0.1"
                />
              </svg>
            </div>

            {/* Packet routes - converging lines */}
            <div className="absolute inset-0">
              <svg
                width="320"
                height="320"
                viewBox="0 0 320 320"
                fill="none"
                className="text-primary/15"
              >
                {/* Horizontal packet routes */}
                <line
                  x1="40"
                  y1="160"
                  x2="120"
                  y2="160"
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity="0.4"
                />
                <line
                  x1="200"
                  y1="160"
                  x2="280"
                  y2="160"
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity="0.4"
                />

                {/* Vertical routes */}
                <line
                  x1="160"
                  y1="40"
                  x2="160"
                  y2="120"
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity="0.4"
                />
                <line
                  x1="160"
                  y1="200"
                  x2="160"
                  y2="280"
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity="0.4"
                />

                {/* Diagonal routes */}
                <line
                  x1="80"
                  y1="80"
                  x2="120"
                  y2="120"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  opacity="0.3"
                />
                <line
                  x1="200"
                  y1="80"
                  x2="240"
                  y2="120"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  opacity="0.3"
                />
                <line
                  x1="80"
                  y1="240"
                  x2="120"
                  y2="200"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  opacity="0.3"
                />
                <line
                  x1="200"
                  y1="240"
                  x2="240"
                  y2="200"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  opacity="0.3"
                />
              </svg>
            </div>

            {/* Intersecting circles - channel representation */}
            <div className="absolute inset-0">
              <svg
                width="320"
                height="320"
                viewBox="0 0 320 320"
                fill="none"
                className="text-muted-foreground/10"
              >
                {/* Channel circles */}
                <circle
                  cx="120"
                  cy="120"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity="0.5"
                />
                <circle
                  cx="200"
                  cy="120"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity="0.5"
                />
                <circle
                  cx="120"
                  cy="200"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity="0.5"
                />
                <circle
                  cx="200"
                  cy="200"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  opacity="0.5"
                />
                <circle
                  cx="160"
                  cy="160"
                  r="60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  opacity="0.3"
                />

                {/* Intersection points */}
                <circle
                  cx="160"
                  cy="100"
                  r="2"
                  fill="currentColor"
                  opacity="0.4"
                  className="animate-pulse"
                />
                <circle
                  cx="220"
                  cy="160"
                  r="2"
                  fill="currentColor"
                  opacity="0.4"
                  className="animate-pulse"
                  style={{ animationDelay: "0.5s" }}
                />
                <circle
                  cx="160"
                  cy="220"
                  r="2"
                  fill="currentColor"
                  opacity="0.4"
                  className="animate-pulse"
                  style={{ animationDelay: "1s" }}
                />
                <circle
                  cx="100"
                  cy="160"
                  r="2"
                  fill="currentColor"
                  opacity="0.4"
                  className="animate-pulse"
                  style={{ animationDelay: "1.5s" }}
                />
              </svg>
            </div>

            {/* Data flow particles */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute w-1 h-1 bg-primary/30 rounded-full animate-bounce"
                style={{
                  left: "30%",
                  top: "50%",
                  animationDuration: "3s",
                  animationDelay: "0s",
                }}
              ></div>
              <div
                className="absolute w-1 h-1 bg-muted-foreground/40 rounded-full animate-bounce"
                style={{
                  left: "70%",
                  top: "30%",
                  animationDuration: "4s",
                  animationDelay: "1s",
                }}
              ></div>
              <div
                className="absolute w-1 h-1 bg-primary/20 rounded-full animate-bounce"
                style={{
                  left: "50%",
                  top: "70%",
                  animationDuration: "2.5s",
                  animationDelay: "2s",
                }}
              ></div>
            </div>

            {/* Subtle grid overlay */}
            <div className="absolute inset-0 opacity-5">
              <svg
                width="320"
                height="320"
                viewBox="0 0 320 320"
                fill="none"
                className="text-muted-foreground"
              >
                <defs>
                  <pattern
                    id="grid"
                    width="20"
                    height="20"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 20 0 L 0 0 0 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="0.5"
                      opacity="0.3"
                    />
                  </pattern>
                </defs>
                <rect width="320" height="320" fill="url(#grid)" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
