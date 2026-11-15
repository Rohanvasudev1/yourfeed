type Props = Readonly<{ onReset: () => void }>;

export function Footer({ onReset }: Props) {
  return (
    <footer className="app-footer">
      <span>Not affiliated with YouTube</span>
      <button type="button" className="link-button" onClick={onReset}>
        Reset demo
      </button>
    </footer>
  );
}
