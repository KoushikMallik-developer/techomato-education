import { Link } from 'react-router-dom';
import { Avatar, Icon, highlight } from '../../ui.jsx';
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
        <div className="wrap">
          <section className="hero">
            <div className="stack reveal" style={{ gap: 26 }}>
              <h1 className="h1 hero-h">Write the code. Pass the tests. Prove it.</h1>
              <p className="ink2" style={{ fontSize: 20, lineHeight: 1.55, margin: 0, maxWidth: 540 }}>
                Courses with real coding tests. Students solve questions right in the browser and see which test cases passed. Trainers see how every student scored.
              </p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <Link to="/login" className="btn btn-accent btn-lg">Log in to start <Icon name="arrow" size={18} stroke={2.2} /></Link>
                <a href="#/" onClick={jump('loop')} className="btn btn-ghost btn-lg">See how it works</a>
              </div>
              <div className="row muted small" style={{ flexWrap: 'wrap', gap: 18 }}>
                {['Code in your browser', 'Python, JavaScript, C++, HTML/CSS', 'Hidden test cases'].map(x => (
                  <span key={x} className="row" style={{ gap: 6 }}><Icon name="check" size={16} stroke={2.4} color="var(--pass-strong)" />{x}</span>
                ))}
              </div>
            </div>

            <div className="hero-stage reveal reveal-2" aria-label="Preview of the coding workspace">
              <div className="window" style={{ position: 'absolute', left: 0, right: 30, top: 0 }}>
                <div className="win-bar"><div className="dots"><span /><span /><span /></div><span>pair_sum.py</span><span style={{ color: '#F2B8A8' }}>Python</span></div>
                <pre className="code" style={{ padding: '22px 24px' }} dangerouslySetInnerHTML={{ __html: highlight(HERO_CODE) }} />
                <div className="row" style={{ padding: '14px 24px 20px', borderTop: '1px solid var(--panel-line)', flexWrap: 'wrap', gap: 8 }}>
                  {['Sample 1', 'Sample 2', 'Hidden 8/8'].map(x => <span key={x} className="mono tiny" style={{ padding: '7px 11px', borderRadius: 8, background: '#1E3350', color: '#A9C7FF' }}>✓ {x}</span>)}
                </div>
              </div>
              <div className="float f-side" style={{ right: 0, bottom: 30, width: 240 }}>
                <div className="small muted" style={{ fontWeight: 500 }}>Test cases passed</div>
                <div className="big" style={{ fontSize: 42, margin: '8px 0 12px' }}>10/10</div>
                <div className="pips" style={{ gridTemplateColumns: 'repeat(10,minmax(0,1fr))' }}>{Array.from({ length: 10 }, (_, i) => <span key={i} style={{ background: 'var(--pass-strong)' }} />)}</div>
              </div>
              <div className="float row" style={{ left: 16, bottom: 0 }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--pass-soft)', display: 'grid', placeItems: 'center' }}><Icon name="check" color="var(--pass)" /></span>
                <div><div style={{ fontWeight: 600 }}>Accepted</div><div className="small muted">All hidden tests passed</div></div>
              </div>
            </div>
          </section>
        </div>

        <section id="loop" className="band section">
          <div className="wrap stack" style={{ gap: 48 }}>
            <div className="between" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 24 }}>
              <h2 className="h2" style={{ fontSize: 'clamp(36px,4.4vw,56px)', maxWidth: 640 }}>One place for the whole classroom.</h2>
              <p className="ink2" style={{ fontSize: 18, margin: 0, maxWidth: 440 }}>Everyone gets a screen built for their job, and they all see the same results.</p>
            </div>
            <div className="grid g3" style={{ gap: 20 }}>
              {STEPS.map(([title, body, tags], i) => (
                <article key={title} className="loop-card">
                  <span className="mono small" style={{ color: 'var(--accent)', fontWeight: 500 }}>Step {i + 1}</span>
                  <h3 className="h3" style={{ fontSize: 34 }}>{title}</h3>
                  <p className="ink2" style={{ margin: 0, fontSize: 17, lineHeight: 1.6 }}>{body}</p>
                  <div className="row" style={{ marginTop: 'auto', flexWrap: 'wrap', gap: 8 }}>
                    {tags.map(y => <span key={y} className="chip" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>{y}</span>)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="wrap">
          <section id="results" className="section">
            <div className="dark-band">
              <div className="stack" style={{ gap: 22 }}>
                <h2 className="h2" style={{ fontSize: 'clamp(36px,4.4vw,56px)' }}>See how every student scored.</h2>
                <p style={{ fontSize: 18, margin: 0, color: '#C9CBD2' }}>Assign a test to a course and watch results come in. Trainers get a score for each student on each test, based on the test cases they passed.</p>
                <Link to="/login" className="btn btn-accent" style={{ alignSelf: 'flex-start' }}>Log in</Link>
              </div>
              <div style={{ background: 'var(--panel-2)', borderRadius: 22, padding: 10 }}>
                <div className="between small" style={{ padding: '12px 16px', color: '#9CA0AB' }}><span>Week 1 basics, results</span><span>Score</span></div>
                {ROWS.map(([name, score], i) => (
                  <div key={name} className="lb-row" style={{ background: i === 0 ? '#2E3038' : 'transparent' }}>
                    <Avatar name={name} size={32} />
                    <span style={{ flexGrow: 1, fontWeight: 600 }}>{name}</span>
                    <span className="mono">{score}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="plans" className="section stack" style={{ gap: 28, paddingTop: 0 }}>
            <h2 className="h2" style={{ fontSize: 'clamp(36px,4.4vw,56px)' }}>Start free. Subscribe to retry.</h2>
            <div className="grid g2" style={{ gap: 20 }}>
              <article className="card stack" style={{ gap: 12, padding: 30 }}>
                <span className="chip" style={{ alignSelf: 'flex-start' }}>Free</span>
                <h3 className="h3" style={{ fontSize: 28 }}>One submission per question</h3>
                <p className="ink2" style={{ margin: 0 }}>Run the sample tests as often as you like. When you submit, it's your one graded attempt for that question.</p>
              </article>
              <article className="card-dark stack" style={{ gap: 12, padding: 30 }}>
                <span className="chip chip-pass" style={{ alignSelf: 'flex-start' }}>Subscribed</span>
                <h3 className="h3" style={{ fontSize: 28 }}>Resubmit as many times as you need</h3>
                <p style={{ margin: 0, color: '#C9CBD2' }}>Improve your answer and push your score up. Ask your admin to add a subscription to your account.</p>
              </article>
            </div>
          </section>

          <section className="section stack" style={{ alignItems: 'center', gap: 24, textAlign: 'center', paddingTop: 0 }}>
            <h2 className="h2" style={{ fontSize: 'clamp(40px,6vw,72px)' }}>Ready to write some code?</h2>
            <p className="ink2" style={{ margin: 0, fontSize: 19 }}>Your admin creates your account once you're enrolled.</p>
            <Link to="/login" className="btn btn-accent btn-lg">Log in</Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
