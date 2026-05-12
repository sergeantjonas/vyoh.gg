import { LeagueOfLegendsIcon, SteamIcon } from "@/components/brand-icons";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useMe } from "@/identity/use-me";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Crown, History, Home, TrendingUp, User } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CommandPaletteDialog({ open, onOpenChange }: Props) {
  const me = useMe();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentSlug = pathname.match(/^\/lol\/([^/]+)/)?.[1];

  function go(path: string) {
    onOpenChange(false);
    // biome-ignore lint/suspicious/noExplicitAny: palette navigates by raw path
    navigate({ to: path as any });
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Pages">
          <CommandItem value="home" onSelect={() => go("/")}>
            <Home /> Home
          </CommandItem>
          <CommandItem value="lol league" onSelect={() => go("/lol")}>
            <LeagueOfLegendsIcon className="size-4" /> League of Legends
          </CommandItem>
          <CommandItem value="steam" onSelect={() => go("/steam")}>
            <SteamIcon className="size-4" /> Steam
          </CommandItem>
        </CommandGroup>

        {me.data?.lol && me.data.lol.length > 0 && (
          <CommandGroup heading="Accounts">
            {me.data.lol.map((acc) => (
              <CommandItem
                key={acc.slug}
                value={`${acc.gameName} ${acc.tagLine} ${acc.slug}`}
                onSelect={() => go(`/lol/${acc.slug}`)}
              >
                <User />
                <span>
                  {acc.gameName}
                  <span className="text-muted-foreground">#{acc.tagLine}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {currentSlug && (
          <CommandGroup heading="Current account">
            <CommandItem
              value={`${currentSlug} profile overview`}
              onSelect={() => go(`/lol/${currentSlug}`)}
            >
              <User /> Profile
            </CommandItem>
            <CommandItem
              value={`${currentSlug} matches history`}
              onSelect={() => go(`/lol/${currentSlug}/matches`)}
            >
              <History /> Matches
            </CommandItem>
            <CommandItem
              value={`${currentSlug} trends stats`}
              onSelect={() => go(`/lol/${currentSlug}/trends`)}
            >
              <TrendingUp /> Trends
            </CommandItem>
            <CommandItem
              value={`${currentSlug} champions mastery`}
              onSelect={() => go(`/lol/${currentSlug}/champions`)}
            >
              <Crown /> Champions
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center justify-end border-t px-3 py-2 text-xs text-muted-foreground">
        <span>
          Press{" "}
          <CommandShortcut className="ml-1 rounded border bg-muted/50 px-1.5 py-0.5">
            ⌘K
          </CommandShortcut>{" "}
          anywhere
        </span>
      </div>
    </CommandDialog>
  );
}
