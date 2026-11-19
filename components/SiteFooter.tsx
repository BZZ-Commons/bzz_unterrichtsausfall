import Link from 'next/link';
import McpRequestBadge from '@/components/McpRequestBadge';
import VersionBadge from '@/components/VersionBadge';

const LINK_CLASS = 'text-inherit hover:text-bzz-blau-text';

/**
 * BZZ-Fusszeile mit dem vorgegebenen Text; dahinter, gleich zurückhaltend,
 * die rechtlichen Seiten, Version und MCP-Zähler.
 */
export default function SiteFooter() {
  return (
    <footer className="bzz-container bzz-footer flex flex-col gap-2 sm:flex-row sm:items-center">
      <span>© Bildungszentrum Zürichsee, Horgen</span>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto">
        <Link href="/impressum" className={LINK_CLASS}>
          Impressum
        </Link>
        <Link href="/datenschutz" className={LINK_CLASS}>
          Datenschutz
        </Link>
        <a
          href="https://www.bzz.ch"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          bzz.ch
        </a>
        <VersionBadge />
        <McpRequestBadge />
      </nav>
    </footer>
  );
}
