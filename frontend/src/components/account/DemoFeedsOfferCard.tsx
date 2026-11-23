import { useId } from "react";
import type { DemoFeedsOffer } from "../../state/useDemoFeedsOffer";
import "./onboarding.css";

const TITLE = "Bring your demo feeds";

type Props = Readonly<{ offer: DemoFeedsOffer }>;

/** The one-time offer at first sign-in to copy the demo feeds' recipes into the account. */
export function DemoFeedsOfferCard({ offer }: Props) {
  const titleId = useId();
  const names = offer.recipes.map((r) => r.name).join(", ");
  return (
    <section className="onboarding-card onboarding-offer" aria-labelledby={titleId}>
      <h2 id={titleId} className="onboarding-title">
        {TITLE}
      </h2>
      <p className="onboarding-hint">
        Copy {names} into your account: their names, lengths and the topics your YouTube has. Nothing else comes along.
      </p>
      <div className="onboarding-actions">
        <button type="button" onClick={offer.bring}>
          {TITLE}
        </button>
        <button type="button" className="text-button" onClick={offer.decline}>
          No thanks
        </button>
      </div>
    </section>
  );
}
