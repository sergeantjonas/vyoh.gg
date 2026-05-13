import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QUEUE_OPTIONS } from "@/lol/_shared/queue-options";
import { useNavigate, useSearch } from "@tanstack/react-router";

const ALL_VALUE = "__all__";

/**
 * Browse-only queue picker — writes `?queue=<id>` for the page to consume.
 *
 * Do NOT mount this on analytical surfaces (Champions, Trends, Recap,
 * ritual). Those already filter through `filterToSerious`, which strips
 * non-serious queues (ARAM, Arena, Quickplay, Swarm) before any aggregation
 * runs. Layering this picker on top is a footgun: selecting ARAM yields an
 * empty page because the queue was dropped one step earlier. The
 * serious-queues popover in the account header is the right control for
 * those surfaces.
 */
export function QueueFilter() {
  const navigate = useNavigate();
  const { queue } = useSearch({ from: "/lol/$accountSlug" });

  const value = queue !== undefined ? String(queue) : ALL_VALUE;

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const nextQueue = next === ALL_VALUE ? undefined : Number(next);
        navigate({
          to: ".",
          search: (prev) => ({ ...prev, queue: nextQueue }),
        });
      }}
    >
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {QUEUE_OPTIONS.map((opt) => (
          <SelectItem
            key={opt.id ?? ALL_VALUE}
            value={opt.id !== undefined ? String(opt.id) : ALL_VALUE}
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
