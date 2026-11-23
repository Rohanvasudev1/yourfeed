import { ABOUT_PATH } from "../state/useRoute";
import { RouteLink } from "./RouteLink";

type Props = Readonly<{ onReset: () => void }>;

export function Footer({ onReset }: Props) {
  return (
    <footer className="app-footer">
      <span>Not affiliated with YouTube</span>
      <RouteLink to={ABOUT_PATH} className="footer-link">
        About this design
      </RouteLink>
      <button type="button" className="link-button" onClick={onReset}>
        Reset demo
      </button>
    </footer>
  );
}
