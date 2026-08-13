import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { useLogout } from "./use-viewer";

export function LogoutButton({ className }: { className?: string }) {
  const logout = useLogout();

  return (
    <Button
      variant="ghost"
      size="xs"
      className={cn("text-muted-foreground", className)}
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
    >
      <LogOut aria-hidden />
      Log out
    </Button>
  );
}
