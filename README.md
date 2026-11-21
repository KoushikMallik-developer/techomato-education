# Techomato Education

React + Vite + Tailwind + Firebase (Auth, Firestore).

- **Admin**: creates courses/users, enrolls students after payment, marks students as subscribed.
- **Trainer**: writes questions (Python, JavaScript, C/C++ (basic) or HTML/CSS/JS) into the Question Bank, builds tests from it, assigns tests to their courses, reads results per student.
- **Admin** also gets an overview and a payments ledger (record the amount when enrolling). **Trainers** can open any student's submitted code from the results table and delete questions/tests.
- **Student**: solves questions in an editor, "Run sample tests" and "Submit" show test cases passed. Free students get one submission per question; subscribers can resubmit.

- **Student extras**: XP (10 per passed test case), daily streak, leaderboard, playground (run code with your own input), profile.
- **Public pages**: landing, pricing, for institutes, help, privacy, terms.

## Setup

1. Create a Firebase project; enable **Authentication → Email/Password** and **Firestore**.
2. `cp .env.example .env` and fill in the web app config.
3. Deploy `firestore.rules` (Firebase console → Firestore → Rules, or `firebase deploy --only firestore:rules`).
4. Create the first admin by hand: add a user in Authentication, then in Firestore create `users/<that uid>` with `{ name, email, role: "admin", subscribed: false }`.
5. `npm install && npm run dev`. `npm test` runs the score-table test.

## Demo mode (no Firebase needed)

`npm run demo` swaps Firebase for an in-memory stand-in (`src/demo/`) with sample data saved in the browser's localStorage. The login page shows one-click buttons for Admin, Trainer, Free student and Subscribed student (password `demo123`). It never touches Firebase, and `npm run dev` / `npm run build` are unaffected.

## Known limits

- Grading runs in the browser (Pyodide for Python, sandboxed iframe for web), so a determined student can tamper with their score. Hidden test cases are readable by students via the Firestore API for the same reason.
- Java (and full C++/STL) is not supported: browsers can only run languages compiled to WebAssembly or interpreted in JS. C/C++ uses the JSCPP interpreter (core language only). Java needs a server runner such as Judge0.
- Admin-created passwords are shown in plain text in the form and must be shared with the user manually.
