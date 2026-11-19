interface SiteHeaderProps {
  /** Target of the logo link (the page's "home"). */
  homeHref?: string;
}

/**
 * BZZ-Kopfzeile: weiss über die ganze Breite, links das Logo in fester Grösse
 * (setzt design.css). Keine Titel oder Bedienelemente — die gehören in den Inhalt.
 */
export default function SiteHeader({ homeHref = '/' }: SiteHeaderProps) {
  return (
    <header className="bzz-container bzz-header">
      <a href={homeHref} title="Zur aktuellen Schuljahresübersicht">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG-Logo, feste Grösse via design.css */}
        <img className="bzz-logo" src="/bzz-logo.svg" alt="Bildungszentrum Zürichsee" />
      </a>
    </header>
  );
}
