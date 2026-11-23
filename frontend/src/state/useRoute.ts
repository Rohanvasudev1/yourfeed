import { useSyncExternalStore } from "react";

/** The app's pages by path: the app itself and the showcase page (ADR 0014). Any other path shows the app. */
export const APP_PATH = "/";
export const ABOUT_PATH = "/about";

export type Route = "app" | "about";

const routeOf = (pathname: string): Route => (pathname.replace(/\/+$/, "") === ABOUT_PATH ? "about" : "app");

const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};

const currentPath = () => window.location.pathname;

/** The page the address bar names, following links and the browser's back and forward buttons. */
export function useRoute(): Route {
  return routeOf(useSyncExternalStore(subscribe, currentPath));
}

/** Opens `path` without reloading, as a new history entry; the hash and query are left behind. */
export function navigate(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
