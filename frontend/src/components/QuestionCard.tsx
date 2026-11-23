import { IconAsterisk, IconCheck, IconThumbDown, IconThumbUp, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { FEEDBACK_BAD, FEEDBACK_GOOD, feedbackVideos, type QuestionCard as Card } from "../domain/questionCard";
import type { GlobalFilters, Video } from "../domain/types";
import type { QuestionCardState } from "../state/useQuestionCard";
import { Thumbnail } from "./thumbnail/Thumbnail";
import "./questionCard.css";

type Props = Readonly<{
  questions: QuestionCardState;
  byId: ReadonlyMap<string, Video>;
  filters: GlobalFilters;
}>;

const titleOf = (video: Video, filters: GlobalFilters) => (filters.honestTitles ? video.honestTitle : video.title);

function IconButton({ label, onClick, primary = false, children }: Readonly<{ label: string; onClick: () => void; primary?: boolean; children: ReactNode }>) {
  return (
    <button type="button" className={primary ? "qcard-ib on" : "qcard-ib"} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function VideoTile({ video, filters }: Readonly<{ video: Video; filters: GlobalFilters }>) {
  return (
    <>
      <span className="qcard-thumb">
        <Thumbnail video={video} honest={filters.honestTitles} />
      </span>
      <span className="qcard-title">{titleOf(video, filters)}</span>
    </>
  );
}

type PartProps = Readonly<{ card: Card; questions: QuestionCardState; byId: ReadonlyMap<string, Video>; filters: GlobalFilters }>;

function Chips({ card, questions }: PartProps) {
  return (
    <div className="qcard-chips">
      {card.items.map((topic) => {
        const picked = card.picked.includes(topic);
        return (
          <button key={topic} type="button" className={picked ? "qcard-chip picked" : "qcard-chip"} aria-pressed={picked} onClick={() => questions.toggle(topic)}>
            {picked && <IconCheck size={13} aria-hidden="true" />}
            {topic}
          </button>
        );
      })}
    </div>
  );
}

/** Videos to pick from. Ids the catalog doesn't have can't be shown; the backend only sends ones it was shown. */
function VideoPicks({ card, questions, byId, filters }: PartProps) {
  const videos = card.items.flatMap((id) => byId.get(id) ?? []);
  return (
    <div className="qcard-videos">
      {videos.map((video) => {
        const picked = card.picked.includes(video.id);
        return (
          <button
            key={video.id}
            type="button"
            className={picked ? "qcard-video picked" : "qcard-video"}
            aria-pressed={picked}
            aria-label={titleOf(video, filters)}
            onClick={() => questions.toggle(video.id)}
          >
            <VideoTile video={video} filters={filters} />
          </button>
        );
      })}
    </div>
  );
}

function Feedback({ card, byId, filters }: PartProps) {
  return (
    <ul className="qcard-videos" aria-label="Videos from the added topics">
      {feedbackVideos(card.items, [...byId.values()], filters.hideClickbait).map((video) => (
        <li key={video.id} className="qcard-video">
          <VideoTile video={video} filters={filters} />
        </li>
      ))}
    </ul>
  );
}

const BODIES = { chips: Chips, videos: VideoPicks, feedback: Feedback } as const;

/** The assistant asking before it acts: chips or videos to pick from, or thumbs on topics it just added. */
export function QuestionCard(props: Props) {
  const { questions } = props;
  const card = questions.card;
  if (!card) return null;
  const Body = BODIES[card.kind];
  return (
    <section className="qcard" aria-label="Claude's question">
      <IconAsterisk className="qcard-mark" size={16} aria-hidden="true" />
      <div className="qcard-main">
        <p className="qcard-question">{card.question}</p>
        <Body card={card} {...props} />
        {card.error && (
          <p className="qcard-error" role="alert">
            {card.error}
          </p>
        )}
      </div>
      <div className="qcard-actions">
        {card.kind === "feedback" ? (
          <>
            <IconButton label={FEEDBACK_GOOD} onClick={() => questions.feedback(true)}>
              <IconThumbUp size={16} aria-hidden="true" />
            </IconButton>
            <IconButton label={FEEDBACK_BAD} onClick={() => questions.feedback(false)}>
              <IconThumbDown size={16} aria-hidden="true" />
            </IconButton>
          </>
        ) : (
          <IconButton label="Add selected" primary onClick={questions.addSelected}>
            <IconCheck size={16} aria-hidden="true" />
          </IconButton>
        )}
        <IconButton label="Dismiss" onClick={questions.close}>
          <IconX size={16} aria-hidden="true" />
        </IconButton>
      </div>
    </section>
  );
}
