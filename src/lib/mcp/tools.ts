import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getClassCalendarCached,
  getClassesCached,
  getSchoolPeriodsCached,
  getSchoolYearsCached,
} from '@/src/lib/mcp/data';
import { compactDays, filterUpcoming, resolveClass, todayInZurich } from '@/src/lib/mcp/helpers';
import type { UntisClass } from '@/src/types';

/**
 * MCP tool registrations for the Unterrichtsausfall server.
 *
 * Tool descriptions are written in German FOR an AI assistant — they spell out
 * parameter semantics precisely so the model can self-correct (e.g. on
 * `needs-variant` / `not-found` resolutions, which are returned as data, not
 * as errors).
 */

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});
const fail = (message: string) => ({
  content: [{ type: 'text' as const, text: message }],
  isError: true,
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Date string in YYYY-MM-DD format. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

interface ClassQuery {
  className?: string;
  classId?: number;
  schoolyearId?: number;
  variant?: 'bm' | 'abu';
}

/**
 * Shared class resolution for getClassCalendar / getUpcomingCancellations.
 * Non-`resolved` outcomes are returned as DATA (not errors) so the calling
 * model can self-correct: `not-found` carries suggestions, `needs-variant`
 * carries the bm/abu options + a hint.
 */
async function resolveRequestedClass(
  query: ClassQuery,
): Promise<
  | { resolved: true; cls: UntisClass; fetchIds: number[] }
  | { resolved: false; response: ReturnType<typeof ok> | ReturnType<typeof fail> }
> {
  if (query.className == null && query.classId == null) {
    return { resolved: false, response: fail('Bitte className oder classId angeben.') };
  }
  const classes = await getClassesCached(query.schoolyearId ?? null);
  const resolution = resolveClass(classes, {
    className: query.className,
    classId: query.classId,
    variant: query.variant,
  });
  if (resolution.kind !== 'resolved') {
    return { resolved: false, response: ok({ ...resolution }) };
  }
  return { resolved: true, cls: resolution.cls, fetchIds: resolution.fetchIds };
}

const classQueryShape = {
  className: z
    .string()
    .optional()
    .describe('Klassenname, z. B. "IA24a" (Gross-/Kleinschreibung und Leerzeichen egal)'),
  classId: z.number().int().optional().describe('WebUntis-Klassen-ID (Alternative zu className)'),
  schoolyearId: z
    .number()
    .int()
    .optional()
    .describe('Schuljahr-ID aus listSchoolYears (Standard: aktuelles Schuljahr)'),
  variant: z
    .enum(['bm', 'abu'])
    .optional()
    .describe('Nur für IA-Klassen: Stundenplan-Variante BM oder ABU'),
};

export function registerTools(server: McpServer): void {
  server.registerTool(
    'listClasses',
    {
      title: 'Klassen auflisten',
      description:
        'Listet die aktiven Klassen des BZZ (Bildungszentrum Zürichsee) mit ihren ' +
        'Companion-Klassen (Klassen mit gemeinsamem Stundenplan, z. B. zugehörige BM-Klasse). ' +
        'Optional für ein bestimmtes Schuljahr via schoolyearId (Standard: aktuelles Schuljahr). ' +
        'Liefert pro Klasse: id, name, longName, companionNames, fetchIds.',
      inputSchema: {
        schoolyearId: z
          .number()
          .int()
          .optional()
          .describe('Schuljahr-ID aus listSchoolYears (Standard: aktuelles Schuljahr)'),
      },
    },
    async ({ schoolyearId }) => {
      try {
        const classes = await getClassesCached(schoolyearId ?? null);
        return ok(
          classes.map(({ id, name, longName, companionNames, fetchIds }) => ({
            id,
            name,
            longName,
            companionNames,
            fetchIds,
          })),
        );
      } catch (error: unknown) {
        return fail(`WebUntis-Fehler: ${errorMessage(error)}`);
      }
    },
  );

  server.registerTool(
    'listSchoolYears',
    {
      title: 'Schuljahre auflisten',
      description:
        'Listet alle Schuljahre des BZZ (neueste zuerst) mit id, name, startDate und endDate. ' +
        'Die id kann in anderen Tools als schoolyearId verwendet werden.',
      inputSchema: {},
    },
    async () => {
      try {
        return ok(await getSchoolYearsCached());
      } catch (error: unknown) {
        return fail(`WebUntis-Fehler: ${errorMessage(error)}`);
      }
    },
  );

  server.registerTool(
    'getSchoolPeriods',
    {
      title: 'Quartale und Semester',
      description:
        'Liefert die Quartals- (Q1–Q4) und Semestergrenzen eines Schuljahres als ' +
        'Datumsbereiche (YYYY-MM-DD). Optional via schoolyearId (Standard: aktuelles Schuljahr).',
      inputSchema: {
        schoolyearId: z
          .number()
          .int()
          .optional()
          .describe('Schuljahr-ID aus listSchoolYears (Standard: aktuelles Schuljahr)'),
      },
    },
    async ({ schoolyearId }) => {
      try {
        return ok(await getSchoolPeriodsCached(schoolyearId ?? null));
      } catch (error: unknown) {
        return fail(`WebUntis-Fehler: ${errorMessage(error)}`);
      }
    },
  );

  server.registerTool(
    'getClassCalendar',
    {
      title: 'Klassenkalender',
      description:
        'Liefert den klassifizierten Schuljahreskalender einer Klasse. Klasse ENTWEDER per ' +
        'className (z. B. "IA24a"; Gross-/Kleinschreibung und Leerzeichen spielen keine Rolle) ' +
        'ODER per classId angeben. IA-Klassen brauchen ggf. zusätzlich variant "bm" oder "abu" — ' +
        'die Antwort meldet das mit kind "needs-variant" (inkl. Optionen); bei kind "not-found" ' +
        'enthält sie Namensvorschläge. from/to (YYYY-MM-DD) schränken den Zeitraum ein. Die ' +
        'Antwort enthält stats (Anzahl Tage je Typ), ferien (Ferienbereiche) und days (nur ' +
        'Unterrichtsausfälle, Veranstaltungen und Tage mit einzelnen abgesagten Lektionen). ' +
        'Semantik der Typen: "unterrichtsausfall" = regulärer Unterricht entfällt (betrifft ' +
        'immer nur Schultage der Klasse); "veranstaltung" = Schulanlass wie z. B. ein ' +
        'Sprachaufenthalt, kann auch an Wochentagen ohne regulären Unterricht liegen. ' +
        'Jeder Tag enthält den korrekten Wochentag im Feld weekday — diesen verwenden, ' +
        'nicht selbst aus dem Datum berechnen.',
      inputSchema: {
        ...classQueryShape,
        from: isoDate.optional().describe('Zeitraum-Beginn (YYYY-MM-DD), inklusiv'),
        to: isoDate.optional().describe('Zeitraum-Ende (YYYY-MM-DD), inklusiv'),
      },
    },
    async ({ className, classId, schoolyearId, variant, from, to }) => {
      try {
        const result = await resolveRequestedClass({ className, classId, schoolyearId, variant });
        if (!result.resolved) return result.response;

        const data = await getClassCalendarCached(result.fetchIds, schoolyearId ?? null);
        return ok({
          schoolYear: data.schoolYear,
          class: {
            id: result.cls.id,
            name: result.cls.name,
            companionNames: result.cls.companionNames,
          },
          ...compactDays(data.days, { from, to }),
        });
      } catch (error: unknown) {
        return fail(`WebUntis-Fehler: ${errorMessage(error)}`);
      }
    },
  );

  server.registerTool(
    'getUpcomingCancellations',
    {
      title: 'Kommende Unterrichtsausfälle',
      description:
        'Liefert die kommenden Unterrichtsausfälle und Veranstaltungen einer Klasse ab heute ' +
        '(Zeitzone Europe/Zurich) — beantwortet Fragen wie "Wann fällt das nächste Mal Schule ' +
        'aus?". Klasse per className ODER classId (IA-Klassen ggf. mit variant "bm"/"abu", ' +
        'siehe getClassCalendar). Die Antwort trennt zwei Kategorien: cancellations = ' +
        'Unterrichtsausfälle (regulärer Unterricht entfällt; betrifft immer nur Schultage der ' +
        'Klasse) und veranstaltungen = Schulanlässe wie z. B. ein Sprachaufenthalt (können ' +
        'auch an Wochentagen ohne regulären Unterricht liegen). Jeder Tag enthält den ' +
        'korrekten Wochentag im Feld weekday — diesen verwenden, nicht selbst aus dem Datum ' +
        'berechnen.',
      inputSchema: { ...classQueryShape },
    },
    async ({ className, classId, schoolyearId, variant }) => {
      try {
        const result = await resolveRequestedClass({ className, classId, schoolyearId, variant });
        if (!result.resolved) return result.response;

        const data = await getClassCalendarCached(result.fetchIds, schoolyearId ?? null);
        const today = todayInZurich();
        const { cancellations, veranstaltungen } = filterUpcoming(data.days, today);
        return ok({
          schoolYear: { id: data.schoolYear.id, name: data.schoolYear.name },
          class: { id: result.cls.id, name: result.cls.name },
          today,
          cancellations,
          veranstaltungen,
        });
      } catch (error: unknown) {
        return fail(`WebUntis-Fehler: ${errorMessage(error)}`);
      }
    },
  );
}
