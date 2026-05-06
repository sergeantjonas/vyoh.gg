export function MatchListSkeleton() {
  return (
    <ul className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <li
          key={i}
          className="flex animate-pulse items-center gap-4 rounded-md border p-3"
        >
          <div className="h-12 w-1 rounded-full bg-muted" />
          <div className="size-12 rounded-md bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
          <div className="space-y-2 text-right">
            <div className="ml-auto h-4 w-20 rounded bg-muted" />
            <div className="ml-auto h-3 w-24 rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}
