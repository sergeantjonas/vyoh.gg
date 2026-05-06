import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MatchList } from "@/lol/match-list";
import { useMatches } from "@/lol/use-matches";
import { useState } from "react";

const REGION = "euw1";

function App() {
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [submitted, setSubmitted] = useState({ gameName: "", tagLine: "" });
  const matches = useMatches(REGION, submitted.gameName, submitted.tagLine);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">vyoh.gg</h1>
          <p className="text-sm text-muted-foreground">
            Cross-platform gaming dashboard.
          </p>
        </header>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted({
              gameName: gameName.trim(),
              tagLine: tagLine.trim(),
            });
          }}
        >
          <Input
            value={gameName}
            onChange={(event) => setGameName(event.target.value)}
            placeholder="Game name"
            className="flex-1"
          />
          <Input
            value={tagLine}
            onChange={(event) => setTagLine(event.target.value)}
            placeholder="Tag (e.g. EUW)"
            className="w-24"
          />
          <Button type="submit">Search</Button>
        </form>

        {matches.isPending && submitted.gameName && submitted.tagLine && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {matches.isError && (
          <p className="text-sm text-destructive">{matches.error.message}</p>
        )}
        {matches.data && <MatchList matches={matches.data} />}
      </div>
    </main>
  );
}

export default App;
