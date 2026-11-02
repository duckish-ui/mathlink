import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { LoadingState } from './components/ui';

// Each page is loaded on demand so heavy libraries (charts, KaTeX) only download when needed.
const AuthPage = lazy(() => import('./pages/AuthPage'));
const BattlePlay = lazy(() => import('./pages/BattlePlay'));
const Battles = lazy(() => import('./pages/Battles'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Landing = lazy(() => import('./pages/Landing'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const NewSession = lazy(() => import('./pages/NewSession'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Progress = lazy(() => import('./pages/Progress'));
const QuizPlay = lazy(() => import('./pages/QuizPlay'));
const Quizzes = lazy(() => import('./pages/Quizzes'));
const Resources = lazy(() => import('./pages/Resources'));
const SessionDetail = lazy(() => import('./pages/SessionDetail'));
const Sessions = lazy(() => import('./pages/Sessions'));

export default function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/new" element={<ProtectedRoute><NewSession /></ProtectedRoute>} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/quizzes" element={<Quizzes />} />
          <Route path="/quizzes/:id" element={<ProtectedRoute><QuizPlay /></ProtectedRoute>} />
          <Route path="/battles" element={<Battles />} />
          <Route path="/battles/:code" element={<ProtectedRoute><BattlePlay /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
