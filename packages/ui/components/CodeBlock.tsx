import CopyButton from "./CopyButton";

export default function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[11px] text-muted">{label ?? "shell"}</span>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
