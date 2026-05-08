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
