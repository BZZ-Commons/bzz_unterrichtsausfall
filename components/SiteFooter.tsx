import Link from 'next/link';

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white/80">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-2 text-xs text-slate-500">
        <span>© {year} Bildungszentrum Zürichsee BZZ</span>
        <nav className="sm:ml-auto flex items-center gap-4">
          <Link href="/impressum" className="hover:text-indigo-600 transition-colors">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-indigo-600 transition-colors">
            Datenschutz
          </Link>
          <a
            href="https://www.bzz.ch"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-indigo-600 transition-colors"
          >
            bzz.ch
          </a>
        </nav>
      </div>
    </footer>
  );
}
