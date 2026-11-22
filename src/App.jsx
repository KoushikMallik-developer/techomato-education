import { Navigate, Route, Routes } from 'react-router-dom';
import { useMe } from './auth.jsx';
import Shell from './Shell.jsx';
import { Toast } from './ui.jsx';
import Landing from './pages/public/Landing.jsx';
import Login from './pages/public/Login.jsx';
import { Help, Institutes, Legal, Pricing } from './pages/public/Public.jsx';
import { AdminCourses, AdminOverview, AdminPayments, AdminUsers } from './pages/staff/Admin.jsx';
import { TrainerCourses, TrainerResults, Questions, TestsPage } from './pages/staff/Trainer.jsx';
import CourseDetail from './pages/staff/CourseDetail.jsx';
import { Dashboard } from './pages/student/Dashboard.jsx';
import { Courses, CourseView, TestView } from './pages/student/Courses.jsx';
import { Solve } from './pages/student/Solve.jsx';
import { Leaderboard } from './pages/student/Leaderboard.jsx';
import { Playground } from './pages/student/Playground.jsx';
import { Profile } from './pages/student/Profile.jsx';
import { Achievements, CheatSheets, Contest, More, Problems } from './pages/student/Practice.jsx';
import { Forgot, Notifications, SearchPage, Settings } from './pages/Account.jsx';

const page = (title, el) => <Shell title={title}>{el}</Shell>;
const home = <Route path="*" element={<Navigate to="/" replace />} />;

export default function App() {
  const me = useMe();
  let body;
  if (me === undefined) body = <p style={{ padding: 32 }} className="muted">Loading…</p>;
  else if (!me) body = (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/for-institutes" element={<Institutes />} />
      <Route path="/help" element={<Help />} />
      <Route path="/privacy" element={<Legal kind="privacy" />} />
      <Route path="/terms" element={<Legal kind="terms" />} />
      {home}
    </Routes>
  );
  else if (me.role === 'admin') body = (
    <Routes>
      <Route path="/" element={page('Overview', <AdminOverview />)} />
      <Route path="/courses" element={page('Courses', <AdminCourses />)} />
      <Route path="/users" element={page('Users', <AdminUsers />)} />
      <Route path="/payments" element={page('Payments', <AdminPayments />)} />
      <Route path="/course/:id" element={page('Course', <CourseDetail />)} />
      <Route path="/search" element={page('Search', <SearchPage />)} />
      <Route path="/settings" element={page('Settings', <Settings />)} />
      {home}
    </Routes>
  );
  else if (me.role === 'trainer') body = (
    <Routes>
      <Route path="/" element={page('My courses', <TrainerCourses />)} />
      <Route path="/results" element={page('Results', <TrainerResults />)} />
      <Route path="/questions" element={page('Question bank', <Questions />)} />
      <Route path="/tests" element={page('Tests', <TestsPage />)} />
      <Route path="/course/:id" element={page('Course', <CourseDetail />)} />
      <Route path="/search" element={page('Search', <SearchPage />)} />
      <Route path="/settings" element={page('Settings', <Settings />)} />
      {home}
    </Routes>
  );
  else body = (
    <Routes>
      <Route path="/" element={page('Dashboard', <Dashboard />)} />
      <Route path="/courses" element={page('Courses', <Courses />)} />
      <Route path="/course/:id" element={page('Course', <CourseView />)} />
      <Route path="/test/:courseId/:testId" element={page('Test', <TestView />)} />
      <Route path="/solve/:testId/:qid" element={page('Question', <Solve />)} />
      <Route path="/playground" element={page('Playground', <Playground />)} />
      <Route path="/leaderboard" element={page('Leaderboard', <Leaderboard />)} />
      <Route path="/profile" element={page('Your profile', <Profile />)} />
      <Route path="/problems" element={page('Problems', <Problems />)} />
      <Route path="/contest" element={page('Daily contest', <Contest />)} />
      <Route path="/achievements" element={page('Achievements', <Achievements />)} />
      <Route path="/cheatsheets" element={page('Cheat sheets', <CheatSheets />)} />
      <Route path="/notifications" element={page('Notifications', <Notifications />)} />
      <Route path="/settings" element={page('Settings', <Settings />)} />
      <Route path="/search" element={page('Search', <SearchPage />)} />
      <Route path="/more" element={page('More', <More />)} />
      {home}
    </Routes>
  );
  return <>{body}<Toast /></>;
}
