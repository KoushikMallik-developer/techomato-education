// Demo-mode backend: a tiny in-memory stand-in for Firebase, persisted to localStorage. Only bundled by `npm run demo`.
const KEY = 'tk-demo';
export const PASSWORD = 'demo123';

const seed = () => ({
  users: {
    a1: { name: 'Demo Admin', email: 'admin@demo.com', role: 'admin', subscribed: false },
    t1: { name: 'Demo Trainer', email: 'trainer@demo.com', role: 'trainer', subscribed: false },
    s1: { name: 'Ananya Roy', email: 'student@demo.com', role: 'student', subscribed: false },
    s2: { name: 'Rohan Kumar', email: 'pro@demo.com', role: 'student', subscribed: true },
  },
  questions: {
    q1: { title: 'Sum of two numbers', env: 'python', diff: 'Easy', topic: 'Math', authorId: 't1', statement: 'Read two integers on one line and print their sum.', starter: '# Read input with input(), print the answer\n',
      tests: [{ input: '2 3', output: '5' }, { input: '10 20', output: '30' }, { input: '-1 1', output: '0', hidden: true }] },
    q2: { title: 'Red Hello heading', env: 'web', diff: 'Easy', topic: 'HTML & CSS', authorId: 't1', statement: 'Create an h1 that says Hello and make it red.', starter: '<!DOCTYPE html>\n<html>\n<head>\n<style>\n\n</style>\n</head>\n<body>\n\n</body>\n</html>\n',
      tests: [{ desc: 'Page has an h1 saying Hello', expr: "document.querySelector('h1').textContent.trim() === 'Hello'" }, { desc: 'The h1 is red', expr: "getComputedStyle(document.querySelector('h1')).color === 'rgb(255, 0, 0)'" }] },
    q3: { title: 'Double it (C++)', env: 'cpp', diff: 'Easy', topic: 'Math', authorId: 't1', statement: 'Read an integer and print it doubled.', starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
      tests: [{ input: '4', output: '8' }, { input: '0', output: '0', hidden: true }] },
    q4: { title: 'Reverse a string', env: 'python', diff: 'Easy', topic: 'Strings', authorId: 't1', statement: 'Read a word and print it reversed.', starter: '# Read input with input(), print the answer\n',
      tests: [{ input: 'hello', output: 'olleh' }, { input: 'abc', output: 'cba' }, { input: 'a', output: 'a', hidden: true }] },
    q5: { title: 'Even or odd', env: 'python', diff: 'Easy', topic: 'Math', authorId: 't1', statement: 'Read an integer. Print EVEN if it is even, otherwise ODD.', starter: '# Read input with input(), print the answer\n',
      tests: [{ input: '4', output: 'EVEN' }, { input: '7', output: 'ODD' }, { input: '0', output: 'EVEN', hidden: true }] },
    q6: { title: 'Count the words', env: 'js', diff: 'Medium', topic: 'Strings', authorId: 't1', statement: 'Read one line and print how many words it has.', starter: '// Read each input line with input(), print with console.log\n',
      tests: [{ input: 'the quick brown fox', output: '4' }, { input: 'hello', output: '1' }, { input: 'a b  c', output: '3', hidden: true }] },
  },
  tests: { tt1: { title: 'Week 1 basics', questionIds: ['q1', 'q2', 'q3'], proctored: true, authorId: 't1' } },
  courses: { c1: { title: 'Coding Foundations', description: 'Python, C++ and the web.', trainerId: 't1', trainerName: 'Demo Trainer', students: ['s1', 's2'], testIds: ['tt1'] } },
  leaderboard: {
    s2: { name: 'Rohan Kumar', xp: 240, streak: 5, lastDay: '' },
    p1: { name: 'Priya Banerjee', xp: 310, streak: 9, lastDay: '' },
    p2: { name: 'Sneha Mukherjee', xp: 180, streak: 3, lastDay: '' },
    p3: { name: 'Imran Sheikh', xp: 90, streak: 1, lastDay: '' },
  },
  notifications: { n1: { userId: 's1', text: 'New test "Week 1 basics" in Coding Foundations', link: '/test/c1/tt1', read: false, at: Date.now() - 36e5 } },
  payments: { pay1: { userId: 's2', userName: 'Rohan Kumar', courseId: 'c1', courseTitle: 'Coding Foundations', amount: 1999, at: Date.now() - 864e5 * 3 } },
  submissions: { s2_tt1_q1: { userId: 's2', testId: 'tt1', questionId: 'q1', passed: 3, total: 3, code: 'a, b = map(int, input().split())\nprint(a + b)\n' } },
});

let data;
try { data = JSON.parse(localStorage.getItem(KEY)); } catch { /* fall through to seed */ }
data ||= seed();

export const db0 = data;
export const session = { uid: localStorage.getItem(KEY + '-uid') };
const listeners = new Set();
export const watch = f => { listeners.add(f); return () => listeners.delete(f); };
export const commit = () => { localStorage.setItem(KEY, JSON.stringify(data)); listeners.forEach(f => f()); };
export const setUid = uid => { session.uid = uid; uid ? localStorage.setItem(KEY + '-uid', uid) : localStorage.removeItem(KEY + '-uid'); listeners.forEach(f => f()); };
export const resetDemo = () => { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '-uid'); location.reload(); };
