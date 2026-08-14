import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toastSuccess } from "@/lib/toast";
import { Plus } from "lucide-react";
import { type SubmitEvent, useState } from "react";
import { useCreateSteamAccount } from "./use-admin-accounts";

export function AddSteamAccountDialog() {
  const [open, setOpen] = useState(false);
  const [steamId64, setSteamId64] = useState("");
  const create = useCreateSteamAccount();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(steamId64.trim(), {
      onSuccess: (account) => {
        void toastSuccess(`Tracking ${account.steamId64}`);
        setSteamId64("");
        setOpen(false);
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) create.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="xs">
          <Plus />
          Add account
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="p-5">
        <DialogTitle>Track a Steam account</DialogTitle>
        <DialogDescription>
          {/* No existence check on this one: there is no free Steam lookup that
              answers "is this a real profile" without spending an api request on
              a value typed by hand, and a wrong id is visible immediately as an
              empty library. */}
          The 17-digit Steam64 ID, from the profile URL or steamid.io.
        </DialogDescription>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="steamId64" className="font-medium">
              Steam64 ID
            </label>
            <Input
              id="steamId64"
              value={steamId64}
              onChange={(e) => setSteamId64(e.target.value)}
              placeholder="76561198000000000"
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </div>

          {create.error && (
            <p role="alert" className="text-sm text-destructive">
              {create.error.message}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending}>
              Add account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
