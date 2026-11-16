import { IconHome } from "@tabler/icons-react";
import { isBuiltIn, isInExplore } from "../domain/feed";
import type { Feed } from "../domain/types";
import { ExploreMenu } from "./ExploreMenu";

type Props = Readonly<{
  feeds: readonly Feed[];
  current: Feed;
  onOpen: (name: string) => void;
}>;

/** Home, the Explore button, then the visitor's own feeds. Shelved feeds live in All tabs instead. */
export function TabBar({ feeds, current, onOpen }: Props) {
  const inBar = feeds.filter((f) => !f.shelved);
  const home = inBar.filter((f) => f.kind === "home");
  const explore = inBar.filter(isInExplore);
  const own = inBar.filter((f) => !isBuiltIn(f));
  const currentPage = (f: Feed) => (f.name === current.name ? "page" : undefined);

  return (
    <nav className="tab-bar" aria-label="Feeds">
      {home.map((f) => (
        <button
          key={f.name}
          type="button"
          className="tab tab-home"
          aria-label={`${f.name} (home)`}
          title={f.name}
          aria-current={currentPage(f)}
          onClick={() => onOpen(f.name)}
        >
          <IconHome size={17} aria-hidden="true" />
        </button>
      ))}
      {explore.length > 0 && <ExploreMenu feeds={explore} current={current} onOpen={onOpen} />}
      {own.map((f) => (
        <button key={f.name} type="button" className="tab" aria-current={currentPage(f)} onClick={() => onOpen(f.name)}>
          {f.name}
        </button>
      ))}
    </nav>
  );
}
