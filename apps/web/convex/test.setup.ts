// @ts-expect-error vite types are not available in Convex typecheck environment
// See: https://docs.convex.dev/testing/convex-test#custom-convex-folder-name-or-location
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
