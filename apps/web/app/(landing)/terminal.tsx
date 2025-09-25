"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

type TabType = "cli" | "client" | "server";

interface TabData {
  name: TabType;
  label: string;
  content: string[];
}

const tabs: TabData[] = [
  {
    name: "cli",
    label: "CLI",
    content: ["npm install erebus"],
  },
  {
    name: "client",
    label: "Client",
    content: [
      'import { ErebusClient, ErebusClientState } from "@erebus-sh/sdk/client";',
      "",
      "const client = ErebusClient.createClient({",
      "  client: ErebusClientState.PubSub,",
      '  authBaseUrl: "http://localhost:3000",  // your auth domain',
      '  wsBaseUrl: "ws://localhost:8787",  // your ws domain (optional if you self-host locally)',
      "});",
      "",
      "async function main() {",
      '  const topic = "room1";',
      "  // Join a channel first",
      '  client.joinChannel("chats");',
      "  // Connect",
      "  await client.connect();",
      "  // Wait for 5 seconds, to connect and update the state",
      "  // TODO: the .connect should be sync, but it's not right now, will fix the SDK later",
      "  await new Promise((r) => setTimeout(r, 5000));",
      "  ",
      "  // Subscribe to a channel",
      "  client.subscribe(topic, (msg) => {",
      '    console.log("📩 Received:", msg.payload, "from", msg.senderId);',
      "  });",
      "",
      "  client.onPresence(topic, (presence) => {",
      '    console.log("📩 Presence:", presence);',
      "  });",
      "",
      "  // Wait for 1 seconds, to subscribe and update the state",
      "  // TODO: the .subscribe and .onPresence should be synced and separated, but it's not right now, will fix the SDK later",
      "  await new Promise((r) => setTimeout(r, 1000));",
      "",
      "  // Publish a message",
      "  await client.publishWithAck({",
      "    topic: topic,",
      '    messageBody: "Hello Erebus 👋",',
      "    onAck: (ack) => {",
      '      console.log("✅ Message acknowledged:", ack.ack);',
      "    },",
      "  });",
      "}",
      "",
      "main().catch(console.error);",
    ],
  },
  {
    name: "server",
    label: "Server",
    content: [
      "// ... Previous code ...",
      "// Imports go to top of the file ofc",
      'import { createGenericAdapter } from "@erebus-sh/sdk/server";',
      'import { Access, ErebusService } from "@erebus-sh/sdk/service";',
      'import Bun from "bun";',
      "",
      'const SECRET_API_KEY = process.env.SECRET_API_KEY || "demo-secret-key"; // replace with your own secret_api_key from the platform',
      "",
      "",
      "const app = createGenericAdapter({",
      "  authorize: async (channel, ctx) => {",
      "    // Normally you'd check cookies, headers, or DB here",
      "    const userId = Math.random().toString(36).substring(2, 15);",
      "",
      "    const service = new ErebusService({",
      "      secret_api_key: SECRET_API_KEY,",
      '      base_url: "http://localhost:3000", // (optional if you self-host locally) where your Erebus service is running, default is https://api.erebus.sh',
      "    });",
      "",
      "    // Create a session for this user",
      "    const session = await service.prepareSession({ userId });",
      "",
      "    // Join the requested channel",
      "    session.join(channel);",
      "",
      "    // Allow reads + writes",
      '    session.allow("*", Access.ReadWrite);',
      "",
      "    return session;",
      "  },",
      "  fireWebhook: async (message) => {",
      "    // You can handle the webhook message here",
      "  },",
      "});",
      "",
      "Bun.serve({",
      "  port: 4919,",
      "  fetch: app.fetch,",
      "});",
      "",
      'console.log("✅ Auth server running at http://localhost:3000");',
    ],
  },
];

export function Terminal() {
  const [currentTab, setCurrentTab] = useState<TabType>("cli");
  const [terminalStep, setTerminalStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number | "auto">(
    "auto",
  );
  const contentRef = useRef<HTMLDivElement>(null);

  const currentTabData = tabs.find((tab) => tab.name === currentTab)!;
  const terminalSteps = currentTabData.content;

  // Get the appropriate code theme based on current theme
  const codeTheme = themes.synthwave84;

  useEffect(() => {
    // Reset terminal step when switching tabs
    setTerminalStep(0);
  }, [currentTab]);

  // Calculate content height for smooth expansion
  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setContainerHeight(height);
    }
  }, [currentTab, terminalStep, terminalSteps]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerminalStep((prev) =>
        prev < terminalSteps.length - 1 ? prev + 1 : prev,
      );
    }, 50);

    return () => clearTimeout(timer);
  }, [terminalStep, terminalSteps.length]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(terminalSteps.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="relative w-full min-w-0 max-h-[600px] overflow-hidden bg-card border border-border font-mono text-sm text-card-foreground shadow-lg ring-1 ring-ring/20 rounded-lg"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        role="region"
        aria-label="Interactive code terminal"
      >
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex space-x-2">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30"></div>
              <div className="h-2 w-2 rounded-full bg-muted-foreground/20"></div>
              <div className="h-2 w-2 rounded-full bg-muted-foreground/10"></div>
            </div>
            <button
              onClick={copyToClipboard}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-5 w-5" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="mb-4 flex space-x-2 text-xs">
            {tabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => setCurrentTab(tab.name)}
                className={clsx(
                  "relative isolate flex h-6 cursor-pointer items-center justify-center rounded-full px-2.5 transition-colors",
                  currentTab === tab.name
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80",
                )}
                aria-pressed={currentTab === tab.name}
                aria-label={`Show ${tab.label} content`}
              >
                {tab.label}
                {tab.name === currentTab && (
                  <motion.div
                    layoutId="terminal-tab"
                    className="absolute inset-0 -z-10 rounded-full bg-muted"
                    initial={false}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Expanding Content Container */}
          <motion.div
            className="overflow-y-auto overflow-x-hidden"
            animate={{ height: containerHeight }}
            transition={{
              duration: 0.4,
              ease: [0.4, 0.0, 0.2, 1],
              type: "spring",
              bounce: 0,
            }}
            style={{ maxHeight: "500px" }}
          >
            <div ref={contentRef} className="space-y-1">
              {currentTab === "cli" ? (
                // CLI Tab - Simple terminal output
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    {terminalSteps.map((step, index) => (
                      <motion.div
                        key={`${currentTab}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{
                          opacity: index <= terminalStep ? 1 : 0,
                          x: index <= terminalStep ? 0 : -10,
                        }}
                        transition={{
                          duration: 0.1,
                          delay: index * 0.01,
                          ease: "easeOut",
                        }}
                      >
                        <span className="text-chart-2">$</span> {step}
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              ) : (
                // Client Tab and Server Tab - Syntax highlighted with line numbers
                <motion.div
                  key={currentTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Highlight
                    code={terminalSteps.join("\n")}
                    language="javascript"
                    theme={codeTheme}
                  >
                    {({
                      className,
                      style,
                      tokens,
                      getLineProps,
                      getTokenProps,
                    }) => (
                      <pre
                        className={clsx(className, "overflow-x-auto")}
                        style={{
                          ...style,
                          background: "transparent",
                          margin: 0,
                          padding: 0,
                        }}
                      >
                        <code>
                          {tokens.map((line, lineIndex) => (
                            <motion.div
                              key={lineIndex}
                              {...getLineProps({ line })}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{
                                opacity: lineIndex <= terminalStep ? 1 : 0,
                                x: lineIndex <= terminalStep ? 0 : -10,
                              }}
                              transition={{
                                duration: 0.08,
                                delay: lineIndex * 0.005,
                                ease: "easeOut",
                              }}
                              className="table-row"
                            >
                              {/* Line number */}
                              <span className="table-cell pr-4 text-right text-muted-foreground select-none min-w-[2rem] opacity-50">
                                {String(lineIndex + 1).padStart(2, "0")}
                              </span>
                              {/* Code content */}
                              <span className="table-cell">
                                {line.map((token, tokenIndex) => (
                                  <span
                                    key={tokenIndex}
                                    {...getTokenProps({ token })}
                                  />
                                ))}
                              </span>
                            </motion.div>
                          ))}
                        </code>
                      </pre>
                    )}
                  </Highlight>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
