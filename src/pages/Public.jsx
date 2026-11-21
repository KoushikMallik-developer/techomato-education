import { Link } from 'react-router-dom';
import { Icon } from '../ui.jsx';
import { PublicPage } from './PublicLayout.jsx';

const Head = ({ title, sub }) => (
  <div className="stack" style={{ gap: 14, marginBottom: 36, maxWidth: 680 }}>
    <h1 className="h1" style={{ fontSize: 'clamp(40px,5.4vw,68px)' }}>{title}</h1>
    {sub && <p className="ink2" style={{ fontSize: 19, margin: 0 }}>{sub}</p>}
  </div>
);
const Tick = ({ children }) => <li className="row" style={{ gap: 8, alignItems: 'flex-start' }}><Icon name="check" size={18} stroke={2.4} color="var(--pass-strong)" />{children}</li>;

export function Pricing() {
  return (
    <PublicPage>
      <Head title="Simple plans" sub="Your institute enrolls you in a course. The plan decides how many times you can submit." />
      <div className="grid g2" style={{ gap: 20 }}>
        <article className="card stack" style={{ gap: 14, padding: 30 }}>
          <span className="chip" style={{ alignSelf: 'flex-start' }}>Free</span>
          <h2 className="h3" style={{ fontSize: 30 }}>Learn and try</h2>
          <ul className="stack ink2" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }}>
            <Tick>Every course your institute enrolls you in</Tick>
            <Tick>Unlimited “Run samples” while you work</Tick>
            <Tick>One graded submission for each question</Tick>
            <Tick>XP, streak and leaderboard</Tick>
          </ul>
        </article>
        <article className="card-dark stack" style={{ gap: 14, padding: 30 }}>
          <span className="chip chip-pass" style={{ alignSelf: 'flex-start' }}>Subscribed</span>
          <h2 className="h3" style={{ fontSize: 30 }}>Keep improving</h2>
          <ul className="stack" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0, color: '#C9CBD2' }}>
            <Tick>Everything in Free</Tick>
            <Tick>Resubmit any question as many times as you like</Tick>
            <Tick>Your trainer sees your best result</Tick>
          </ul>
        </article>
      </div>
      <p className="muted" style={{ marginTop: 28 }}>Course fees and subscription prices are set by your institute. Ask your admin to enroll you or add a subscription.</p>
    </PublicPage>
  );
}

export function Institutes() {
  return (
    <PublicPage>
      <Head title="For institutes and trainers" sub="Run coding courses with real tests, and see exactly how every student scored." />
      <div className="grid g3" style={{ gap: 20 }}>
        {[['Admins', 'Create courses and accounts, enroll students once they have paid, record the payment, and manage subscriptions.'],
          ['Trainers', 'Build a Question Bank in Python, JavaScript, C/C++ or HTML/CSS/JS. Turn questions into tests and assign them to your courses.'],
          ['Results', 'Open any course to see each student’s score per test, then look at the code they submitted.']].map(([t, b]) => (
          <article key={t} className="loop-card" style={{ minHeight: 0, background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 className="h3" style={{ fontSize: 28 }}>{t}</h3><p className="ink2" style={{ margin: 0, lineHeight: 1.6 }}>{b}</p>
          </article>
        ))}
      </div>
      <p style={{ marginTop: 32 }}><Link to="/login" className="btn btn-ink">Log in to your institute</Link></p>
    </PublicPage>
  );
}

const FAQ = [
  ['How do I get an account?', 'Your admin creates your account after you enroll and pay. You will get an email and a temporary password to log in with.'],
  ['Why can I only submit once?', 'Free accounts get one graded submission per question. You can run the sample tests as often as you like first. Ask your admin about a subscription to resubmit.'],
  ['What is the difference between Run and Submit?', 'Run samples checks only the example test cases and is not saved. Submit checks all test cases, including hidden ones, and records your score.'],
  ['Which languages can I use?', 'Python, JavaScript, C/C++ (core language) and HTML/CSS/JS web pages. Each question tells you which one to use.'],
  ['My code says “Time limit exceeded”.', 'Programs are stopped after about five seconds. Look for a loop that never ends or an approach that is too slow for large inputs.'],
  ['The first Python run is slow.', 'Python is loaded into your browser the first time you run it, which takes a few seconds. After that it is fast.'],
];
export function Help() {
  return (
    <PublicPage>
      <Head title="Help" sub="Quick answers for students and trainers." />
      <div style={{ maxWidth: 760, borderBottom: '1px solid var(--line)' }}>
        {FAQ.map(([q, a]) => <details key={q} className="faq"><summary>{q}</summary><p>{a}</p></details>)}
      </div>
      <p className="muted" style={{ marginTop: 24 }}>Still stuck? Ask your trainer or institute admin.</p>
    </PublicPage>
  );
}

const LEGAL = {
  privacy: ['Privacy', [
    ['What we store', 'Your name, email, role, the courses you are enrolled in, and the code and scores you submit for tests.'],
    ['Who can see it', 'Your trainer and your institute admin can see your submissions and scores. Other students can see your name and XP on the leaderboard.'],
    ['Your code', 'Code you run is executed in your own browser. Submitted code is stored so your trainer can review it.'],
    ['Deleting your data', 'Ask your institute admin to remove your account and submissions.'],
  ]],
  terms: ['Terms', [
    ['Using the platform', 'Use your own account and do your own work on tests. Do not share answers to graded questions.'],
    ['Accounts', 'Accounts are created and managed by your institute. They may be disabled if the rules of your course are broken.'],
    ['Fees', 'Course fees and subscriptions are agreed with your institute, not through this site.'],
    ['Availability', 'The service is provided as is. Scores are calculated in your browser and may be reviewed by your trainer.'],
  ]],
};
export function Legal({ kind }) {
  const [title, sections] = LEGAL[kind];
  return (
    <PublicPage>
      <Head title={title} sub="This is a plain-language summary. Your institute may add its own rules." />
      <div className="legal">{sections.map(([h, p]) => <section key={h}><h2>{h}</h2><p>{p}</p></section>)}</div>
    </PublicPage>
  );
}
