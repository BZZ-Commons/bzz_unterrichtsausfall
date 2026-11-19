import '@fontsource-variable/inter';
import '../src/index.css';
import SiteFooter from '@/components/SiteFooter';

export const metadata = {
  title: 'Unterrichtsausfälle – BZZ',
  description:
    'Schuljahreskalender mit Unterrichtsausfällen pro Klasse – BZZ Bildungszentrum Zürichsee',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
