import { OrbGlyph } from "@/components/orb-glyph";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <OrbGlyph className="size-24" />
      <p className="text-lg font-medium">No such page.</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Wherever you were heading, vyoh.gg hasn't been there yet.
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link to="/">Back home</Link>
      </Button>
    </div>
  );
}
