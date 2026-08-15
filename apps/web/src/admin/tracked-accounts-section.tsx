import { useIsOwner } from "@/auth/use-viewer";
import { SectionTitle } from "@/components/ui/section-title";
import { AddLolAccountDialog } from "./add-lol-account-dialog";
import { LolAccountsTable } from "./lol-accounts-table";
import { useAdminLolAccounts } from "./use-admin-accounts";

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
 * League only. Steam has one id, it lives in `steam.config.ts`, and every Steam
 * surface resolves it from there — a manager for it would edit a table nothing
 * reads. A second Steam account is a schema arc (owned games, unlocks, sessions
 * and playtime snapshots all carry no owner column), not a missing table here.
 */
export function TrackedAccountsSection() {
  const isOwner = useIsOwner();
  // Called before the gate below, not after — hook order has to stay stable
  // across the flip from pending viewer to confirmed owner. `enabled` is what
  // keeps a signed-out visit from firing a request that is known to 401.
  const lol = useAdminLolAccounts(isOwner);

  if (!isOwner) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionTitle as="h2">Tracked accounts</SectionTitle>
        <AddLolAccountDialog />
      </div>
      {lol.data ? (
        <LolAccountsTable rows={lol.data} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading roster…</p>
      )}
    </section>
  );
}
