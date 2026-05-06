const QUEUE_TYPES: Record<number, string> = {
  400: "Normal Draft",
  420: "Ranked Solo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  700: "Clash",
  830: "Co-op vs AI Intro",
  840: "Co-op vs AI Beginner",
  850: "Co-op vs AI Intermediate",
  900: "URF",
  1300: "Nexus Blitz",
  1700: "Arena",
  1900: "URF",
};

export function queueTypeName(queueId: number): string {
  return QUEUE_TYPES[queueId] ?? `Queue ${queueId}`;
}
