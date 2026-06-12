/** Public WebUntis week view of a class — `monday` is the 'YYYY-MM-DD' of the week. */
export function untisWeekHref(monday: string, classId: number): string {
  return `https://bzz.webuntis.com/WebUntis?school=bzz#/basic/timetablePublic/class?date=${monday}&entityId=${classId}`;
}
