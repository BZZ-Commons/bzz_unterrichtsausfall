import '../src/index.css';

export const metadata = {
  title: 'Unterrichtsausfälle – BZZ',
  description: 'Schuljahreskalender mit Unterrichtsausfällen pro Klasse – BZZ Bildungszentrum Zürichsee',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
