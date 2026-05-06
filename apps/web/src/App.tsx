import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MatchList } from "@/lol/match-list";
import { useMatches } from "@/lol/use-matches";
import { useState } from "react";

const REGION = "euw1";

function App() {
  const [name, setName] = useState("");
  const [submittedName, setSubmittedName] = useState("");
  const matches = useMatches(REGION, submittedName);

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
            setSubmittedName(name.trim());
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Summoner name"
          />
          <Button type="submit">Search</Button>
        </form>

        {matches.isPending && submittedName && (
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
