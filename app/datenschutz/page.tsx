import type { Metadata } from 'next';
import LegalPageShell from '@/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Datenschutz – Unterrichtsausfälle BZZ',
};

export default function DatenschutzPage() {
  return (
    <LegalPageShell title="Datenschutzerklärung">
      <section>
        <h2 className="mt-0 mb-2 text-[22px] leading-tight text-bzz-ink">Verantwortliche Stelle</h2>
        <p>
          Bildungszentrum Zürichsee BZZ
          <br />
          Seestrasse 110, 8810 Horgen
          <br />
          <a href="mailto:info@bzz.ch">info@bzz.ch</a>
        </p>
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-[22px] leading-tight text-bzz-ink">Zweck der Anwendung</h2>
        <p>
          Die Anwendung &bdquo;Unterrichtsausfälle&ldquo; zeigt einen Schuljahreskalender mit
          Unterrichtsausfällen, Ferien und Feiertagen pro Klasse. Die Daten werden bei jedem Aufruf
          aus dem Stundenplansystem WebUntis des BZZ bezogen und ausschliesslich zur Anzeige
          aufbereitet.
        </p>
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-[22px] leading-tight text-bzz-ink">Bearbeitete Daten</h2>
        <p>
          Angezeigt werden Stundenplan- und Ausfallinformationen. Diese können Personendaten von
          Lehrpersonen (z. B. Kürzel oder Namen) enthalten, soweit sie Teil des Stundenplans sind.
          Es werden keine Personendaten von Besucherinnen und Besuchern erhoben, und es ist keine
          Anmeldung erforderlich.
        </p>
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-[22px] leading-tight text-bzz-ink">
          Keine Cookies, kein Tracking
        </h2>
        <p>
          Diese Anwendung setzt keine Cookies, verwendet keine Analyse- oder Tracking-Werkzeuge und
          bindet keine Drittanbieter-Dienste (z. B. externe Schriftarten, Karten oder Social-Media-
          Plugins) ein. Für die Zwischenspeicherung der Ansicht wird der lokale{' '}
          <code className="rounded-bzz bg-bzz-nebel px-1 py-0.5">sessionStorage</code> Ihres
          Browsers verwendet; zusätzlich merkt sich der{' '}
          <code className="rounded-bzz bg-bzz-nebel px-1 py-0.5">localStorage</code> die zuletzt
          gewählte Klasse, damit sie beim nächsten Besuch vorausgewählt ist. Diese Daten verlassen
          Ihr Gerät nicht.
        </p>
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-[22px] leading-tight text-bzz-ink">
          Server-Protokolle und Hosting
        </h2>
        <p>
          Beim Betrieb können durch die Server- bzw. Hosting-Infrastruktur technische Zugriffsdaten
          (z. B. IP-Adresse, Zeitpunkt des Zugriffs, aufgerufene Seite, Browsertyp) verarbeitet
          werden, um den sicheren und stabilen Betrieb zu gewährleisten. Das Hosting erfolgt in der
          Schweiz. Diese Protokolldaten werden nicht zu Werbezwecken ausgewertet und nur kurz
          aufbewahrt.
        </p>
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-[22px] leading-tight text-bzz-ink">Ihre Rechte</h2>
        <p>
          Im Rahmen des anwendbaren schweizerischen Datenschutzrechts haben Sie das Recht auf
          Auskunft, Berichtigung und Löschung Ihrer Personendaten. Wenden Sie sich dazu an{' '}
          <a href="mailto:info@bzz.ch">info@bzz.ch</a>.
        </p>
      </section>

      <section className="bzz-note">
        <p>
          Ergänzend gilt die offizielle{' '}
          <a href="https://bzz.ch/datenschutzerklaerung/" target="_blank" rel="noopener noreferrer">
            Datenschutzerklärung des BZZ
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
