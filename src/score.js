// Per-student, per-test score for a course: passed cases / total cases, or null if the student never submitted.
export function scoreTable(students, tests, caseCount, subs) {
  const total = t => t.questionIds.reduce((n, q) => n + (caseCount[q] || 0), 0);
  return students.map(student => ({
    student,
    cells: tests.map(t => {
      const mine = subs.filter(x => x.userId === student.id && x.testId === t.id);
      return mine.length ? { passed: mine.reduce((n, x) => n + x.passed, 0), total: total(t) } : null;
    }),
  }));
}
