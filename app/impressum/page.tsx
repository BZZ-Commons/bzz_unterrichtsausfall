import type { Metadata } from 'next';
import LegalPageShell from '@/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Impressum – Unterrichtsausfälle BZZ',
};

export default function ImpressumPage() {
  return (
    <LegalPageShell title="Impressum">
      <p>
        Die Webanwendung &bdquo;Unterrichtsausfälle&ldquo; ist ein Informationsangebot des
        Bildungszentrums Zürichsee BZZ.
      </p>

      <section>
        <h2 className="mt-0 mb-2 text-[22px] leading-tight text-bzz-ink">
          Herausgeber / Betreiber
        </h2>
        <p>
          Bildungszentrum Zürichsee BZZ
          <br />
          Eine Schule des Kantons Zürich (Mittelschul- und Berufsbildungsamt MBA)
        </p>
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-[22px] leading-tight text-bzz-ink">Standorte</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="m-0 font-bold text-bzz-ink">Horgen See / Oberdorf</p>
            <p>
              Seestrasse 110
              <br />
              8810 Horgen
              <br />
              Tel. <a href="tel:+41447274600">+41 44 727 46 00</a>
              <br />
              <a href="mailto:info@bzz.ch">info@bzz.ch</a>
            </p>
          </div>
          <div>
            <p className="m-0 font-bold text-bzz-ink">Stäfa</p>
            <p>
              Kirchbühlstrasse 21
              <br />
              8712 Stäfa
              <br />
              Tel. <a href="tel:+41449281620">+41 44 928 16 20</a>
              <br />
              <a href="mailto:info@bzz.ch">info@bzz.ch</a>
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-[22px] leading-tight text-bzz-ink">Datenquelle</h2>
        <p>
          Die angezeigten Stundenplan- und Ausfalldaten stammen aus dem Stundenplansystem WebUntis
          des BZZ.
        </p>
      </section>

      <section className="bzz-note">
        <p>
          Es gilt ergänzend das offizielle{' '}
          <a href="https://bzz.ch/impressum/" target="_blank" rel="noopener noreferrer">
            Impressum des BZZ
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
