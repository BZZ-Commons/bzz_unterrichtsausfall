import '../src/index.css';

export const metadata = {
  title: 'Schulausfälle – BZZ',
  description: 'Schuljahreskalender mit Ausfällen pro Klasse – BZZ Bildungszentrum Zürichsee',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
