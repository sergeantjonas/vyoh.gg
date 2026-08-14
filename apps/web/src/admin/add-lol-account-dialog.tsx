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
import { PLATFORMS } from "@vyoh/shared";
import { Plus } from "lucide-react";
import { type ReactNode, type SubmitEvent, useState } from "react";
import { useCreateLolAccount } from "./use-admin-accounts";

const EMPTY = { slug: "", gameName: "", tagLine: "", region: "euw1", isOwner: false };

/**
 * Add-account form.
 *
 * Deliberately does no client-side validation beyond `required`: the api already
 * validates the slug shape, the Riot-ID charset, and the platform, and it is the
 * only side that can answer the question that actually matters — whether the
 * Riot ID exists. Mirroring its rules here would mean two sets to keep in step,
 * and the client's copy would be the one that goes stale.
 */
export function AddLolAccountDialog({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const create = useCreateLolAccount();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(form, {
      onSuccess: (account) => {
        void toastSuccess(`Tracking ${account.gameName}#${account.tagLine}`);
        setForm(EMPTY);
        setOpen(false);
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Drop a failed attempt's error with the dialog rather than letting it
        // greet the next open, when it no longer describes anything on screen.
        if (!next) create.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="xs" disabled={disabled}>
          <Plus />
          Add account
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="p-5">
        <DialogTitle>Track a League account</DialogTitle>
        <DialogDescription>
          The Riot ID is checked against Riot before the account is saved.
        </DialogDescription>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field id="slug" label="Slug" hint="URL segment — lowercase, digits and dashes">
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="ahri"
              autoComplete="off"
              required
            />
          </Field>

          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <Field id="gameName" label="Game name">
              <Input
                id="gameName"
                value={form.gameName}
                onChange={(e) => setForm({ ...form, gameName: e.target.value })}
                placeholder="Vyoh"
                autoComplete="off"
                required
              />
            </Field>
            <Field id="tagLine" label="Tag line">
              <Input
                id="tagLine"
                value={form.tagLine}
                onChange={(e) => setForm({ ...form, tagLine: e.target.value })}
                placeholder="EUW"
                autoComplete="off"
                required
              />
            </Field>
          </div>

          <Field id="region" label="Region">
            {/* Native select rather than the Radix one: 17 flat options with no
                grouping or search, and it avoids nesting a portalled listbox
                inside a portalled dialog for no gain. */}
            <select
              id="region"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isOwner}
              onChange={(e) => setForm({ ...form, isOwner: e.target.checked })}
              className="size-4 accent-primary"
            />
            <span>One of mine — counts toward the self-portrait</span>
          </label>

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
              {create.isPending ? "Checking with Riot…" : "Add account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
