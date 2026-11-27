import { Link } from 'react-router-dom';
import { Icon, Card, Chip, Hero, btn, H3 } from '../../ui.jsx';
import { PublicPage } from './PublicLayout.jsx';

const Head = ({ title, sub }) => (
  <Hero className="mb-9 p-12! max-phone:p-6!">
    <div className="flex flex-col gap-4 max-w-[680px]">
      <span className="self-start inline-flex items-center gap-2 rounded-full bg-soft border border-line px-3 py-1.5 text-[12px] font-semibold"><span className="w-2 h-2 rounded-full bg-[#FF8A5B]" />Techomato</span>
      <h1 className="font-display font-extrabold tracking-[-.035em] leading-[.98] m-0 text-[clamp(40px,5.4vw,64px)]">{title}</h1>
      {sub && <p className="text-ink-2 text-[18px] m-0">{sub}</p>}
    </div>
  </Hero>
);
const Tick = ({ children }) => <li className="flex gap-2 items-start"><Icon name="check" size={18} stroke={2.4} color="var(--pass-strong)" />{children}</li>;

export function Pricing() {
  return (
    <PublicPage>
      <Head title="Simple plans" sub="Your institute enrolls you in a course. The plan decides how many times you can submit." />
      <div className="grid grid-cols-2 max-phone:grid-cols-1 gap-5">
        <Card as="article" className="flex flex-col gap-3.5 p-7.5">
          <Chip as="span" className="self-start">Free</Chip>
          <H3 as="h2" className="text-[30px]">Learn and try</H3>
          <ul className="flex flex-col text-ink-2 gap-2.5 list-none! p-0 m-0">
            <Tick>Every course your institute enrolls you in</Tick>
            <Tick>Unlimited “Run samples” while you work</Tick>
            <Tick>One graded submission for each question</Tick>
            <Tick>Points, streak and leaderboard</Tick>
          </ul>
        </Card>
        <Card as="article" className="flex flex-col gap-3.5 p-7.5 border-accent/50! shadow-[0_20px_50px_-30px_rgba(226,87,61,.6)]!">
          <Chip tone="accent" className="self-start">Subscribed</Chip>
          <H3 as="h2" className="text-[30px]">Keep improving</H3>
          <ul className="flex flex-col gap-2.5 list-none! p-0 m-0 text-ink-2">
            <Tick>Everything in Free</Tick>
            <Tick>Resubmit any question as many times as you like</Tick>
            <Tick>Your trainer sees your best result</Tick>
          </ul>
        </Card>
      </div>
      <p className="text-muted mt-7">Courses are free. The subscription price is set by your institute, which adds it to your account.</p>
    </PublicPage>
  );
}

export function Institutes() {
  return (
    <PublicPage>
      <Head title="For institutes and trainers" sub="Run coding courses with real tests, and see exactly how every student scored." />
      <div className="grid grid-cols-3 max-tablet:grid-cols-1 gap-5">
        {[['Admins', 'Create courses and trainer accounts, enroll students, and switch on Pro subscriptions with their payments recorded.'],
          ['Trainers', 'Build a Question Bank in Python, JavaScript, C / C++ or HTML / CSS / JS. Turn questions into timed, optionally proctored tests and assign them to your courses.'],
          ['Results', 'Open any course to see each student’s score per test, then look at the code they submitted.']].map(([t, b]) => (
          <article key={t} className="rounded-3xl p-[34px] flex flex-col gap-4 min-h-0 bg-surface [border:1px_solid_var(--line)]">
            <H3 className="text-[28px]">{t}</H3><p className="text-ink-2 m-0 leading-[1.6]">{b}</p>
          </article>
        ))}
      </div>
      <p className="mt-8"><Link to="/login" className={btn('ink')}>Log in to your institute</Link></p>
    </PublicPage>
  );
}

const FAQ = [
  ['How do I get an account?', 'Sign up with Google, or with your email and a password and then open the link we email you. After that your institute enrolls you in its courses.'],
  ['Why can I only submit once?', 'Free accounts get one graded submission per question. You can run the sample tests as often as you like first. Subscribed accounts can resubmit.'],
  ['What is the difference between Run and Submit?', 'Run samples checks only the example test cases and is not saved. Submit checks all test cases, including hidden ones, and records your score.'],
  ['Which languages can I use?', 'Python, JavaScript, C / C++ (core language) and HTML / CSS / JS web pages. A test may limit which languages you can use.'],
  ['My code says “Time limit exceeded”.', 'Programs are stopped after about five seconds. Look for a loop that never ends or an approach that is too slow for large inputs.'],
  ['The first Python run is slow.', 'Python is loaded into your browser the first time you run it, which takes a few seconds. After that it is fast.'],
];
export function Help() {
  return (
    <PublicPage>
      <Head title="Help" sub="Quick answers for students and trainers." />
      <div className="max-w-[760px] [border-bottom:1px_solid_var(--line)]">
        {FAQ.map(([q, a]) => <details key={q} className="group/faq border-t border-line py-1 [:where(&)_summary]:cursor-pointer [:where(&)_summary]:min-h-[52px] [:where(&)_summary]:flex [:where(&)_summary]:items-center [:where(&)_summary]:justify-between [:where(&)_summary]:font-semibold [:where(&)_summary]:text-[17px] [:where(&)_summary]:list-none [:where(&)_summary::-webkit-details-marker]:hidden [:where(&)_summary]:after:content-['+'] [:where(&)_summary]:after:text-[24px] [:where(&)_summary]:after:font-normal [:where(&)_summary]:after:text-muted [&[open]_summary]:after:content-['−'] [:where(&)_p]:mb-4 [:where(&)_p]:text-ink-2 [:where(&)_p]:leading-[1.65]"><summary>{q}</summary><p>{a}</p></details>)}
      </div>
      <p className="text-muted mt-6">Still stuck? Ask your trainer or institute admin.</p>
    </PublicPage>
  );
}

const LEGAL = {
  privacy: ['Privacy', [
    ['What we store', 'Your name, email, role, the courses you are enrolled in, and the code and scores you submit for tests.'],
    ['Who can see it', 'Your trainer and your institute admin can see your submissions and scores. Other students can see your name and points on the leaderboard.'],
    ['Your code', 'Code you run is executed in your own browser. Submitted code is stored so your trainer can review it.'],
    ['Deleting your data', 'Ask your institute admin to remove your account and submissions.'],
  ]],
  terms: ['Terms', [
    ['Using the platform', 'Use your own account and do your own work on tests. Do not share answers to graded questions.'],
    ['Accounts', 'Accounts are created and managed by your institute. They may be disabled if the rules of your course are broken.'],
    ['Fees', 'Courses are free. Pro subscriptions are paid to your institute, not through this site.'],
    ['Availability', 'The service is provided as is. Scores are calculated in your browser and may be reviewed by your trainer.'],
  ]],
};
export function Legal({ kind }) {
  const [title, sections] = LEGAL[kind];
  return (
    <PublicPage>
      <Head title={title} sub="This is a plain-language summary. Your institute may add its own rules." />
      <div className="max-w-[72ch] [:where(&)_h2]:font-display [:where(&)_h2]:text-[26px] [:where(&)_h2]:tracking-[-.02em] [:where(&)_h2]:mt-8 [:where(&)_h2]:mb-2 [:where(&)_p]:text-ink-2 [:where(&)_p]:leading-[1.7] [:where(&)_li]:text-ink-2 [:where(&)_li]:leading-[1.7]">{sections.map(([h, p]) => <section key={h}><h2>{h}</h2><p>{p}</p></section>)}</div>
    </PublicPage>
  );
}
