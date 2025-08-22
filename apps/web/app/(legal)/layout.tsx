export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="bg-card border rounded-lg shadow-sm p-8">
          <article className="max-w-none">{children}</article>
        </div>
      </div>
    </div>
  );
}
