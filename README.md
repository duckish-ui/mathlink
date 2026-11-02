# MathLink

Learn math **together**: live study rooms with a shared whiteboard, chat and real-time class problems, multiplayer Math Battles, server-graded quizzes with an AI tutor, XP, streaks, progress charts and a live leaderboard.

Built for **Full Stack Decal — Project 2: APImagination**.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19 + TypeScript, Vite, React Router 7, Axios, Tailwind CSS 4, Socket.IO client, KaTeX (math rendering), Recharts, lucide-react |
| Backend | Node + Express 5 (TypeScript via `tsx`), Socket.IO (real-time), Zod validation, JWT auth with bcrypt-hashed passwords, Helmet, compression, rate limiting |
| Database | PostgreSQL through the Prisma ORM (embedded Postgres locally, so no install or Docker needed) |
| External APIs | [Groq](https://console.groq.com) LLM for the AI tutor (called from the server so the key stays secret), [math.js](https://api.mathjs.org) over HTTPS for the calculator |
| Hosting | Render: one web service (API, websockets and the built React app on one origin) plus managed Postgres |

## Getting started

Requires Node 20+.

```bash
cp server/.env.example server/.env   # then set JWT_SECRET to any long random string
npm install
npm run dev                          # starts Postgres, the API on :4000 and the web app on http://localhost:5173
```

The first time, in a second terminal while `npm run dev` is running, create the tables and demo data:

```bash
npm run db:setup -w server
```

Log in with **demo@mathlink.dev / password123**. Every seeded user (for example `priya@mathlink.dev`, `marcus@mathlink.dev`) has the same password, which makes it easy to test multiplayer in two browsers.

To turn on the AI tutor, put a free key from https://console.groq.com/keys in `GROQ_API_KEY` in `server/.env`.

Other scripts:

- `npm run db:reset -w server` wipes the database and re-seeds it. Seeded sessions are scheduled relative to now, so re-seed if they have all ended.
- `npm run typecheck` typechecks the server and the client.
- `npm run build` makes a production build. Then run `NODE_ENV=production npm start` to serve everything from one port.

## Features

### Together, in real time
- **Live session rooms.** Everyone who joins a session gets a room with:
  - presence (who's here now)
  - a **shared whiteboard** (colors, sizes, eraser, undo; the host can clear it)
  - **chat** with LaTeX (`$x^2$`) and typing indicators, saved to the database
  - **live problems**: the host poses a question, everyone answers at once, the host reveals the answer and the class results, and correct answers earn XP
- **Math Battles.** Create a lobby, share a 5-letter code or link, and race through 7 questions. The server owns the timer, the answers and the scoring:
  - faster answers and streaks score more
  - the round reveals early once everyone has answered
  - the podium shows at the end, placements earn XP, and the host can start a rematch
  - open lobbies appear instantly on the Battles page
- **Everything updates live.** Attendee counts, session lists, the leaderboard, your XP and dashboard rank refresh the moment anyone changes them. The dashboard has a "Happening now" feed and a count of who's online.

### Learning
- **Quizzes.** Questions render real math. Grading happens on the server, so answers never reach the browser. You earn XP only for beating your previous best. Keyboard shortcuts work too.
- **AI tutor (Groq).** Ask for a hint during a quiz (the prompt never includes the answer, so it can't leak it). In the review, get a step-by-step explanation that addresses the wrong answer you picked.
- **Dashboard, Progress, Leaderboard, Resources:**
  - XP, level, streak and mastery by topic
  - a 30-day XP chart
  - a weekly and all-time leaderboard with a podium
  - curated resources, plus a math.js-powered calculator
- Responsive down to phone width, with automatic dark mode.

## Assignment requirements

| Requirement | Where |
| --- | --- |
| `useState` and `useEffect` | Everywhere, for example [`useApi`](client/src/hooks/useApi.ts), [`useLiveRoom`](client/src/hooks/useLiveRoom.ts), [`BattlePlay`](client/src/pages/BattlePlay.tsx) (countdown timer) and [`Whiteboard`](client/src/components/live/Whiteboard.tsx). The app also uses `useContext`, `useRef`, `useCallback`, `useMemo`, `useImperativeHandle` and custom hooks. |
| Multiple pages with React Router | [`App.tsx`](client/src/App.tsx): 14 routes, a nested layout, protected routes and URL query filters |
| Axios calling an HTTPS API | [`Calculator.tsx`](client/src/components/Calculator.tsx) calls `https://api.mathjs.org`. [`lib/api.ts`](client/src/lib/api.ts) is an Axios instance for our own API, and the server calls Groq over HTTPS. |
| Express server hosting an API | [`server/src/index.ts`](server/src/index.ts), [`server/src/routes/`](server/src/routes) and Socket.IO in [`server/src/lib/realtime.ts`](server/src/lib/realtime.ts) |
| Database | [`schema.prisma`](server/prisma/schema.prisma) defines the PostgreSQL tables: users, topics, sessions, attendees, chat messages, quizzes, questions, attempts, XP events and resources |

## API

All routes are prefixed with `/api`. 🔒 = requires `Authorization: Bearer <token>`.

| Method | Route | Description |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | Returns `{ token, user }` |
| GET | `/auth/me` 🔒 | Current user |
| GET | `/topics` | All topics |
| GET | `/dashboard` 🔒 | Stats, mastery, upcoming sessions, activity, recommendation |
| GET | `/sessions?scope=upcoming\|mine\|past&topic=slug` | List sessions |
| GET | `/sessions/:id` | Session with lesson and attendees |
| POST | `/sessions` 🔒 | Host a session |
| POST / DELETE | `/sessions/:id/join` 🔒 | Join / leave |
| GET | `/quizzes?topic=slug` | List quizzes (with your best score if logged in) |
| GET | `/quizzes/:id` | Questions without answers |
| POST | `/quizzes/:id/submit` 🔒 | `{ answers: number[] }` → score, XP and per-question feedback |
| POST | `/ai/hint`, `/ai/explain` 🔒 | AI tutor hint / step-by-step explanation for a question |
| GET | `/progress` 🔒 | XP timeline, mastery, accuracy, attempts |
| GET | `/leaderboard?range=week\|all` | Rankings |
| GET | `/resources?topic=slug` | Learning resources |

### Real-time events (Socket.IO, authenticated with the same JWT)

| Area | Client → server | Server → client |
| --- | --- | --- |
| Rooms | `room:join`, `room:leave` | `room:presence` |
| Chat | `chat:send`, `chat:typing` | `chat:message`, `chat:typing` |
| Whiteboard | `board:stroke`, `board:undo`, `board:clear` | `board:stroke`, `board:remove`, `board:clear` |
| Live problems | `poll:start`, `poll:answer`, `poll:reveal`, `poll:close` | `poll:state` |
| Battles | `battles:list`, `battle:create`, `battle:join`, `battle:start`, `battle:answer`, `battle:rematch`, `battle:leave` | `battle:state`, `battles:changed` |
| Global | n/a | `sessions:changed`, `leaderboard:changed`, `activity`, `online` |

## Deploying

The repo includes a Render Blueprint ([`render.yaml`](render.yaml)) that creates the web service and a Postgres database together:

1. Push this repo to GitHub.
2. On https://dashboard.render.com, choose **New → Blueprint** and pick the repo. Render reads `render.yaml`, generates `JWT_SECRET` and connects the database.
3. Optionally paste your Groq key into `GROQ_API_KEY`.

On each start, the server syncs the schema and seeds demo data only when the database is empty.

## Project structure

```
client/   React app (pages/, components/ incl. live/, hooks/, context/, lib/)
server/   Express + Socket.IO (src/routes/, src/lib/), Prisma schema + seed (prisma/), embedded dev DB (scripts/)
```
