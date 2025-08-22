import React from "react";

interface DocumentMetadata {
  title?: string;
  description?: string;
  lastUpdated?: string;
  [key: string]: any;
}

interface MDXDocumentProps {
  children: React.ReactNode;
  metadata?: DocumentMetadata;
}

export function MDXDocument({ children, metadata }: MDXDocumentProps) {
  if (!metadata) {
    return <div className="lg:ml-72">{children}</div>;
  }

  return (
    <div className="lg:ml-72">
      {/* Document header with metadata */}
      <div className="mb-8 pb-6 border-b border-border">
        <div className="space-y-2">
          {metadata.lastUpdated && (
            <p className="text-sm text-muted-foreground font-mono">
              Last updated: {metadata.lastUpdated}
            </p>
          )}
          {metadata.description && (
            <p className="text-base text-muted-foreground font-mono leading-relaxed">
              {metadata.description}
            </p>
          )}
        </div>
      </div>

      {/* Document content */}
      {children}
    </div>
  );
}

// Helper function to extract metadata from MDX exports
export function createDocumentWithMetadata(
  Component: React.ComponentType,
  metadata?: DocumentMetadata,
) {
  return function DocumentWithMetadata() {
    return (
      <MDXDocument metadata={metadata}>
        <Component />
      </MDXDocument>
    );
  };
}
