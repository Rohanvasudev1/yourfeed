import { useId } from "react";
import { ACCOUNT_TEXT } from "../../domain/account";
import type { DemoFeedsOffer } from "../../state/useDemoFeedsOffer";
import "./onboarding.css";

type Props = Readonly<{ offer: DemoFeedsOffer }>;

/** The one-time offer at first sign-in to copy the demo feeds' recipes into the account. */
export function DemoFeedsOfferCard({ offer }: Props) {
  const titleId = useId();
  const names = offer.recipes.map((r) => r.name).join(", ");
  return (
    <section className="onboarding-card onboarding-offer" aria-labelledby={titleId}>
      <h2 id={titleId} className="onboarding-title">
        {ACCOUNT_TEXT.demoOffer}
      </h2>
      <p className="onboarding-hint">
        {ACCOUNT_TEXT.demoOfferText(names)}
      </p>
      <div className="onboarding-actions">
        <button type="button" onClick={offer.bring}>
          {ACCOUNT_TEXT.demoOffer}
        </button>
        <button type="button" className="text-button" onClick={offer.decline}>
          {ACCOUNT_TEXT.demoOfferNo}
        </button>
      </div>
    </section>
  );
}
