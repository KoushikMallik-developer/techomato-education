// Per-student, per-test score for a course: passed cases / total cases, or null if the student never submitted.
export function scoreTable(students, tests, caseCount, subs) {
  const total = t => t.questionIds.reduce((n, q) => n + (caseCount[q] || 0), 0);
  return students.map(student => ({
    student,
    cells: tests.map(t => {
      const mine = subs.filter(x => x.userId === student.id && x.testId === t.id && caseCount[x.questionId]); // skip questions deleted since
      return mine.length ? { passed: mine.reduce((n, x) => n + x.passed, 0), total: total(t) } : null;
    }),
  }));
}

// Streak after a submission today: same day keeps it, the day after extends it, any gap restarts at 1.
export const nextStreak = (cur, today, yesterday) => (cur.lastDay === today ? cur.streak : cur.lastDay === yesterday ? cur.streak + 1 : 1);

export const dayKey = d => d.toLocaleDateString('en-CA'); // local calendar day, e.g. 2026-11-22
export const dayIndex = d => Math.floor(Date.parse(dayKey(d)) / 864e5); // whole days since 1970 for the local date
