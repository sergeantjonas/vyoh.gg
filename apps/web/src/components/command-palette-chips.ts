import type { ParsedMatchQuery } from "@vyoh/shared";

export type ChipDescriptor = {
  key: string;
  label: string;
  // Returns the input with the matching token(s) removed. For union verbs
  // (with:/vs:/queue:/role:/patch:/duo:), only the exact token is dropped.
  // For last-wins verbs (since/until/kda), ALL tokens with the verb prefix
  // are dropped — otherwise removing a chip would silently re-activate an
  // earlier shadowed value the user can't see.
  remove: (input: string) => string;
};

function dropExact(input: string, lcToken: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.toLowerCase() !== lcToken)
    .join(" ");
}

function dropPrefix(input: string, prefix: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !t.toLowerCase().startsWith(prefix))
    .join(" ");
}

function lastTailWithPrefix(input: string, prefix: string): string | null {
  const tokens = input.toLowerCase().split(/\s+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t?.startsWith(prefix) && t.length > prefix.length) {
      return t.slice(prefix.length);
    }
  }
  return null;
}

export function buildChips(input: string, parsed: ParsedMatchQuery): ChipDescriptor[] {
  const chips: ChipDescriptor[] = [];

  for (const w of parsed.withChampions) {
    chips.push({
      key: `with:${w}`,
      label: `with: ${w}`,
      remove: (i) => dropExact(i, `with:${w}`),
    });
  }
  for (const v of parsed.vsChampions) {
    chips.push({
      key: `vs:${v}`,
      label: `vs: ${v}`,
      remove: (i) => dropExact(i, `vs:${v}`),
    });
  }
  if (parsed.outcome === "win") {
    chips.push({ key: "wins", label: "wins", remove: (i) => dropExact(i, "wins") });
  }
  if (parsed.outcome === "loss") {
    chips.push({ key: "losses", label: "losses", remove: (i) => dropExact(i, "losses") });
  }
  for (const q of parsed.queues) {
    chips.push({
      key: `queue:${q}`,
      label: `queue: ${q}`,
      remove: (i) => dropExact(i, `queue:${q}`),
    });
  }
  for (const r of parsed.roles) {
    chips.push({
      key: `role:${r}`,
      label: `role: ${r}`,
      remove: (i) => dropExact(i, `role:${r}`),
    });
  }
  for (const p of parsed.patches) {
    chips.push({
      key: `patch:${p}`,
      label: `patch: ${p}`,
      remove: (i) => dropExact(i, `patch:${p}`),
    });
  }
  for (const d of parsed.duos) {
    chips.push({
      key: `duo:${d}`,
      label: `duo: ${d}`,
      remove: (i) => dropExact(i, `duo:${d}`),
    });
  }
  if (parsed.since) {
    const tail = lastTailWithPrefix(input, "since:");
    chips.push({
      key: "since",
      label: `since: ${tail ?? ""}`,
      remove: (i) => dropPrefix(i, "since:"),
    });
  }
  if (parsed.until) {
    const tail = lastTailWithPrefix(input, "until:");
    chips.push({
      key: "until",
      label: `until: ${tail ?? ""}`,
      remove: (i) => dropPrefix(i, "until:"),
    });
  }
  if (parsed.kdaGt !== null) {
    chips.push({
      key: "kda>",
      label: `kda > ${parsed.kdaGt}`,
      remove: (i) => dropPrefix(i, "kda>"),
    });
  }
  if (parsed.kdaLt !== null) {
    chips.push({
      key: "kda<",
      label: `kda < ${parsed.kdaLt}`,
      remove: (i) => dropPrefix(i, "kda<"),
    });
  }

  return chips;
}
