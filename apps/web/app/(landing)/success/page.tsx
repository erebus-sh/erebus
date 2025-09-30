"use client";

import { useRouter } from "next/navigation";
import { useNextRedirect } from "@/hooks/useNextRedirect";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { EventName } from "@/analytics/enums";

const BEAM_COUNT = 6;

// Control the intensity of background blur: one of
// "blur-none", "blur-xs", "blur-sm", "blur", "blur-md", "blur-lg", "blur-xl", "blur-2xl", "blur-3xl"
const BACKGROUND_BLUR_CLASS = "blur-xs";

// Beam colors to cycle through
const beamColors = [
  "bg-blue-500/20",
  "bg-purple-500/20",
  "bg-green-500/20",
  "bg-pink-500/20",
  "bg-cyan-500/20",
  "bg-orange-500/20",
];

// Generate beam configurations dynamically
const beamConfigs = Array.from({ length: BEAM_COUNT }, (_, i) => ({
  delay: i * 0.8, // Stagger delays
  duration: 8 + (i % 4), // Vary durations between 8-11 seconds
  from: i % 2 === 0 ? "left" : "right", // Alternate directions
  color: beamColors[i % beamColors.length],
  y: 20 + i * 12, // Space beams vertically
}));

const textBlobs = [
  { text: "Erebus delivering messages", delay: 1, beam: 0 },
  { text: "Real-time sync complete", delay: 3, beam: 2 },
  { text: "Network established", delay: 5, beam: 4 },
  { text: "Connection secured", delay: 2, beam: 1 },
];

function AnimatedBeam({ config }: { config: (typeof beamConfigs)[0] }) {
  return (
    <>
      {/* Main beam line */}
      <div
        className={`absolute h-0.5 w-full ${config.color} opacity-60`}
        style={{
          top: `${config.y}%`,
          animationDelay: `${config.delay}s`,
          animationDuration: `${config.duration}s`,
        }}
      >
        {/* Moving light along the beam */}
        <div
          className={`absolute h-2 w-20 ${config.color.replace("/20", "/60")} blur-sm animate-pulse`}
          style={{
            top: "-0.25rem",
            animationDelay: `${config.delay}s`,
            animationDuration: `${config.duration}s`,
            left: config.from === "left" ? "-20px" : "calc(100% + 20px)",
            animation: `beam-${config.from} ${config.duration}s ease-in-out infinite`,
          }}
        />
      </div>

      {/* Floating particles along beam */}
      {[...Array(3)].map((_, particleIndex) => (
        <div
          key={particleIndex}
          className={`absolute w-1 h-1 ${config.color.replace("/20", "/80")} rounded-full`}
          style={{
            top: `${config.y}%`,
            animationDelay: `${config.delay + particleIndex * 0.5}s`,
            animationDuration: `${config.duration}s`,
            left: config.from === "left" ? "-4px" : "calc(100% + 4px)",
            animation: `particle-${config.from} ${config.duration}s linear infinite`,
          }}
        />
      ))}
    </>
  );
}

function FloatingTextBlob({
  blob,
  beamConfig,
}: {
  blob: (typeof textBlobs)[0];
  beamConfig: (typeof beamConfigs)[0];
}) {
  return (
    <div
      className="absolute text-xs text-muted-foreground/70 bg-background/10 backdrop-blur-sm px-2 py-1 rounded-md whitespace-nowrap pointer-events-none"
      style={{
        top: `${beamConfig.y - 3}%`,
        animationDelay: `${blob.delay}s`,
        animationDuration: `${beamConfig.duration}s`,
        left: beamConfig.from === "left" ? "-100px" : "calc(100% + 100px)",
        animation: `text-${beamConfig.from} ${beamConfig.duration}s ease-in-out infinite`,
      }}
    >
      {blob.text}
    </div>
  );
}

export default function SuccessPage() {
  const { hasNext, redirectNow } = useNextRedirect();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Show modal after a brief delay
    const timer = setTimeout(() => setShowModal(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleRedirect = () => {
    posthog.capture(EventName.FinishedSuccess);
    if (hasNext) {
      redirectNow();
    } else {
      router.push("/c");
    }
  };

  return (
    <>
      {/* Global styles for beam animations */}
      <style jsx global>{`
        @keyframes beam-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(100vw);
          }
        }
        @keyframes beam-right {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100vw);
          }
        }
        @keyframes particle-left {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateX(100vw);
            opacity: 0;
          }
        }
        @keyframes particle-right {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateX(-100vw);
            opacity: 0;
          }
        }
        @keyframes text-left {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateX(100vw);
            opacity: 0;
          }
        }
        @keyframes text-right {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateX(-100vw);
            opacity: 0;
          }
        }
      `}</style>

      <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-background via-background/95 to-background/90">
        {/* Animated Background with Beams */}
        <div className={`absolute inset-0 ${BACKGROUND_BLUR_CLASS}`}>
          {/* Background gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-green-500/5" />

          {/* Animated beams */}
          {beamConfigs.map((config, index) => (
            <AnimatedBeam key={index} config={config} />
          ))}

          {/* Floating text blobs */}
          {textBlobs.map((blob, index) => (
            <FloatingTextBlob
              key={index}
              blob={blob}
              beamConfig={beamConfigs[blob.beam]}
            />
          ))}

          {/* Additional ambient elements */}
          <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-xl animate-pulse" />
          <div
            className="absolute bottom-20 right-20 w-24 h-24 bg-purple-500/10 rounded-full blur-xl animate-pulse"
            style={{ animationDelay: "2s" }}
          />
          <div
            className="absolute top-1/2 left-1/4 w-16 h-16 bg-green-500/10 rounded-full blur-lg animate-pulse"
            style={{ animationDelay: "4s" }}
          />
        </div>

        {/* Success Modal - Sharp and focused */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent
            className="sm:max-w-md backdrop-blur-sm bg-background/95 border-border/50 shadow-2xl"
            showCloseButton={false}
          >
            <DialogHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircleIcon className="w-8 h-8 text-green-500" />
              </div>
              <DialogTitle className="text-2xl font-bold">
                Payment Successful!
              </DialogTitle>
              <DialogDescription className="text-base">
                Your checkout was completed successfully. You can now access
                your new features and start using Erebus.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="pt-6">
              <Button
                onClick={handleRedirect}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                Take me there
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
