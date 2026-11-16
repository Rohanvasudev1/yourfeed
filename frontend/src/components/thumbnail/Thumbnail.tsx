import { IconArrowBigLeftFilled, IconBroadcast, IconPlayerPlay } from "@tabler/icons-react";
import type { CSSProperties } from "react";
import { durationText } from "../../domain/format";
import type { Video } from "../../domain/types";
import { isVersus, THUMBNAIL_DESIGNS, type CaptionDesign, type ThumbnailDesign, type VersusDesign } from "./designs";

type Props = Readonly<{
  video: Video;
  honest: boolean;
  /** Position badge ("#1") on Most viewed; absent elsewhere. */
  rank?: number;
}>;

const GENERIC_GRADIENT = ["#222", "#555"] as const;
const DEFAULT_ACCENT = "#ffd400";

const genericDesign = (video: Video): CaptionDesign => ({
  caption: video.topic.toUpperCase(),
  icon: IconPlayerPlay,
  gradient: GENERIC_GRADIENT,
});

/**
 * A YouTube-style thumbnail: the video's designed art (or the generic topic design) plus its
 * duration or LIVE badge, and a rank badge on Most viewed. Sizes use container query units, so one design fits any card width.
 */
export function Thumbnail({ video, honest, rank }: Props) {
  const design: ThumbnailDesign = THUMBNAIL_DESIGNS[video.id] ?? genericDesign(video);
  return (
    <div className="thumb">
      {isVersus(design) ? <VersusArt design={design} /> : <CaptionArt design={design} honest={honest} />}
      {rank !== undefined && <span className="thumb-badge thumb-rank">#{rank}</span>}
      {video.live ? (
        <span className="thumb-badge thumb-live">
          <IconBroadcast aria-hidden="true" />
          LIVE
        </span>
      ) : (
        <span className="thumb-badge">{durationText(video)}</span>
      )}
    </div>
  );
}

function CaptionArt({ design, honest }: Readonly<{ design: CaptionDesign; honest: boolean }>) {
  const showBait = design.bait === true && !honest;
  const honestSwap = honest && design.honestCaption !== undefined;
  const caption = honestSwap ? design.honestCaption : design.caption;
  const label = honestSwap ? undefined : design.label;
  const Icon = design.icon;
  const [from, to] = design.gradient;
  return (
    <div className="thumb-art" aria-hidden="true">
      <div className="thumb-bg" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} />
      <div className="thumb-text">
        <b className="thumb-caption">{caption}</b>
        {label && (
          <b className="thumb-label" style={{ "--accent": design.accent ?? DEFAULT_ACCENT } as CSSProperties}>
            {label}
          </b>
        )}
      </div>
      <Icon className="thumb-icon" stroke={1.5} />
      {showBait && (
        <>
          <span className="thumb-ring" />
          <IconArrowBigLeftFilled className="thumb-arrow" />
        </>
      )}
    </div>
  );
}

function VersusArt({ design }: Readonly<{ design: VersusDesign }>) {
  return (
    <div className="thumb-versus" aria-hidden="true">
      {design.versus.map(({ label, icon: Icon, color }) => (
        <div key={label} style={{ background: color }}>
          <Icon stroke={1.5} />
          <b>{label}</b>
        </div>
      ))}
      <span className="thumb-vs">VS</span>
    </div>
  );
}
