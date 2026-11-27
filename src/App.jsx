import { Navigate, Route, Routes } from 'react-router-dom';
import { useMe } from './auth.jsx';
import Shell from './Shell.jsx';
import { Toast } from './ui.jsx';
import Landing from './pages/public/Landing.jsx';
import Login, { VerifyEmail } from './pages/public/Login.jsx';
import { Help, Institutes, Legal, Pricing } from './pages/public/Public.jsx';
import { AdminCourses, AdminOverview } from './pages/staff/Admin.jsx';
import { AdminPayments } from './pages/staff/Payments.jsx';
import { AdminUsers } from './pages/staff/Users.jsx';
import TestResults from './pages/staff/TestResults.jsx';
import { TrainerDashboard, TrainerCourses } from './pages/staff/Trainer.jsx';
import { TrainerResults } from './pages/staff/TrainerResults.jsx';
import { Questions, QuestionDetail, NewQuestion } from './pages/staff/Questions.jsx';
import { TestsPage, NewTest } from './pages/staff/Tests.jsx';
import CourseDetail from './pages/staff/CourseDetail.jsx';
import { Dashboard } from './pages/student/Dashboard.jsx';
import { Courses, CourseView, TestView } from './pages/student/Courses.jsx';
import { Solve } from './pages/student/Solve.jsx';
import { StudentResults, StudentTestResult, StudentTests } from './pages/student/TestsResults.jsx';
import { Leaderboard } from './pages/student/Leaderboard.jsx';
import { Playground, PlaygroundHome } from './pages/student/Playground.jsx';
import { Achievements, Contest, More, Problems } from './pages/student/Practice.jsx';
import { CheatSheets } from './pages/student/CheatSheets.jsx';
import { Forgot, SearchPage, Settings } from './pages/Account.jsx';

const page = (title, el) => <Shell title={title}>{el}</Shell>;
const home = <Route path="*" element={<Navigate to="/" replace />} />;

export default function App() {
  const me = useMe();
  let body;
  if (me === undefined) body = <p className="text-muted p-8">Loading…</p>;
  else if (!me) body = (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Login signup />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/for-institutes" element={<Institutes />} />
      <Route path="/help" element={<Help />} />
      <Route path="/privacy" element={<Legal kind="privacy" />} />
      <Route path="/terms" element={<Legal kind="terms" />} />
      {home}
    </Routes>
  );
  else if (me.unverified) body = <VerifyEmail />;
  else if (me.role === 'admin') body = (
    <Routes>
      <Route path="/" element={page('Overview', <AdminOverview />)} />
      <Route path="/courses" element={page('Courses', <AdminCourses />)} />
      <Route path="/users" element={page('Users', <AdminUsers />)} />
      <Route path="/payments" element={page('Payments', <AdminPayments />)} />
      <Route path="/course/:id" element={page('Course', <CourseDetail />)} />
      <Route path="/questions/:id" element={page('Question', <QuestionDetail />)} />
      <Route path="/questions/:id/edit" element={page('Edit question', <NewQuestion />)} />
      <Route path="/search" element={page('Search', <SearchPage />)} />
      <Route path="/profile" element={page('Profile and settings', <Settings />)} />
      <Route path="/settings" element={<Navigate to="/profile" replace />} />
      {home}
    </Routes>
  );
  else if (me.role === 'trainer') body = (
    <Routes>
      <Route path="/" element={page('Dashboard', <TrainerDashboard />)} />
      <Route path="/courses" element={page('Courses', <TrainerCourses />)} />
      <Route path="/results" element={page('Results', <TrainerResults />)} />
      <Route path="/results/:courseId/:testId" element={page('Test results', <TestResults />)} />
      <Route path="/questions" element={page('Question bank', <Questions />)} />
      <Route path="/questions/new" element={page('New question', <NewQuestion />)} />
      <Route path="/questions/:id" element={page('Question', <QuestionDetail />)} />
      <Route path="/questions/:id/edit" element={page('Edit question', <NewQuestion />)} />
      <Route path="/tests" element={page('Tests', <TestsPage />)} />
      <Route path="/tests/new" element={page('New test', <NewTest />)} />
      <Route path="/tests/:id/edit" element={page('Edit test', <NewTest />)} />
      <Route path="/course/:id" element={page('Course', <CourseDetail />)} />
      <Route path="/search" element={page('Search', <SearchPage />)} />
      <Route path="/profile" element={page('Profile and settings', <Settings />)} />
      <Route path="/settings" element={<Navigate to="/profile" replace />} />
      {home}
    </Routes>
  );
  else body = (
    <Routes>
      <Route path="/" element={page('Dashboard', <Dashboard />)} />
      <Route path="/courses" element={page('Courses', <Courses />)} />
      <Route path="/course/:id" element={page('Course', <CourseView />)} />
      <Route path="/tests" element={page('Tests', <StudentTests />)} />
      <Route path="/results" element={page('Results', <StudentResults />)} />
      <Route path="/results/:courseId/:testId" element={page('Test results', <StudentTestResult />)} />
      <Route path="/test/:courseId/:testId" element={page('Test', <TestView />)} />
      <Route path="/solve/:courseId/:testId/:qid" element={<Shell title="Question" focus><Solve /></Shell>} />
      <Route path="/playground" element={page('Playground', <PlaygroundHome />)} />
      <Route path="/playground/editor" element={<Shell title="Playground" focus><Playground /></Shell>} />
      <Route path="/leaderboard" element={page('Leaderboard', <Leaderboard />)} />
      <Route path="/problems" element={page('Problems', <Problems />)} />
      <Route path="/contest" element={page('Daily contest', <Contest />)} />
      <Route path="/achievements" element={page('Achievements', <Achievements />)} />
      <Route path="/cheatsheets" element={page('Cheat sheets', <CheatSheets />)} />
      <Route path="/profile" element={page('Profile and settings', <Settings />)} />
      <Route path="/settings" element={<Navigate to="/profile" replace />} />
      <Route path="/search" element={page('Search', <SearchPage />)} />
      <Route path="/more" element={page('More', <More />)} />
      {home}
    </Routes>
  );
  return <>{body}<Toast /></>;
}
