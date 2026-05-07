import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMe } from "@/identity/use-me";
import { useNavigate } from "@tanstack/react-router";

export function AccountSwitcher({ currentSlug }: { currentSlug: string }) {
  const me = useMe();
  const navigate = useNavigate();
  const accounts = me.data?.lol ?? [];

  if (accounts.length <= 1) {
    return null;
  }

  return (
    <Select
      value={currentSlug}
      onValueChange={(slug) =>
        navigate({
          to: "/lol/$accountSlug/matches",
          params: { accountSlug: slug },
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
