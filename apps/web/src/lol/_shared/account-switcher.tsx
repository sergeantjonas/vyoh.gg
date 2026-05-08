import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMe } from "@/identity/use-me";
import { useNavigate, useRouterState } from "@tanstack/react-router";

export function AccountSwitcher({ currentSlug }: { currentSlug: string }) {
  const me = useMe();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const accounts = me.data?.lol ?? [];

  if (accounts.length <= 1) {
    return null;
  }

  const segment = pathname.split("/")[3];
  const tabRoute =
    segment === "trends"
      ? "/lol/$accountSlug/trends"
      : segment === "champions"
        ? "/lol/$accountSlug/champions"
        : "/lol/$accountSlug/matches";

  return (
    <Select
      value={currentSlug}
      onValueChange={(slug) =>
        navigate({
          to: tabRoute,
          params: { accountSlug: slug },
          search: (prev) => prev,
        })
      }
    >
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.slug} value={a.slug}>
            {a.gameName}
            <span className="text-muted-foreground">#{a.tagLine}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
