import type { Metadata } from "next";
import GuardLayout from "./components/guard-layout";
import NavbarConsole from "@/components/console/navbar-console";

export const metadata: Metadata = {
  title: "Erebus Console",
  description:
    "Manage your projects, settings, and real-time infrastructure in the Erebus Console. Access all your tools and resources in one place.",
  openGraph: {
    title: "Erebus Console",
    description:
      "Manage your projects, settings, and real-time infrastructure in the Erebus Console. Access all your tools and resources in one place.",
    images: [
      {
        url: "/opengraph.png",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function UserLayout({
  children,
  params,
  searchParams,
}: {
  children: React.ReactNode;
  params: Promise<{ "user-slug": string } & Record<string, string>>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <GuardLayout params={params} searchParams={searchParams}>
      <NavbarConsole />
      {children}
    </GuardLayout>
  );
}
