import { useIsOwner } from "@/auth/use-viewer";
import { CardTitle } from "@/components/ui/card-title";
import { SectionTitle } from "@/components/ui/section-title";
import { AddLolAccountDialog } from "./add-lol-account-dialog";
import { AddSteamAccountDialog } from "./add-steam-account-dialog";
import { LolAccountsTable } from "./lol-accounts-table";
import { SteamAccountsTable } from "./steam-accounts-table";
import { useAdminLolAccounts, useAdminSteamAccounts } from "./use-admin-accounts";

/**
 * Roster management.
 *
 * Absent for anyone but the owner, rather than rendered read-only the way the
 * sync controls above are. That pattern earns its place there because the data
 * around the locked buttons is public and worth reading — last tick, durations,
 * backfill counts. Here it would be the inverse: the account list is already in
 * the nav, so a signed-out visitor would get a duplicate of it wrapped in
 * controls that can never do anything.
 *
 * Stacked rather than the two-column layout the plan sketched: the LoL table
 * carries four control columns across nine rows while the Steam card is one row
 * of one field, so side-by-side starves the half that needs the width.
 */
export function TrackedAccountsSection() {
  const isOwner = useIsOwner();
  // Called before the gate below, not after — hook order has to stay stable
  // across the flip from pending viewer to confirmed owner. `enabled` is what
  // keeps a signed-out visit from firing a request that is known to 401.
  const lol = useAdminLolAccounts(isOwner);
  const steam = useAdminSteamAccounts(isOwner);

  if (!isOwner) return null;

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle as="h2">Tracked accounts</SectionTitle>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <CardTitle as="h3">League accounts</CardTitle>
            <AddLolAccountDialog />
          </div>
          {lol.data ? (
            <LolAccountsTable rows={lol.data} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading roster…</p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <CardTitle as="h3">Steam accounts</CardTitle>
            <AddSteamAccountDialog />
          </div>
          {steam.data ? (
            <SteamAccountsTable rows={steam.data} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading roster…</p>
          )}
        </div>
      </div>
    </section>
  );
}
