import Link from "next/link";
import { Spotlight } from "@/components/ui/spotlight";
import SignInButton from "./components/sign-in-button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | Erebus.sh",
  description: "Sign in to your Erebus account",
};

export default function SignInPage() {
  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col justify-between px-4 py-10 sm:px-6 lg:px-8">
      <Spotlight />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="mb-6 bg-gradient-to-r from-zinc-50 to-zinc-300 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
          Sign in to continue
        </h1>

        <SignInButton />

        <Link
          href="/"
          className="mt-6 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Back to home page
        </Link>
      </div>

      <footer className="space-x-4 text-center text-xs text-zinc-500">
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
        <span>·</span>
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}
