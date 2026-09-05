export type RolePosition = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

export function isRolePosition(value: string): value is RolePosition {
  return (
    value === "TOP" ||
    value === "JUNGLE" ||
    value === "MIDDLE" ||
    value === "BOTTOM" ||
    value === "UTILITY"
  );
}
