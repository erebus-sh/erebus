import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Document title from frontmatter
    h1: ({ children, ...props }) => (
      <h1
        className="text-4xl font-bold mb-8 text-foreground font-mono tracking-tight border-b border-border pb-4"
        {...props}
      >
        {children}
      </h1>
    ),

    // Section headings
    h2: ({ children, ...props }) => (
      <h2
        className="text-2xl font-semibold mb-6 mt-12 text-foreground font-mono tracking-tight scroll-mt-20"
        {...props}
      >
        {children}
      </h2>
    ),

    h3: ({ children, ...props }) => (
      <h3
        className="text-xl font-medium mb-4 mt-8 text-foreground font-mono tracking-tight scroll-mt-20"
        {...props}
      >
        {children}
      </h3>
    ),

    h4: ({ children, ...props }) => (
      <h4
        className="text-lg font-medium mb-3 mt-6 text-foreground font-mono tracking-tight scroll-mt-20"
        {...props}
      >
        {children}
      </h4>
    ),

    // Paragraphs with proper spacing
    p: ({ children, ...props }) => (
      <p
        className="mb-6 text-muted-foreground leading-relaxed font-mono text-sm"
        {...props}
      >
        {children}
      </p>
    ),

    // Lists with better spacing
    ul: ({ children, ...props }) => (
      <ul
        className="list-disc list-inside mb-6 space-y-2 text-muted-foreground font-mono text-sm ml-4"
        {...props}
      >
        {children}
      </ul>
    ),

    ol: ({ children, ...props }) => (
      <ol
        className="list-decimal list-inside mb-6 space-y-2 text-muted-foreground font-mono text-sm ml-4"
        {...props}
      >
        {children}
      </ol>
    ),

    li: ({ children, ...props }) => (
      <li
        className="text-muted-foreground font-mono text-sm leading-relaxed"
        {...props}
      >
        {children}
      </li>
    ),

    // Links with consistent styling
    a: ({ href, children, className, ...props }) => {
      // Handle anchor links (internal TOC links)
      if (href?.startsWith("#")) {
        return (
          <a
            href={href}
            className={`text-primary hover:text-primary/80 font-mono text-sm transition-colors duration-200 no-underline hover:underline ${className || ""}`}
            {...props}
          >
            {children}
          </a>
        );
      }

      // External links
      return (
        <a
          href={href}
          className={`text-primary hover:text-primary/80 font-mono underline transition-colors duration-200 ${className || ""}`}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },

    // Enhanced blockquotes
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="border-l-2 border-primary/30 pl-6 my-6 italic text-muted-foreground bg-muted/20 py-4 rounded-r font-mono text-sm"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Code blocks
    code: ({ children, ...props }) => (
      <code
        className="bg-muted/50 px-2 py-1 rounded text-xs font-mono text-foreground border"
        {...props}
      >
        {children}
      </code>
    ),

    pre: ({ children, ...props }) => (
      <pre
        className="bg-muted/30 p-6 rounded-lg overflow-x-auto my-6 border font-mono text-sm"
        {...props}
      >
        {children}
      </pre>
    ),

    // Enhanced table of contents
    nav: ({ children, ...props }) => {
      return (
        <>
          {/* Floating TOC Sidebar - Positioned in the left margin area */}
          <nav
            className="fixed top-20 left-4 w-64 max-h-[calc(100vh-6rem)] overflow-y-auto
                       bg-background border rounded-lg shadow-lg p-4
                       hidden lg:block
                       scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            {...props}
          >
            <div className="mb-3 pb-2 border-b border-border">
              <h2 className="text-base font-semibold text-foreground font-mono tracking-tight">
                Table of Contents
              </h2>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {children}
            </div>
          </nav>

          {/* Mobile TOC - Collapsible at top of content */}
          <details className="lg:hidden mb-8 bg-background border rounded-lg shadow-sm">
            <summary className="p-4 cursor-pointer font-mono text-sm font-semibold text-foreground hover:bg-muted transition-colors">
              Table of Contents
            </summary>
            <div className="px-4 pb-4 space-y-1 text-sm border-t border-border mt-2 pt-3 text-muted-foreground">
              {children}
            </div>
          </details>
        </>
      );
    },

    // Strong text
    strong: ({ children, ...props }) => (
      <strong className="font-semibold text-foreground font-mono" {...props}>
        {children}
      </strong>
    ),

    // Emphasis
    em: ({ children, ...props }) => (
      <em className="italic text-muted-foreground font-mono" {...props}>
        {children}
      </em>
    ),

    // HR divider
    hr: ({ ...props }) => <hr className="my-12 border-border" {...props} />,

    ...components,
  };
}
