import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

interface LegalPageShellProps {
  title: string;
  children: React.ReactNode;
}

export default function LegalPageShell({ title, children }: LegalPageShellProps) {
  return (
    <>
      <SiteHeader />
      <main className="bzz-container pt-10">
        <div className="max-w-4xl">
          <p className="mt-0 mb-6">
            <Link href="/" className="font-bold">
              ← Zurück zur Übersicht
            </Link>
          </p>
          <h1>{title}</h1>
          <div className="bzz-card space-y-8 text-[17px] text-bzz-ink-2">{children}</div>
        </div>
      </main>
    </>
  );
}
