// Keep all pattern formatting in one place (avoid string soup in handlers)
export function orgPattern(org: string) {
  return `${org}:*`;
}

export function groupPattern(org: string, group?: string) {
  return group ? `${org}:${group}:*` : `${org}:*`; // fallback if no group
}
