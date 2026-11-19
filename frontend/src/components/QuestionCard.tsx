import { IconAsterisk, IconCheck, IconThumbDown, IconThumbUp, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { feedbackVideos, type QuestionCard as Card } from "../domain/questionCard";
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

function Body({ card, questions, byId, filters }: Readonly<{ card: Card } & Props>) {
  switch (card.kind) {
    case "chips":
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
    case "videos":
      return (
        <div className="qcard-videos">
          {card.items.flatMap((id) => {
            const video = byId.get(id);
            if (!video) return [];
            const picked = card.picked.includes(id);
            return (
              <button
                key={id}
                type="button"
                className={picked ? "qcard-video picked" : "qcard-video"}
                aria-pressed={picked}
                aria-label={titleOf(video, filters)}
                onClick={() => questions.toggle(id)}
              >
                <VideoTile video={video} filters={filters} />
              </button>
            );
          })}
        </div>
      );
    case "feedback":
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
}

/** The assistant asking before it acts: chips or videos to pick from, or thumbs on topics it just added. */
export function QuestionCard(props: Props) {
  const { questions } = props;
  const card = questions.card;
  if (!card) return null;
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
            <IconButton label="Looks good" onClick={() => questions.feedback(true)}>
              <IconThumbUp size={16} aria-hidden="true" />
            </IconButton>
            <IconButton label="Not quite" onClick={() => questions.feedback(false)}>
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
