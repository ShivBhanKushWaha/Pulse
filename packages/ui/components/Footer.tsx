export default function Footer() {
  return (
    <footer className="border-t border-border px-8 py-6 text-xs text-muted">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          Pulse — your metrics stay in your own database. This dashboard only caches what you export.
        </span>
        <span>v0.1.0</span>
      </div>
    </footer>
  );
}
