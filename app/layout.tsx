import '../src/index.css';
import SiteFooter from '@/components/SiteFooter';

export const metadata = {
  title: 'Unterrichtsausfälle – BZZ',
  description: 'Schuljahreskalender mit Unterrichtsausfällen pro Klasse – BZZ Bildungszentrum Zürichsee',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
