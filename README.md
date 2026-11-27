# Techomato Education

React + Vite + Tailwind + Firebase (Auth, Firestore).

- **Admin**: creates courses/users, enrolls students after payment, marks students as subscribed.
- **Trainer**: writes questions (Python, JavaScript, C/C++ (basic) or HTML/CSS/JS) into the Question Bank, builds tests from it, assigns tests to their courses, reads results per student.
- **Admin** also gets an overview and a payments ledger (courses are free; the amount is recorded when an admin switches on Pro for a student). **Trainers** can open any student's submitted code from the results table and delete questions/tests.
- **Student**: solves questions in an editor, "Run sample tests" and "Submit" show test cases passed. Each test is one attempt for everyone: a question can be submitted once, and a test whose questions are all submitted cannot be opened again. In practice, free students get one submission per question and subscribers can resubmit.

- **Student extras**: points (50 for each problem fully solved in Practice, once per problem; tests earn none), daily streak, leaderboard, playground (run code with your own input), profile.
- **Proctored tests**: tick "Proctored" when a trainer creates a test. Before starting, a setup check shows a live camera preview and a checklist: the camera works, the lighting is good (not too dark, too bright or backlit), exactly one face is visible, centered and facing the screen, the microphone works, and only one screen is connected. "Start exam" stays disabled until every line passes (thresholds are in `src/precheck.js`). The exam then shows no menu, and the student can leave only after submitting every question ("Finish exam"). If no face is detected, or the camera is covered or stops, a 10 second countdown starts and the exam is auto-submitted when it ends (it cancels if the face comes back). The open question is graded and saved, unanswered questions get an empty 0-score submission, and the exam cannot be restarted. More than one face, or looking away, shows an instant warning. Leaving fullscreen, a second screen or a muted microphone pauses the exam. Everything is logged (`proctor` collection: tab switches, paste/copy/cut, right-click, refused starts, warnings, countdowns, auto-submit, finish), and a photo is saved every 2 minutes and at each violation (`snaps`, in Firestore because Storage needs a paid plan; ids are capped per student by the rules). Trainers see a flags chip per student on the course page, a Results page with a per-test summary, and the full timeline with photos. Questions used in a proctored test are hidden from practice, the daily contest and search (within 5 minutes of the test being created). Redeploy `firestore.rules` after pulling this: the exam refuses to start if it cannot save its records.
- **Public pages**: landing, pricing, for institutes, help, privacy, terms.

- **Scheduled, timed tests**: a trainer creates a test on its own page (Tests > New test) with a publish time (students can start from then), an end time (nobody can start after it) and a time limit in minutes. Pressing Start creates an `attempts/<uid>_<testId>` document with a fixed deadline (start + limit). The timer runs against that deadline, so it keeps going while the page is closed; the student returns and continues with what is left. The page writes `beat` and `left` (seconds) to the attempt every 10 seconds. At zero, a proctored exam is auto-submitted; otherwise the questions lock. The rules refuse a new submission after the deadline (30 s grace) and an attempt created outside the window. Tests made before this feature have no schedule and no timer and behave as before. Redeploy `firestore.rules`. Programming questions have no language: students pick one in the editor, from the languages the trainer allowed on the test (`languages`, all three when a test has none; practice allows all). Web page questions (HTML/CSS/JS) are a separate type. Each answer stores the `lang` it was written in. A test cannot be saved without a title, questions, publish time, end time and time limit. The edit page has Test settings (Force publish opens a scheduled test now after a readiness check; Force close stops new starts) and a Danger zone: an open test cannot be deleted until it is closed, and question and test deletes ask for confirmation. Limits: the start time comes from the student's clock (the rules accept it only within 2 minutes of server time), the schedule cannot be edited after creation, and the questions of an unpublished test are still visible in the question bank and, for non-proctored tests, in practice.


## Setup

1. Create a Firebase project; enable **Authentication → Email/Password** and **Google** (add your site's domain under Authentication → Settings → Authorized domains) and **Firestore**. Anyone can sign up as a student; email sign-ups must open the verification link before their profile is created.
2. `cp .env.example .env` and fill in the web app config.
3. Deploy `firestore.rules` (Firebase console → Firestore → Rules, or `firebase deploy --only firestore:rules`). Then, if you use proctored tests, open Firestore > Rules > Rules Playground and check, as a student signed in, a create on `proctor/<uid>_<proctoredTestId>_5` (allowed), `..._3000` (denied), the same id for a test that is not proctored (denied) and another student's uid (denied).
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
    Account.jsx          settings, search, forgot password (all roles)
firestore.rules, firebase.json   security rules and their deploy config
```

New page: add the file under the role's folder, then add its route in App.jsx and its menu entry in NAV (Shell.jsx).

## Courses, results and rules (redeploy `firestore.rules`)
- A test is published only when it is in at least one course. Without a course it stays a draft. Trainers assign it on the new-test or edit-test page.
- Answers, test timers and proctoring records are stored per course: the same test in two courses has separate results. Answers saved before this change have no course and count in every course that has the test.
- `firestore.rules` changed (per-course ids, enrolled-in-course check, admins can edit questions). Deploy it before using a real Firebase project, or saving answers is refused.
- Trainers get a Dashboard at `/`; the course list moved to `/courses`. A question has its own page at `/questions/:id`.

## Known limits

- Grading runs in the browser (Pyodide for Python, sandboxed iframe for web), so a determined student can tamper with their score. Hidden test cases are readable by students via the Firestore API for the same reason, and so are a proctored test's questions before it starts. Only questions marked Private stay out of Practice, and a proctored test's questions are in Practice like any other public question, so mark exam questions Private (the question bank is readable by every signed-in user). Proctoring deters casual cheating; it is not a secure exam.
- Proctoring is strong deterrence plus evidence, not a lock: a browser cannot stop a second device, a helper off camera, a virtual camera or devtools. The face check (MediaPipe) loads from a CDN, so the exam needs internet, and it can misjudge poor light or glasses. Second-screen detection works in Chrome and Edge only. Photos count against the free Firestore quota (about 10 KB each, one per minute per student). Anything high-stakes needs Safe Exam Browser or server-side grading.
- Java (and full C++/STL) is not supported: browsers can only run languages compiled to WebAssembly or interpreted in JS. C/C++ uses the JSCPP interpreter (core language only). Java needs a server runner such as Judge0.
- Students can take up to 5 minutes to see a newly added question (it is cached in the browser). The leaderboard shows the top 50 only. Points are written by the student's browser, so it can be faked.
- A trainer's pages (Results, Tests, course results, question averages) show only the tests he wrote and his own courses. This is enforced in the app, not in `firestore.rules`: every trainer can still read all submissions through the Firestore API. Restricting that needs the course or test author stored on each submission.
- Any signed-in user can read every course (title, trainer and the ids of enrolled students) so students can browse "All courses". Test results stay private. Redeploy `firestore.rules` after pulling.
- Admin-created passwords are shown in plain text in the form and must be shared with the user manually.
