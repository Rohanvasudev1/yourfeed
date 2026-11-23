import { ABOUT_PATH } from "../state/useRoute";
import { RouteLink } from "./RouteLink";

/** `onReset` is null when there's no demo to reset: signed in, the state is your account's. */
type Props = Readonly<{ onReset: (() => void) | null }>;

export function Footer({ onReset }: Props) {
  return (
    <footer className="app-footer">
      <span>Not affiliated with YouTube</span>
      <RouteLink to={ABOUT_PATH} className="footer-link">
        About this design
      </RouteLink>
      {onReset && (
        <button type="button" className="link-button" onClick={onReset}>
          Reset demo
        </button>
      )}
    </footer>
  );
}
