import { OWNER_ONLY_COPY } from "@/auth/owner-action";
import { useIsOwner } from "@/auth/use-viewer";
import { CardTitle } from "@/components/ui/card-title";
import { SectionTitle } from "@/components/ui/section-title";
import { useMe } from "@/identity/use-me";
import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Lock } from "lucide-react";
import { AddLolAccountDialog } from "./add-lol-account-dialog";
import { AddSteamAccountDialog } from "./add-steam-account-dialog";
import { LolAccountsTable } from "./lol-accounts-table";
import { SteamAccountsTable } from "./steam-accounts-table";
import {
  mergeRoster,
  mergeSteamRoster,
  useAdminLolAccounts,
  useAdminSteamAccounts,
} from "./use-admin-accounts";

/**
 * Roster management.
 *
 * Stacked rather than the two-column layout the plan sketched: the LoL table
 * carries four control columns across nine rows while the Steam card is one row
 * of one field, so side-by-side starves the half that needs the width and pads
 * the half that doesn't.
 */
export function TrackedAccountsSection() {
  const isOwner = useIsOwner();
  const { data: me } = useMe();
  const lolDetail = useAdminLolAccounts(isOwner);
  const steamDetail = useAdminSteamAccounts(isOwner);

  const lolRows = mergeRoster(me?.lol ?? [], lolDetail.data);
  const steamRows = mergeSteamRoster(me?.steam ?? [], steamDetail.data);

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle as="h2">Tracked accounts</SectionTitle>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle as="h3">League accounts</CardTitle>
              {!isOwner && <LockedHint />}
            </div>
            <AddLolAccountDialog disabled={!isOwner} />
          </div>
          <LolAccountsTable rows={lolRows} isOwner={isOwner} />
        </div>

        <div className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle as="h3">Steam accounts</CardTitle>
              {!isOwner && <LockedHint />}
            </div>
            <AddSteamAccountDialog disabled={!isOwner} />
          </div>
          <SteamAccountsTable rows={steamRows} isOwner={isOwner} />
        </div>
      </div>
    </section>
  );
}

// One lock per card rather than one per control: the row already renders every
// button disabled, and a padlock beside each would read as ten separate problems
// instead of one signed-out session.
function LockedHint() {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <span className="inline-flex text-muted-foreground">
          <Lock className="size-3" aria-label="Read-only — owner sign-in required" />
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="bottom"
          sideOffset={4}
          className={TOOLTIP_CONTENT_COMPACT}
        >
          {OWNER_ONLY_COPY}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
