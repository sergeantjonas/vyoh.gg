import { Button } from "@/components/ui/button";
import { ControlHint } from "@/components/ui/control-hint";
import type { AdminSteamAccount } from "@vyoh/shared";
import { Trash2 } from "lucide-react";
import { useDeleteSteamAccount } from "./use-admin-accounts";

export function SteamAccountsTable({ rows }: { rows: AdminSteamAccount[] }) {
  const remove = useDeleteSteamAccount();

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Steam account tracked. The library and achievement surfaces resolve their own
        owner, so this list stays empty until one is added here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map(({ steamId64 }) => (
        <li
          key={steamId64}
          className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5"
        >
          <span className="font-mono text-xs text-foreground">{steamId64}</span>
          <ControlHint label="Remove from the roster">
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${steamId64}`}
              disabled={remove.isPending}
              onClick={() => remove.mutate(steamId64)}
            >
              <Trash2 />
            </Button>
          </ControlHint>
        </li>
      ))}
    </ul>
  );
}
