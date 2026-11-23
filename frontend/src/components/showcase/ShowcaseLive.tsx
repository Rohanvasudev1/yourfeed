import { recipeSummary } from "../../domain/showcase";
import { providerNotice } from "../../domain/assistantInfo";
import type { AssistantInfo } from "../../domain/assistantInfo";
import type { ShowcaseState } from "../../state/useShowcase";
import { ClaudeBar } from "../ClaudeBar";
import { FeedView } from "../FeedView";
import { Flash } from "../Flash";
import { MirrorCard } from "../mirror/MirrorCard";
import { QuestionCard } from "../QuestionCard";
import { RecipeLog } from "../recipeLog/RecipeLog";
import { UndoRedo } from "../UndoRedo";

type Props = Readonly<{ demo: ShowcaseState }>;

/** The demo feed's recipe in one line, so a change shows where it happened. */
function RecipeLine({ demo }: Props) {
  return (
    <p className="showcase-recipe">
      <b>{demo.feed.name}</b>
      <span aria-hidden="true">: </span>
      <span className="visually-hidden"> recipe: </span>
      {recipeSummary(demo.feed)}
    </p>
  );
}

/** A request to the Claude bar changing the demo feed's recipe, with undo and the recipe log. */
export function LiveRecipe({ demo, info }: Readonly<{ demo: ShowcaseState; info: AssistantInfo | null }>) {
  const { state, history, dispatch, feed } = demo;
  return (
    <section className="showcase-live" aria-label="Live recipe">
      <div className="showcase-live-head">
        <RecipeLine demo={demo} />
        <UndoRedo
          undoCount={history.undo.length}
          redoCount={history.redo.length}
          onUndo={() => dispatch({ type: "undo" })}
          onRedo={() => dispatch({ type: "redo" })}
        />
      </div>
      <ClaudeBar bar={demo.claudeBar} providerNotice={state.providerNoticeSeen ? null : providerNotice(info)} />
      <QuestionCard questions={demo.questions} byId={demo.byId} filters={state.filters} />
      <RecipeLog feedName={feed.name} log={feed.log} onClear={() => dispatch({ type: "clear_log", feed: feed.name })} />
    </section>
  );
}

/** The recipe mirror's proposal for the demo feed, from removals seeded into its behaviour. */
export function LiveMirror({ demo }: Props) {
  return (
    <section className="showcase-live" aria-label="Live recipe mirror">
      <RecipeLine demo={demo} />
      {demo.mirror.proposal ? (
        <MirrorCard mirror={demo.mirror} />
      ) : (
        <p className="muted small">No proposal now: the mirror offers at most one per feed per visit.</p>
      )}
    </section>
  );
}

/** The demo feed's first cards, each saying why it's there; the third is outside the recipe. */
export function LiveCards({ demo }: Props) {
  const { state, feed } = demo;
  return (
    <section className="showcase-live" aria-label="Live cards">
      <Flash message={demo.flash} />
      <FeedView
        key={feed.seed}
        pinned={[]}
        upNext={demo.cards}
        reasons={demo.reasons}
        kind={feed.kind}
        filters={state.filters}
        view="grid"
        onPlay={demo.play}
        saveActions={demo.saveActions}
        cardActions={demo.cardActions}
      />
    </section>
  );
}
