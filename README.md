# Techomato Education

React + Vite + Tailwind + Firebase (Auth, Firestore).

- **Admin**: creates courses/users, enrolls students after payment, marks students as subscribed.
- **Trainer**: writes questions (Python, JavaScript, C/C++ (basic) or HTML/CSS/JS) into the Question Bank, builds tests from it, assigns tests to their courses, reads results per student.
- **Admin** also gets an overview and a payments ledger (record the amount when enrolling). **Trainers** can open any student's submitted code from the results table and delete questions/tests.
- **Student**: solves questions in an editor, "Run sample tests" and "Submit" show test cases passed. Free students get one submission per question; subscribers can resubmit.

- **Student extras**: XP (10 per passed test case), daily streak, leaderboard, playground (run code with your own input), profile.
- **Proctored tests**: tick "Proctored" when a trainer creates a test. Students must allow the camera and go fullscreen. Tab switches, leaving fullscreen, copy/paste and right-click are logged (`proctor` collection), and a small camera photo is saved about once a minute (`snaps` collection, stored in Firestore because Firebase Storage needs a paid plan). Trainers see a "flags" chip per student and open it for the log and photos. Redeploy `firestore.rules` after pulling this.
- **Public pages**: landing, pricing, for institutes, help, privacy, terms.

## Setup

1. Create a Firebase project; enable **Authentication → Email/Password** and **Firestore**.
2. `cp .env.example .env` and fill in the web app config.
3. Deploy `firestore.rules` (Firebase console → Firestore → Rules, or `firebase deploy --only firestore:rules`).
4. Create the first admin by hand: add a user in Authentication, then in Firestore create `users/<that uid>` with `{ name, email, role: "admin", subscribed: false }`.
5. `npm install && npm run dev`. `npm test` runs the score-table test. `npm run lint` catches missing imports (a build will not).

## Demo mode (no Firebase needed)

If `VITE_FIREBASE_API_KEY` is not set, `npm run dev` and `npm run build` fall back to this same demo mode (the terminal prints a warning) instead of crashing. Always set the key before a real deploy.

`npm run demo` swaps Firebase for an in-memory stand-in (`src/demo/`) with sample data saved in the browser's localStorage. The login page shows one-click buttons for Admin, Trainer, Free student and Subscribed student (password `demo123`). It never touches Firebase, and `npm run dev` / `npm run build` are unaffected.

## Where things live

```
src/
  main.jsx, App.jsx      entry point; App.jsx lists every route
  Shell.jsx              sidebar, top bar, phone tabs; NAV is the menu per role
  auth.jsx, firebase.js  login state; Firestore helpers (list, listIn, questions cache)
  ui.jsx, Editor.jsx     shared components, icons, toasts, hooks; the code editor
  runner.js, lang-worker.js, public/pyodide-worker.js   in-browser grading
  score.js (+ test)      pure scoring, streak and date logic (the unit-tested code)
  index.css              all styling, design tokens at the top
  demo/                  fake Firebase used by npm run demo
  pages/
    public/              landing, login, pricing, help, legal
    staff/               admin and trainer pages, course detail (results, enroll, assign)
    student/             dashboard, courses, solve, problems, contest, leaderboard, ...
    Account.jsx          notifications, settings, search, forgot password (all roles)
firestore.rules, firebase.json   security rules and their deploy config
```

New page: add the file under the role's folder, then add its route in App.jsx and its menu entry in NAV (Shell.jsx).

## Known limits

- Grading runs in the browser (Pyodide for Python, sandboxed iframe for web), so a determined student can tamper with their score. Hidden test cases are readable by students via the Firestore API for the same reason.
- Proctoring is a deterrent plus evidence, not a lock: a second device or a helper off camera is not caught, and a student with devtools can skip the logging. Photos count against the free Firestore quota (about 10 KB each, one per minute per student). Anything high-stakes needs Safe Exam Browser or server-side grading.
- Java (and full C++/STL) is not supported: browsers can only run languages compiled to WebAssembly or interpreted in JS. C/C++ uses the JSCPP interpreter (core language only). Java needs a server runner such as Judge0.
- Students can take up to 5 minutes to see a newly added question (it is cached in the browser). The leaderboard shows the top 50 only. XP is written by the student's browser, so it can be faked.
- Admin-created passwords are shown in plain text in the form and must be shared with the user manually.
