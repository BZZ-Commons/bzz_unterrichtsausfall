import type { Metadata } from 'next';
import LegalPageShell from '@/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Datenschutz – Unterrichtsausfälle BZZ',
};

export default function DatenschutzPage() {
  return (
    <LegalPageShell title="Datenschutzerklärung">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Verantwortliche Stelle</h2>
        <p>
          Bildungszentrum Zürichsee BZZ
          <br />
          Seestrasse 110, 8810 Horgen
          <br />
          <a href="mailto:info@bzz.ch" className="text-indigo-600 hover:underline">
            info@bzz.ch
          </a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Zweck der Anwendung</h2>
        <p>
          Die Anwendung „Unterrichtsausfälle" zeigt einen Schuljahreskalender mit
          Unterrichtsausfällen, Ferien und Feiertagen pro Klasse. Die Daten werden bei jedem Aufruf
          aus dem Stundenplansystem WebUntis des BZZ bezogen und ausschliesslich zur Anzeige
          aufbereitet.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Bearbeitete Daten</h2>
        <p>
          Angezeigt werden Stundenplan- und Ausfallinformationen. Diese können Personendaten von
          Lehrpersonen (z. B. Kürzel oder Namen) enthalten, soweit sie Teil des Stundenplans sind.
          Es werden keine Personendaten von Besucherinnen und Besuchern erhoben, und es ist keine
          Anmeldung erforderlich.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Keine Cookies, kein Tracking</h2>
        <p>
          Diese Anwendung setzt keine Cookies, verwendet keine Analyse- oder Tracking-Werkzeuge und
          bindet keine Drittanbieter-Dienste (z. B. externe Schriftarten, Karten oder Social-Media-
          Plugins) ein. Für die Zwischenspeicherung der Ansicht wird ausschliesslich der lokale{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-600">
            sessionStorage
          </code>{' '}
          Ihres Browsers verwendet; diese Daten verlassen Ihr Gerät nicht.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Server-Protokolle und Hosting</h2>
        <p>
          Beim Betrieb können durch die Server- bzw. Hosting-Infrastruktur technische Zugriffsdaten
          (z. B. IP-Adresse, Zeitpunkt des Zugriffs, aufgerufene Seite, Browsertyp) verarbeitet
          werden, um den sicheren und stabilen Betrieb zu gewährleisten. Das Hosting erfolgt in der
          Schweiz. Diese Protokolldaten werden nicht zu Werbezwecken ausgewertet und nur kurz
          aufbewahrt.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Ihre Rechte</h2>
        <p>
          Im Rahmen des anwendbaren schweizerischen Datenschutzrechts haben Sie das Recht auf
          Auskunft, Berichtigung und Löschung Ihrer Personendaten.
          Wenden Sie sich dazu an{' '}
          <a href="mailto:info@bzz.ch" className="text-indigo-600 hover:underline">
            info@bzz.ch
          </a>
          .
        </p>
      </section>

      <section className="space-y-2 border-t border-slate-100 pt-4 text-slate-500">
        <p>
          Ergänzend gilt die offizielle{' '}
          <a
            href="https://bzz.ch/datenschutzerklaerung/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            Datenschutzerklärung des BZZ
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
