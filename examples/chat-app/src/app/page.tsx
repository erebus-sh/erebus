import Link from "next/link";

const demos = [
  {
    href: "/chat",
    title: "Basic Chat",
    description:
      "Real-time messaging using the imperative ErebusPubSubClient API. Publish and subscribe to a shared topic.",
  },
  {
    href: "/presence",
    title: "Presence Tracking",
    description:
      "See who is online in real time. Uses onPresence() to track join/leave events alongside chat messages.",
  },
  {
    href: "/typed",
    title: "Type-Safe Messaging",
    description:
      "Schema-validated messages with Zod and ErebusPubSubSchemas. Compile-time types plus runtime validation.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Erebus Chat Examples
          </h1>
          <p className="mt-2 text-neutral-500">
            Three demos showing different ways to use the Erebus SDK for
            real-time features.
          </p>
        </div>

        <div className="grid gap-4">
          {demos.map((demo) => (
            <Link
              key={demo.href}
              href={demo.href}
              className="block rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            >
              <h2 className="text-lg font-semibold">{demo.title}</h2>
              <p className="mt-1 text-sm text-neutral-500">
                {demo.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
