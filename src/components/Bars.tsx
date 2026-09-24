export function Bars({
  rows,
}: {
  rows: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="text-sm text-ink-soft">Nothing in this filter.</p>;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{row.label}</span>
            <span className="text-ink-soft">{row.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#efe6d8]">
            <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: row.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
