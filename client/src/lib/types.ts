export interface User {
  id: string;
  name: string;
  email: string;
  xp: number;
  streak: number;
  createdAt: string;
}

export interface TopicRef {
  id?: string;
  slug?: string;
  name: string;
  color: string;
}

export interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
}

export type SessionStatus = 'upcoming' | 'live' | 'ended';

export interface SessionSummary {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  capacity: number;
  attendeeCount: number;
  status: SessionStatus;
  joined: boolean;
  topic: TopicRef;
  host: { id: string; name: string };
}

export interface SessionDetail extends SessionSummary {
  lesson: string;
  meetingUrl: string | null;
  attendees: { id: string; name: string }[];
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  xpReward: number;
  questionCount: number;
  topic: TopicRef;
  bestScore: number | null;
}

export interface QuizDetail {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  xpReward: number;
  topic: TopicRef;
  questions: { id: string; prompt: string; choices: string[] }[];
}

export interface QuizResult {
  score: number;
  total: number;
  xpEarned: number;
  previousBest: number | null;
  results: { questionId: string; selected: number; correctIndex: number; correct: boolean; explanation: string }[];
}

export interface Mastery {
  topic: TopicRef;
  percent: number;
  quizzesTaken: number;
  quizzesTotal: number;
}

export interface DashboardData {
  user: User;
  stats: { xp: number; streak: number; rank: number; quizzesCompleted: number; sessionsJoined: number };
  mastery: Mastery[];
  upcomingSessions: { id: string; title: string; startsAt: string; durationMin: number; host: string; topic: TopicRef }[];
  recentActivity: { id: string; amount: number; reason: string; createdAt: string }[];
  recommendedQuiz: { id: string; title: string; difficulty: Difficulty; xpReward: number; topic: TopicRef } | null;
}

export interface ProgressData {
  xpTimeline: { date: string; gained: number; total: number }[];
  mastery: Mastery[];
  accuracy: number | null;
  totalAttempts: number;
  attempts: {
    id: string;
    quizId: string;
    quizTitle: string;
    topic: TopicRef;
    score: number;
    total: number;
    xpEarned: number;
    createdAt: string;
  }[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  streak: number;
  isYou: boolean;
}

export interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  type: string;
  topic: TopicRef;
}

export interface RoomUser {
  id: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  user: RoomUser;
}

export interface Stroke {
  id: string;
  userId: string;
  color: string;
  width: number;
  /** Points normalized to 0–1 so the board looks the same at any size. */
  points: [number, number][];
}

export interface LivePoll {
  questionId: string;
  prompt: string;
  choices: string[];
  counts: number[];
  totalAnswers: number;
  revealed: boolean;
  answerIndex: number | null;
  explanation: string | null;
}

export type BattleStatus = 'lobby' | 'question' | 'reveal' | 'finished';

export interface BattleState {
  code: string;
  hostId: string;
  topic: { slug: string; name: string } | null;
  status: BattleStatus;
  index: number;
  total: number;
  endsAt: number;
  serverNow: number;
  question: { prompt: string; choices: string[] } | null;
  answerIndex: number | null;
  explanation: string | null;
  players: {
    id: string;
    name: string;
    score: number;
    streak: number;
    connected: boolean;
    answered: boolean;
    choice: number | null;
    lastPoints: number;
  }[];
}

export interface BattleLobby {
  code: string;
  topic: { slug: string; name: string } | null;
  host: string;
  playerCount: number;
}
