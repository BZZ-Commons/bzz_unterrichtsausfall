import type { Metadata } from 'next';
import LegalPageShell from '@/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Impressum – Unterrichtsausfälle BZZ',
};

export default function ImpressumPage() {
  return (
    <LegalPageShell title="Impressum">
      <p>
        Die Webanwendung &bdquo;Unterrichtsausfälle&ldquo; ist ein Informationsangebot des Bildungszentrums
        Zürichsee BZZ.
      </p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Herausgeber / Betreiber</h2>
        <p>
          Bildungszentrum Zürichsee BZZ
          <br />
          Eine Schule des Kantons Zürich (Mittelschul- und Berufsbildungsamt MBA)
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Standorte</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-medium text-slate-900">Horgen See / Oberdorf</p>
            <p>
              Seestrasse 110
              <br />
              8810 Horgen
              <br />
              Tel.{' '}
              <a href="tel:+41447274600" className="text-indigo-600 hover:underline">
                +41 44 727 46 00
              </a>
              <br />
              <a href="mailto:info@bzz.ch" className="text-indigo-600 hover:underline">
                info@bzz.ch
              </a>
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-900">Stäfa</p>
            <p>
              Kirchbühlstrasse 21
              <br />
              8712 Stäfa
              <br />
              Tel.{' '}
              <a href="tel:+41449281620" className="text-indigo-600 hover:underline">
                +41 44 928 16 20
              </a>
              <br />
              <a href="mailto:info@bzz.ch" className="text-indigo-600 hover:underline">
                info@bzz.ch
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Datenquelle</h2>
        <p>
          Die angezeigten Stundenplan- und Ausfalldaten stammen aus dem Stundenplansystem WebUntis
          des BZZ.
        </p>
      </section>

      <section className="space-y-2 border-t border-slate-100 pt-4 text-slate-500">
        <p>
          Es gilt ergänzend das offizielle{' '}
          <a
            href="https://bzz.ch/impressum/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            Impressum des BZZ
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
