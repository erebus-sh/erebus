import { create } from "zustand";

interface NavStackItem {
  label: string;
  href: string;
}

interface NavStackState {
  navStack: NavStackItem[];
  currentPath: string;
  pushPage: (page: NavStackItem, optimistic?: boolean) => void;
  replacePage: (page: NavStackItem, optimistic?: boolean) => void;
  popPage: () => void;
  resetStack: () => void;
}

function logNav(tag: string, ...args: unknown[]) {
  console.log(`[NAV-STACK][${tag}]`, ...args);
}

function handleOptimisticNavigation(href: string, optimistic: boolean) {
  logNav("handleOptimisticNavigation:called", { href, optimistic });
  if (optimistic) {
    if (typeof window !== "undefined") {
      logNav("handleOptimisticNavigation:replaceState", { href });
      window.history.replaceState(window.history.state, "", href);
    } else {
      logNav(
        "handleOptimisticNavigation:error",
        "window is not defined, but optimistic is true",
      );
      throw new Error("window is not defined, but optimistic is true");
    }
  }
}

export const useNavStackStore = create<NavStackState>((set) => ({
  navStack: [],
  currentPath: "",
  pushPage: (page, optimistic = false) =>
    set((state) => {
      logNav("pushPage:called", { page, optimistic, navStack: state.navStack });
      if (state.navStack.some((item) => item.href === page.href)) {
        logNav("pushPage:alreadyInStack", { page });
        return { navStack: state.navStack };
      }
      handleOptimisticNavigation(page.href, optimistic);
      logNav("pushPage:setCurrentPath", { href: page.href });
      set({ currentPath: page.href });
      const newStack = [...state.navStack, page];
      logNav("pushPage:newStack", { newStack });
      return { navStack: newStack };
    }),
  replacePage: (page, optimistic = false) =>
    set((state) => {
      logNav("replacePage:called", {
        page,
        optimistic,
        navStack: state.navStack,
      });
      // Find the last item in the stack that shares the same base path as the new page
      // For example, if you are at /keys and go to /usage, both are under /projects/[proj-slug]
      // So we want to replace the last segment, not append
      // We'll define "base" as everything up to the last slash
      const getBase = (href: string) => {
        // Remove trailing slash if present
        const clean =
          href.endsWith("/") && href.length > 1 ? href.slice(0, -1) : href;
        // Remove last segment
        return clean.substring(0, clean.lastIndexOf("/"));
      };

      const newBase = getBase(page.href);
      logNav("replacePage:newBase", { newBase });

      // Find the index of the last item in the stack that shares the same base
      let replaceIdx = -1;
      for (let i = state.navStack.length - 1; i >= 0; i--) {
        if (getBase(state.navStack[i].href) === newBase) {
          replaceIdx = i;
          logNav("replacePage:foundReplaceIdx", {
            replaceIdx,
            href: state.navStack[i].href,
          });
          break;
        }
      }

      // If found, replace that item, otherwise just push
      let newStack;
      if (replaceIdx !== -1) {
        newStack = [...state.navStack.slice(0, replaceIdx), page];
        logNav("replacePage:replacedStack", { newStack });
      } else {
        newStack = [...state.navStack, page];
        logNav("replacePage:pushedStack", { newStack });
      }

      handleOptimisticNavigation(page.href, optimistic);
      // We intentionally do not update currentPath here to keep it anchored to the project root.
      // This prevents paths from being recursively concatenated like "/keys/usage".
      logNav("replacePage:keptCurrentPath", { currentPath: state.currentPath });
      return { navStack: newStack };
    }),
  popPage: () =>
    set((state) => {
      logNav("popPage:called", { navStack: state.navStack });
      const newStack = state.navStack.slice(0, -1);
      logNav("popPage:newStack", { newStack });
      return { navStack: newStack };
    }),
  resetStack: () => {
    logNav("resetStack:called");
    set({ navStack: [] });
  },
}));
