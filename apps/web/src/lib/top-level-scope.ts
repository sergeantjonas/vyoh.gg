// The top-level scope is the first path segment of the URL (with a leading
// slash), or "/" if the path has no segments. Used by the root layout to key
// route-transition animations so siblings within a section don't replay them.
export function topLevelScope(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ? `/${seg}` : "/";
}
