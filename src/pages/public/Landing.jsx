import { Link } from 'react-router-dom';
import { Avatar, Icon, highlight, btn, Card, Chip, H2, H3 } from '../../ui.jsx';
import { Footer, PublicNav } from './PublicLayout.jsx';

const HERO_CODE = 'def count_pairs(nums, k):\n    nums.sort()\n    i, j, total = 0, len(nums) - 1, 0\n    while i < j:\n        if nums[i] + nums[j] < k:\n            total += j - i\n            i += 1\n        else:\n            j -= 1\n    return total';
const jump = id => e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

const STEPS = [
  ['Admin', 'Add a course, create accounts for trainers and students, and enroll each student once they have paid.', ['Courses', 'Enrollment', 'Subscriptions']],
  ['Trainer', 'Write questions once in the Question Bank, in Python, JavaScript, C/C++ or HTML/CSS/JS. Build tests from them and assign them to a course.', ['Question bank', 'Tests', 'Assign to course']],
  ['Student', 'Open a test, write code in the browser, run the samples, and submit. See exactly which test cases passed.', ['Code editor', 'Test cases', 'Instant result']],
];
const ROWS = [['Rohan Kumar', '92%'], ['Ananya Roy', '88%'], ['Priya Banerjee', '75%'], ['Sneha Mukherjee', '64%'], ['Imran Sheikh', '41%']];

export default function Landing() {
  return (
    <div>
      <PublicNav onJump={jump} />

      <main>
        <div className="max-w-[1280px] mx-auto px-6">
          <section className="grid grid-cols-[1.05fr_1fr] gap-14 items-center pt-20 pb-24 max-tablet:grid-cols-1 max-tablet:pt-12 max-tablet:pb-16">
            <div className="flex flex-col animate-rise2 gap-6.5">
              <h1 className="font-display font-extrabold tracking-[-.035em] leading-[.98] m-0 text-[clamp(46px,6.2vw,84px)]">Write the code. Pass the tests. Prove it.</h1>
              <p className="text-ink-2 text-[20px] leading-[1.55] m-0 max-w-[540px]">
                Courses with real coding tests. Students solve questions right in the browser and see which test cases passed. Trainers see how every student scored.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Link to="/login" className={btn('accent', 'lg')}>Log in to start <Icon name="arrow" size={18} stroke={2.2} /></Link>
                <a href="#/" onClick={jump('loop')} className={btn('ghost', 'lg')}>See how it works</a>
              </div>
              <div className="flex items-center text-muted text-[13px] flex-wrap gap-4.5">
                {['Code in your browser', 'Python, JavaScript, C++, HTML/CSS', 'Hidden test cases'].map(x => (
                  <span key={x} className="flex items-center gap-1.5"><Icon name="check" size={16} stroke={2.4} color="var(--pass-strong)" />{x}</span>
                ))}
              </div>
            </div>

            <div className="relative min-h-[540px] max-tablet:min-h-[480px] max-phone:min-h-[420px] animate-rise2 [animation-delay:.12s]" aria-label="Preview of the coding workspace">
              <div className="bg-panel rounded-[20px] overflow-hidden shadow-[0_30px_60px_-24px_rgba(23,24,28,.5)] absolute left-0 right-7.5 top-0">
                <div className="h-11 flex items-center justify-between px-[18px] border-b border-panel-line font-mono text-[12px] text-panel-muted"><div className="flex gap-[7px] [:where(&)_span]:w-[11px] [:where(&)_span]:h-[11px] [:where(&)_span]:rounded-full [:where(&)_span]:bg-[#3A3D46]"><span /><span /><span /></div><span>pair_sum.py</span><span className="text-rose">Python</span></div>
                <pre className="font-mono text-[14px] leading-[1.75] text-panel-text m-0 whitespace-pre overflow-x-auto p-[22px_24px]" dangerouslySetInnerHTML={{ __html: highlight(HERO_CODE) }} />
                <div className="flex items-center p-[14px_24px_20px] [border-top:1px_solid_var(--panel-line)] flex-wrap gap-2">
                  {['Sample 1', 'Sample 2', 'Hidden 8/8'].map(x => <span key={x} className="font-mono text-[12px] p-[7px_11px] rounded-[8px] bg-[#1E3350] text-[#A9C7FF]">✓ {x}</span>)}
                </div>
              </div>
              <div className="absolute bg-surface rounded-[18px] py-[18px] px-5 shadow-[0_20px_40px_-18px_rgba(23,24,28,.35)] max-phone:hidden right-0 bottom-7.5 w-60">
                <div className="text-[13px] text-muted font-medium">Test cases passed</div>
                <div className="big font-display font-extrabold tracking-[-.03em] leading-none text-[42px] m-[8px_0_12px]">10/10</div>
                <div className="grid gap-1 grow [:where(&)_span]:h-2.5 [:where(&)_span]:rounded-[3px] [:where(&)_span]:bg-line grid-cols-[repeat(10,minmax(0,1fr))]">{Array.from({ length: 10 }, (_, i) => <span className="bg-pass-strong" key={i} />)}</div>
              </div>
              <div className="absolute bg-surface rounded-[18px] py-[18px] px-5 shadow-[0_20px_40px_-18px_rgba(23,24,28,.35)] flex items-center gap-3 left-4 bottom-0">
                <span className="w-11 h-11 rounded-[12px] bg-pass-soft grid place-items-center"><Icon name="check" color="var(--pass)" /></span>
                <div><div className="font-semibold">Accepted</div><div className="text-[13px] text-muted">All hidden tests passed</div></div>
              </div>
            </div>
          </section>
        </div>

        <section id="loop" className="bg-surface border-y border-line py-24 max-phone:py-16">
          <div className="max-w-[1280px] mx-auto px-6 flex flex-col gap-12">
            <div className="flex justify-between flex-wrap items-end gap-6">
              <H2 className="text-[clamp(36px,4.4vw,56px)] max-w-[640px]">One place for the whole classroom.</H2>
              <p className="text-ink-2 text-[18px] m-0 max-w-[440px]">Everyone gets a screen built for their job, and they all see the same results.</p>
            </div>
            <div className="grid grid-cols-3 max-tablet:grid-cols-1 gap-5">
              {STEPS.map(([title, body, tags], i) => (
                <article key={title} className="bg-paper rounded-3xl p-[34px] flex flex-col gap-4 min-h-[340px]">
                  <span className="font-mono text-[13px] text-accent font-medium">Step {i + 1}</span>
                  <H3 className="text-[34px]">{title}</H3>
                  <p className="text-ink-2 m-0 text-[17px] leading-[1.6]">{body}</p>
                  <div className="flex items-center mt-[auto] flex-wrap gap-2">
                    {tags.map(y => <span key={y} className="inline-flex items-center gap-1.5 py-1.5 px-[11px] rounded-full text-[12px] font-semibold whitespace-nowrap bg-surface [border:1px_solid_var(--line)]">{y}</span>)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-[1280px] mx-auto px-6">
          <section id="results" className="py-24 max-phone:py-16">
            <div className="bg-panel text-cream rounded-[32px] py-20 px-16 grid grid-cols-2 gap-14 items-center max-tablet:grid-cols-1 max-tablet:py-12 max-tablet:px-7">
              <div className="flex flex-col gap-5.5">
                <H2 className="text-[clamp(36px,4.4vw,56px)]">See how every student scored.</H2>
                <p className="text-[18px] m-0 text-on-dark-2">Assign a test to a course and watch results come in. Trainers get a score for each student on each test, based on the test cases they passed.</p>
                <Link to="/login" className={btn('accent', 'md', 'self-start')}>Log in</Link>
              </div>
              <div className="bg-panel-2 rounded-lg p-2.5">
                <div className="flex items-center justify-between gap-3 text-[13px] p-[12px_16px] text-panel-muted"><span>Week 1 basics, results</span><span>Score</span></div>
                {ROWS.map(([name, score], i) => (
                  <div key={name} className="flex items-center gap-4 py-[15px] px-4 rounded-[14px]" style={{ background: i === 0 ? '#2E3038' : 'transparent' }}>
                    <Avatar name={name} size={32} />
                    <span className="grow font-semibold">{name}</span>
                    <span className="font-mono">{score}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="plans" className="flex flex-col gap-7 pt-0">
            <H2 className="text-[clamp(36px,4.4vw,56px)]">Start free. Subscribe to retry.</H2>
            <div className="grid grid-cols-2 max-phone:grid-cols-1 gap-5">
              <Card as="article" className="flex flex-col gap-3 p-7.5">
                <Chip as="span" className="self-start">Free</Chip>
                <H3 className="text-[28px]">One submission per question</H3>
                <p className="text-ink-2 m-0">Run the sample tests as often as you like. When you submit, it's your one graded attempt for that question.</p>
              </Card>
              <article className="bg-panel text-cream rounded-lg flex flex-col gap-3 p-7.5">
                <Chip tone="pass" className="self-start">Subscribed</Chip>
                <H3 className="text-[28px]">Resubmit as many times as you need</H3>
                <p className="m-0 text-on-dark-2">Improve your answer and push your score up. Ask your admin to add a subscription to your account.</p>
              </article>
            </div>
          </section>

          <section className="flex flex-col items-center gap-6 text-center pt-0">
            <H2 className="text-[clamp(40px,6vw,72px)]">Ready to write some code?</H2>
            <p className="text-ink-2 m-0 text-[19px]">Your admin creates your account once you're enrolled.</p>
            <Link to="/login" className={btn('accent', 'lg')}>Log in</Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
