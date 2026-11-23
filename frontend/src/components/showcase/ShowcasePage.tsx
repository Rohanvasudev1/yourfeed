import { IconAdjustmentsHorizontal, IconArrowLeft } from "@tabler/icons-react";
import { useCallback, type ReactNode } from "react";
import type { Video } from "../../domain/types";
import type { AssistantPort, CatalogLoader } from "../../ports";
import { useAssistantInfo } from "../../state/useAssistantInfo";
import { useCatalog } from "../../state/useCatalog";
import { APP_PATH } from "../../state/useRoute";
import { useShowcase } from "../../state/useShowcase";
import { CatalogError } from "../CatalogError";
import { RouteLink } from "../RouteLink";
import { LiveCards, LiveMirror, LiveRecipe } from "./ShowcaseLive";
import "./showcase.css";

type Props = Readonly<{ loadCatalog: CatalogLoader; assistant: AssistantPort }>;

/** The live demo pieces, one per idea that has one. */
type Pieces = Readonly<{ recipe: ReactNode; mirror: ReactNode; cards: ReactNode }>;

const BACK = "Back to the app";

function Idea({ id, title, children }: Readonly<{ id: string; title: string; children: ReactNode }>) {
  return (
    <section className="showcase-idea" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

/** The design case (ADR 0014): each claim is one an ADR makes. */
function Argument({ pieces }: Readonly<{ pieces: Pieces }>) {
  return (
    <>
      <Idea id="idea-contract" title="The recipe is a contract">
        <p>
          Every feed has a recipe: the topics, channels and mutes you chose, and how long its videos and sessions run. Only you change it: with its
          controls, by asking the Claude bar, or by accepting a proposal. Each request is one undo step and one line in the feed’s recipe log, and the last three live lines go
          along with the next request, so “no, shorter” works without a chat.
        </p>
        <p className="showcase-try">Try “add cooking” or “shorter videos”, then undo.</p>
        {pieces.recipe}
      </Idea>
      <Idea id="idea-mirror" title="The recipe mirror">
        <p>
          What you do proposes changes; it never makes them. When at least three things you did on a feed in the last 14 days disagree with its
          recipe (finishing videos outside its length range, removing one topic again and again, pinning a muted topic), a card offers the change.
          Accepting is one undo step with a log line; dismissing hides it for 7 days. No model is involved, and a feed gets at most one proposal a
          visit.
        </p>
        <p className="showcase-try">This demo feed has had three videos of one of its topics removed in the last day.</p>
        {pieces.mirror}
      </Idea>
      <Idea id="idea-outside" title="Outside your recipe">
        <p>
          Each session gets one video from a topic next to the feed’s, labelled as
          such, and you can turn it off per feed. Every card says why it’s there, so the one from outside is never disguised.
        </p>
        {pieces.cards}
      </Idea>
      <Idea id="idea-declaration" title="Personalised by declaration, not profiling">
        <ul className="showcase-points">
          <li>The ranker orders only your own catalog, from your recipe, what you did in Yourfeed, recency and channel.</li>
          <li>View counts never rank anything outside the Most viewed feed.</li>
          <li>What you did here (finished, removed, skipped, pinned, watched) never changes your recipe by itself: it can only propose a change, and you decide.</li>
          <li>In demo mode your feeds stay in this browser. Signed in, they’re kept with your account, and you can delete them.</li>
        </ul>
      </Idea>
    </>
  );
}

/** The live pieces, once the demo catalog is in. */
function LiveArgument({ catalog, assistant }: Readonly<{ catalog: readonly Video[]; assistant: AssistantPort }>) {
  const demo = useShowcase({ catalog, assistant });
  const info = useAssistantInfo(assistant);
  return <Argument pieces={{ recipe: <LiveRecipe demo={demo} info={info} />, mirror: <LiveMirror demo={demo} />, cards: <LiveCards demo={demo} /> }} />;
}

/** `/about`: the design case for Yourfeed, with live pieces of the demo running in memory beside it. */
export function ShowcasePage({ loadCatalog, assistant }: Props) {
  const loadDemo = useCallback(() => loadCatalog("demo"), [loadCatalog]);
  const [catalog, retry] = useCatalog(loadDemo);
  const loading = <p className="muted">Loading the demo…</p>;

  return (
    <div className="showcase">
      <header className="showcase-header">
        <RouteLink to={APP_PATH} className="showcase-brand">
          <IconAdjustmentsHorizontal size={20} aria-hidden="true" />
          <span>Yourfeed</span>
          <span className="visually-hidden">: {BACK}</span>
        </RouteLink>
      </header>
      <main>
        <hgroup className="showcase-intro">
          <h1>A feed you write the recipe for</h1>
          <p>
            Yourfeed is an open-source design exploration of custom YouTube feeds. Each feed is a recipe you declare, and only you change it. The pieces below are the demo itself on its sample videos, running in this page only: nothing here changes your own feeds.
          </p>
        </hgroup>
        {catalog.status === "ready" ? (
          <LiveArgument catalog={catalog.catalog} assistant={assistant} />
        ) : (
          <Argument
            pieces={{
              recipe: catalog.status === "error" ? <CatalogError message={catalog.message} onRetry={retry} /> : loading,
              mirror: catalog.status === "error" ? null : loading,
              cards: catalog.status === "error" ? null : loading,
            }}
          />
        )}
      </main>
      <footer className="app-footer">
        <span>Not affiliated with YouTube</span>
        <RouteLink to={APP_PATH} className="showcase-back">
          <IconArrowLeft size={14} aria-hidden="true" />
          {BACK}
        </RouteLink>
      </footer>
    </div>
  );
}
