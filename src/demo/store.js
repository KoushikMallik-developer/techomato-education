// Demo-mode backend: a tiny in-memory stand-in for Firebase, persisted to localStorage. Only bundled by `npm run demo`.
const KEY = 'tk-demo';
export const PASSWORD = 'demo123';

// 20 made-up students so the charts, filters and tables have something to show. Deterministic: the same people and scores every reset.
const NAMES = ['Aarav Mehta', 'Diya Sharma', 'Kabir Singh', 'Ishita Das', 'Vihaan Gupta', 'Anika Reddy', 'Arjun Nair', 'Meera Pillai', 'Rohit Verma', 'Sara Khan', 'Dev Patel', 'Tanvi Joshi', 'Aditya Rao', 'Neha Kulkarni', 'Yash Bansal', 'Pooja Iyer', 'Karan Malhotra', 'Riya Sen', 'Siddharth Bose', 'Zoya Ansari'];
function addClass(d) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647); // small deterministic random numbers
  const DAY = 864e5, now = Date.now();
  Object.values(d.questions).forEach((q, i) => { q.createdAt ||= now - (30 - i * 3) * DAY; });
  Object.values(d.tests).forEach((t, i) => { t.createdAt ||= now - (20 - i * 2) * DAY; });
  d.proctor = {};
  const cases = { q1: 3, q2: 2, q3: 2, q4: 3, q5: 3, q6: 3 }; // test cases per question
  const plan = [['tt1', ['q1', 'q2', 'q3'], 0.55], ['tt2', ['q4', 'q5', 'q6'], 0.8], ['tt3', ['q2'], 0.5], ['tt4', ['q4', 'q5'], 0.6]];
  NAMES.forEach((name, i) => {
    const id = `d${i + 1}`;
    d.users[id] = { name, email: `${name.split(' ')[0].toLowerCase()}.${name.split(' ')[1].toLowerCase()}@demo.com`, role: 'student', subscribed: i % 4 === 0, createdAt: now - (2 + i * 2.7) * DAY, ...(i % 5 === 4 ? {} : { lastSignIn: now - (0.1 + ((i * 7) % 10) * 0.9) * DAY }) }; // a few never signed in
    if (i % 4 === 0) d.payments[`pay_${id}`] = { userId: id, userName: name, kind: 'pro', amount: 499, at: now - (1 + i * 2.5) * DAY };
    d.courses.c1.students.push(id);
    d.courses.c1.joins.push({ uid: id, at: now - (1 + i * 2.7) * DAY }); // enrolled over the last eight weeks
    if (i < 12) d.courses.c3.students.push(id);
    if (i >= 8 && i < 18) d.courses.c2.students.push(id);
    const skill = 0.25 + rnd() * 0.75; // how well this student does
    for (const [tid, qids, take] of plan) {
      const inCourse = tid === 'tt1' || tid === 'tt2' ? true : tid === 'tt3' ? i >= 8 && i < 18 : i < 12;
      if (!inCourse || rnd() > take) continue; // did not take this test
      const upTo = rnd() < 0.7 ? qids.length : 1 + Math.floor(rnd() * qids.length); // some stop part way
      qids.slice(0, upTo).forEach(qid => {
        const total = cases[qid], passed = Math.min(total, Math.round(total * Math.min(1, skill + (rnd() - 0.5) * 0.6)));
        d.submissions[`${id}_${tid}_${qid}`] = { userId: id, testId: tid, questionId: qid, passed, total, at: now - (0.2 + rnd() * 13) * DAY, code: 'print(input())' };
      });
      if (tid === 'tt1' && rnd() < 0.35) { // a few proctoring flags on the exam
        const kinds = ['left-page', 'looking-away', 'multiple-faces', 'paste', 'no-face'];
        for (let k = 0, n = 1 + Math.floor(rnd() * 3); k < n; k++) d.proctor[`${id}_tt1_${k}`] = { userId: id, testId: 'tt1', kind: kinds[Math.floor(rnd() * kinds.length)], at: now - rnd() * 5 * DAY };
      }
    }
  });
  // results belong to a course: tag each answer and proctoring record with the course (preferring one the student is in) and re-key it
  const courseFor = (uid, tid) => Object.entries(d.courses).find(([, c]) => c.testIds.includes(tid) && c.students.includes(uid))?.[0] || Object.entries(d.courses).find(([, c]) => c.testIds.includes(tid))?.[0];
  for (const col of ['submissions', 'proctor']) {
    const out = {};
    for (const [k, v] of Object.entries(d[col] || {})) {
      const courseId = courseFor(v.userId, v.testId);
      out[courseId ? k.replace(`${v.userId}_`, `${v.userId}_${courseId}_`) : k] = courseId ? { ...v, courseId } : v;
    }
    d[col] = out;
  }
  return d;
}

const seed = () => addClass({
  users: {
    a1: { name: 'Demo Admin', email: 'admin@demo.com', role: 'admin', subscribed: false, createdAt: Date.now() - 864e5 * 120, lastSignIn: Date.now() - 36e5 },
    t1: { name: 'Demo Trainer', email: 'trainer@demo.com', role: 'trainer', subscribed: false, createdAt: Date.now() - 864e5 * 90, lastSignIn: Date.now() - 864e5 * 0.4 },
    t2: { name: 'Meera Nair', email: 'meera@demo.com', role: 'trainer', subscribed: false, createdAt: Date.now() - 864e5 * 60, lastSignIn: Date.now() - 864e5 * 3 }, // second trainer, to check that trainers only see their own tests
    s1: { name: 'Ananya Roy', email: 'student@demo.com', role: 'student', subscribed: false, createdAt: Date.now() - 864e5 * 40, lastSignIn: Date.now() - 864e5 * 1.2 },
    s2: { name: 'Rohan Kumar', email: 'pro@demo.com', role: 'student', subscribed: true, createdAt: Date.now() - 864e5 * 45, lastSignIn: Date.now() - 864e5 * 0.2 },
  },
  questions: {
    q1: { title: 'Sum of two numbers', env: 'code', diff: 'Easy', topic: 'Math', authorId: 't1', statement: 'Read two integers on one line and print their sum.', starter: '',
      tests: [{ input: '2 3', output: '5' }, { input: '10 20', output: '30' }, { input: '-1 1', output: '0', hidden: true }] },
    q2: { title: 'Red Hello heading', env: 'web', diff: 'Easy', topic: 'HTML & CSS', authorId: 't1', statement: 'Create an h1 that says Hello and make it red.', starter: '<!DOCTYPE html>\n<html>\n<head>\n<style>\n\n</style>\n</head>\n<body>\n\n</body>\n</html>\n',
      tests: [{ desc: 'Page has an h1 saying Hello', expr: "document.querySelector('h1').textContent.trim() === 'Hello'" }, { desc: 'The h1 is red', expr: "getComputedStyle(document.querySelector('h1')).color === 'rgb(255, 0, 0)'" }] },
    q3: { title: 'Double it', env: 'code', diff: 'Easy', topic: 'Math', authorId: 't1', statement: 'Read an integer and print it doubled.', starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
      tests: [{ input: '4', output: '8' }, { input: '0', output: '0', hidden: true }] },
    q4: { title: 'Reverse a string', constraints: '1 <= length <= 100\nLowercase letters only', env: 'code', diff: 'Easy', topic: 'Strings', authorId: 't1', statement: 'Read a word and print it reversed.', starter: '',
      tests: [{ input: 'hello', output: 'olleh', note: 'The letters of hello written backwards.' }, { input: 'abc', output: 'cba' }, { input: 'a', output: 'a', hidden: true }] },
    q5: { title: 'Even or odd', env: 'code', diff: 'Easy', topic: 'Math', authorId: 't1', statement: 'Read an integer. Print EVEN if it is even, otherwise ODD.', starter: '',
      tests: [{ input: '4', output: 'EVEN' }, { input: '7', output: 'ODD' }, { input: '0', output: 'EVEN', hidden: true }] },
    q6: { title: 'Count the words', env: 'code', diff: 'Medium', topic: 'Strings', authorId: 't1', statement: 'Read one line and print how many words it has.', starter: '// Read each input line with input(), print with console.log\n',
      tests: [{ input: 'the quick brown fox', output: '4' }, { input: 'hello', output: '1' }, { input: 'a b  c', output: '3', hidden: true }] },
    q7: { title: 'Palindrome check', public: false, authorName: 'Demo Trainer', env: 'code', diff: 'Medium', topic: 'Strings', authorId: 't1', statement: 'Read a word and print YES if it reads the same backwards, otherwise NO.', constraints: '1 <= length <= 50\nLowercase letters only', starter: '',
      tests: [{ input: 'level', output: 'YES', note: 'It is the same backwards.' }, { input: 'hello', output: 'NO' }, { input: 'a', output: 'YES', hidden: true }] },
  },
  tests: {
    tt1: { code: 'T-DM001', title: 'Week 1 basics', questionIds: ['q1', 'q2', 'q3'], proctored: true, authorId: 't1', authorName: 'Demo Trainer', publishAt: Date.now() - 864e5 * 21, endAt: Date.now() + 864e5 * 30, durationMin: 90 },
    tt2: { code: 'T-DM002', title: 'Week 2: strings and numbers', questionIds: ['q4', 'q5', 'q6'], proctored: false, authorId: 't1', authorName: 'Demo Trainer', publishAt: Date.now() - 864e5 * 21, endAt: Date.now() + 864e5 * 30, durationMin: 60, updatedAt: Date.now() - 864e5 * 2 },
    tt3: { code: 'T-DM003', title: 'HTML basics check', questionIds: ['q2'], proctored: false, authorId: 't1', authorName: 'Demo Trainer', publishAt: Date.now() - 864e5 * 21, endAt: Date.now() + 864e5 * 14, durationMin: 30 },
    tt4: { code: 'T-DM004', title: 'Python loops quiz', questionIds: ['q4', 'q5'], proctored: false, languages: ['python'], authorId: 't1', authorName: 'Demo Trainer', publishAt: Date.now() - 864e5 * 21, endAt: Date.now() + 864e5 * 30, durationMin: 45 },
    tt5: { code: 'T-DM005', title: 'Data structures quiz', questionIds: ['q6'], proctored: false, authorId: 't2', authorName: 'Meera Nair', publishAt: Date.now() - 864e5 * 21, endAt: Date.now() + 864e5 * 30, durationMin: 40 },
    tt6: { code: 'T-DM006', title: 'Loops timed test (30 min)', questionIds: ['q4', 'q5'], proctored: false, languages: ['python', 'js'], authorId: 't1', authorName: 'Demo Trainer', publishAt: Date.now() - 36e5, endAt: Date.now() + 864e5 * 3, durationMin: 30 },
    tt7: { code: 'T-DM007', title: 'Strings test (opens soon)', questionIds: ['q2'], proctored: false, authorId: 't1', authorName: 'Demo Trainer', publishAt: Date.now() + 864e5 * 2, endAt: Date.now() + 864e5 * 5, durationMin: 45 },
    tt8: { code: 'T-DM008', title: 'Warm-up test (closed)', questionIds: ['q1'], proctored: false, authorId: 't1', authorName: 'Demo Trainer', publishAt: Date.now() - 864e5 * 6, endAt: Date.now() - 864e5 * 2, durationMin: 20 },
    tt9: { code: 'T-DM009', title: 'Arrays practice', questionIds: ['q6', 'q7'], proctored: false, authorId: 't1', authorName: 'Demo Trainer', draft: true, durationMin: 40 },
  },
  courses: { c1: { code: 'C-DM001', title: 'Coding Foundations', description: 'Python, C++ and the web.', trainerId: 't1', trainerName: 'Demo Trainer', students: ['s1', 's2'], testIds: ['tt1', 'tt2'], joins: [{ uid: 's2', at: Date.now() - 864e5 * 30 }, { uid: 's1', at: Date.now() - 864e5 * 9 }] },
    c2: { code: 'C-DM002', title: 'Web Basics', description: 'HTML and CSS from scratch, with small build-it exercises.', trainerId: 't1', trainerName: 'Demo Trainer', students: ['s2'], testIds: ['tt3'] },
    c3: { code: 'C-DM003', title: 'Python Practice', description: 'Short Python quizzes to build speed with loops, strings and numbers.', trainerId: 't1', trainerName: 'Demo Trainer', students: ['s1', 's2'], testIds: ['tt4', 'tt6', 'tt7', 'tt8'] },
    c4: { code: 'C-DM004', title: 'Data Structures', description: 'Lists, stacks and queues with hands-on problems.', trainerId: 't2', trainerName: 'Meera Nair', students: ['s2'], testIds: ['tt5'] } },
  leaderboard: {
    s2: { name: 'Rohan Kumar', points: 250, streak: 5, lastDay: '' },
    p1: { name: 'Priya Banerjee', points: 300, streak: 9, lastDay: '' },
    p2: { name: 'Sneha Mukherjee', points: 150, streak: 3, lastDay: '' },
    p3: { name: 'Imran Sheikh', points: 100, streak: 1, lastDay: '' },
  },
  payments: { pay1: { userId: 's2', userName: 'Rohan Kumar', kind: 'pro', amount: 499, at: Date.now() - 864e5 * 3 } },
  submissions: {
    s2_tt2_q4: { userId: 's2', testId: 'tt2', questionId: 'q4', passed: 3, total: 3, at: Date.now() - 864e5 * 6, code: 's = input()\nprint(s[::-1])\n' },
    s2_tt2_q5: { userId: 's2', testId: 'tt2', questionId: 'q5', passed: 2, total: 3, at: Date.now() - 864e5 * 6, code: 'n = int(input())\nprint("even" if n % 2 == 0 else "odd")\n' },
    s1_tt2_q4: { userId: 's1', testId: 'tt2', questionId: 'q4', passed: 1, total: 3, at: Date.now() - 864e5 * 4, code: 'print(input())\n' },
    s2_tt4_q4: { userId: 's2', testId: 'tt4', questionId: 'q4', passed: 3, total: 3, at: Date.now() - 864e5 * 12, code: 'print(input()[::-1])\n' },
    s2_tt5_q6: { userId: 's2', testId: 'tt5', questionId: 'q6', passed: 1, total: 3, at: Date.now() - 864e5 * 1, code: 'print(1)\n' },
    s2_tt1_q1: { userId: 's2', testId: 'tt1', questionId: 'q1', passed: 3, total: 3, at: Date.now() - 864e5 * 2, code: 'a, b = map(int, input().split())\nprint(a + b)\n' } },
});

// 1000 generated practice questions so Problems paging, filters and search can be tried at scale. Every 25th is private.
// Added to existing demo data too (ids g0001…g1000), so no reset is needed. Each one is solvable: the tests match the statement.
const TEMPLATES = [
  ['Add {k}', 'Math', 'Easy', 'Read an integer n and print n + {k}.', '-10^9 <= n <= 10^9\nn is a whole number', k => [[5, 5 + k], [0, k], [-3, -3 + k]]],
  ['Multiply by {k}', 'Math', 'Easy', 'Read an integer n and print n * {k}.', '-10^6 <= n <= 10^6\nn is a whole number', k => [[4, 4 * k], [0, 0], [-2, -2 * k]]],
  ['Remainder by {k}', 'Math', 'Medium', 'Read a non-negative integer n and print n mod {k}.', '0 <= n <= 10^9', k => [[100, 100 % k], [k, 0], [7 * k + 1, 1]]],
  ['Repeat a word {k} times', 'Strings', 'Medium', 'Read a word and print it {k} times with no spaces.', '1 <= length of the word <= 20\nThe word has lowercase letters only', k => [['ab', 'ab'.repeat(k)], ['x', 'x'.repeat(k)], ['hi', 'hi'.repeat(k)]]],
  ['Sum 1 to n, plus {k}', 'Loops', 'Hard', 'Read n (n >= 0) and print 1 + 2 + … + n, plus {k}.', '0 <= n <= 10^5', k => [[3, 6 + k], [0, k], [10, 55 + k]]],
];
// Constraints for the hand-written demo questions; also filled into demo data saved before they existed.
const CONSTRAINTS = {
  q1: '-10^9 <= a, b <= 10^9\nBoth numbers are on one line, separated by a space',
  q3: '-10^6 <= n <= 10^6',
  q5: '0 <= n <= 10^9',
  q6: '0 <= length of the line <= 1000\nWords are separated by one or more spaces',
};
function addBulk(d) {
  Object.entries(CONSTRAINTS).forEach(([id, c]) => { if (d.questions[id] && !d.questions[id].constraints) d.questions[id].constraints = c; });
  if (d.questions.g0001) { Object.values(d.questions).forEach((q, _, __, m = /^(Add|Multiply by|Remainder by|Repeat a word|Sum 1 to n)/.exec(q.title)) => { if (m && !q.constraints) q.constraints = TEMPLATES.find(t => t[0].startsWith(m[1]))?.[4]; }); return d; }
  const now = Date.now();
  for (let i = 1; i <= 1000; i++) {
    const id = 'g' + String(i).padStart(4, '0'), k = Math.floor(i / 10) + 2;
    if (i % 8 === 0) { // web page questions
      const word = `Title ${i}`;
      d.questions[id] = { title: `Heading that says ${word}`, env: 'web', diff: i % 16 ? 'Easy' : 'Medium', topic: 'HTML & CSS', authorId: i % 2 ? 't1' : 't2', statement: `Create an h1 whose text is ${word}.`, starter: '',
        tests: [{ desc: `The h1 says ${word}`, expr: `document.querySelector('h1')?.textContent.trim() === '${word}'` }], createdAt: now - i * 6e4, ...(i % 25 ? {} : { public: false }) };
      continue;
    }
    const [title, topic, diff, st, cons, cases] = TEMPLATES[i % TEMPLATES.length];
    d.questions[id] = { title: `${title.replace('{k}', k)} (#${i})`, env: 'code', diff, topic, authorId: i % 2 ? 't1' : 't2', statement: st.replaceAll('{k}', k), constraints: cons,
      tests: cases(k).map(([a, b], j) => ({ input: String(a), output: String(b), ...(j === 2 ? { hidden: true } : {}) })), createdAt: now - i * 6e4, ...(i % 25 ? {} : { public: false }) };
  }
  return d;
}

let data;
try { data = JSON.parse(localStorage.getItem(KEY)); } catch { /* fall through to seed */ }
data = addBulk(data || seed());

export const db0 = data;
export const session = { uid: localStorage.getItem(KEY + '-uid') };
const listeners = new Set();
export const watch = f => { listeners.add(f); return () => listeners.delete(f); };
export const commit = () => { localStorage.setItem(KEY, JSON.stringify(data)); listeners.forEach(f => f()); };
export const setUid = uid => { session.uid = uid; uid ? localStorage.setItem(KEY + '-uid', uid) : localStorage.removeItem(KEY + '-uid'); listeners.forEach(f => f()); };
export const resetDemo = () => { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '-uid'); location.reload(); };
