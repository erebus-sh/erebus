"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

type TabType = "cli" | "code";

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
    name: "code",
    label: "Code",
    content: [
      "import { Erebus } from '@erebus-sh/sdk';",
      "",
      "const erebus = new Erebus({",
      "  apiKey: 'your-api-key',",
      "  region: 'us-east-1'",
      "});",
      "",
      "// Example usage",
      "const result = await erebus.query({",
      "  collection: 'users',",
      "  filter: { status: 'active' }",
      "});",
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
    }, 500);

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
        className="relative w-full min-w-0 overflow-hidden bg-card border border-border font-mono text-sm text-card-foreground shadow-lg ring-1 ring-ring/20 rounded-lg"
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
            className="overflow-hidden"
            animate={{ height: containerHeight }}
            transition={{
              duration: 0.4,
              ease: [0.4, 0.0, 0.2, 1],
              type: "spring",
              bounce: 0,
            }}
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
                          duration: 0.3,
                          delay: index * 0.1,
                          ease: "easeOut",
                        }}
                      >
                        <span className="text-chart-2">$</span> {step}
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              ) : (
                // Code Tab - Syntax highlighted with line numbers
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
                                duration: 0.3,
                                delay: lineIndex * 0.05,
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
