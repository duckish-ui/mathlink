import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const r = String.raw;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Deterministic pseudo-random numbers so every seed produces the same data.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);

const topics = [
  { slug: 'algebra', name: 'Algebra', color: '#6366f1', description: 'Equations, inequalities, functions and polynomials.' },
  { slug: 'geometry', name: 'Geometry', color: '#0ea5e9', description: 'Shapes, angles, area, volume and proofs.' },
  { slug: 'trigonometry', name: 'Trigonometry', color: '#14b8a6', description: 'The unit circle, identities and triangle solving.' },
  { slug: 'precalculus', name: 'Precalculus', color: '#f59e0b', description: 'Functions, logarithms, sequences and limits intuition.' },
  { slug: 'calculus', name: 'Calculus', color: '#ef4444', description: 'Limits, derivatives, integrals and their applications.' },
  { slug: 'statistics', name: 'Statistics', color: '#a855f7', description: 'Data, probability, distributions and inference.' },
];

type Q = [prompt: string, choices: string[], answerIndex: number, explanation: string];

const quizzes: { topic: string; title: string; description: string; difficulty: string; xpReward: number; questions: Q[] }[] = [
  {
    topic: 'algebra',
    title: 'Linear Equations Warm-up',
    description: 'Solve one- and two-step equations, slopes and simple systems.',
    difficulty: 'easy',
    xpReward: 50,
    questions: [
      [r`Solve for $x$: $3x + 7 = 22$`, [r`$x = 5$`, r`$x = 3$`, r`$x = \frac{29}{3}$`, r`$x = 15$`], 0, r`Subtract 7 from both sides to get $3x = 15$, then divide by 3.`],
      [r`What is the slope of the line through $(1, 2)$ and $(4, 11)$?`, [r`$\frac{1}{3}$`, r`$3$`, r`$9$`, r`$-3$`], 1, r`$m = \frac{11 - 2}{4 - 1} = \frac{9}{3} = 3$`],
      [r`Simplify $2(x - 3) - (x + 4)$`, [r`$x - 2$`, r`$3x - 10$`, r`$x - 10$`, r`$x + 2$`], 2, r`Distribute: $2x - 6 - x - 4 = x - 10$.`],
      [r`Solve the system $x + y = 10$ and $x - y = 4$`, [r`$x = 6,\ y = 4$`, r`$x = 3,\ y = 7$`, r`$x = 5,\ y = 5$`, r`$x = 7,\ y = 3$`], 3, r`Adding the equations gives $2x = 14$, so $x = 7$ and $y = 3$.`],
      [r`Solve $|2x - 1| = 5$`, [r`$x = 3$ or $x = -2$`, r`$x = 3$ only`, r`$x = -3$ or $x = 2$`, r`$x = 2$ or $x = -2$`], 0, r`Either $2x - 1 = 5$ (so $x = 3$) or $2x - 1 = -5$ (so $x = -2$).`],
    ],
  },
  {
    topic: 'algebra',
    title: 'Quadratics in Depth',
    description: 'Factoring, vertex form, the discriminant and Vieta’s formulas.',
    difficulty: 'medium',
    xpReward: 75,
    questions: [
      [r`Find the roots of $x^2 - 5x + 6 = 0$`, [r`$x = -2, -3$`, r`$x = 2, 3$`, r`$x = 1, 6$`, r`$x = -1, -6$`], 1, r`$x^2 - 5x + 6 = (x - 2)(x - 3)$.`],
      [r`What is the vertex of $y = (x - 4)^2 + 1$?`, [r`$(-4, 1)$`, r`$(4, -1)$`, r`$(4, 1)$`, r`$(1, 4)$`], 2, r`Vertex form $y = (x - h)^2 + k$ has vertex $(h, k) = (4, 1)$.`],
      [r`What is the discriminant of $2x^2 + 3x - 2$?`, [r`$-7$`, r`$25$`, r`$17$`, r`$1$`], 1, r`$b^2 - 4ac = 9 - 4(2)(-2) = 9 + 16 = 25$.`],
      [r`Factor $x^2 - 9$`, [r`$(x - 3)^2$`, r`$(x - 9)(x + 1)$`, r`$(x + 3)(x - 3)$`, r`$(x - 3)(x + 9)$`], 2, r`Difference of squares: $a^2 - b^2 = (a + b)(a - b)$.`],
      [r`What is the sum of the roots of $x^2 - 7x + 10 = 0$?`, [r`$-7$`, r`$10$`, r`$-10$`, r`$7$`], 3, r`By Vieta’s formulas the sum of the roots is $-\frac{b}{a} = 7$.`],
    ],
  },
  {
    topic: 'geometry',
    title: 'Triangles & Circles',
    description: 'Pythagorean theorem, angle sums, area and circumference.',
    difficulty: 'easy',
    xpReward: 50,
    questions: [
      [r`A right triangle has legs $6$ and $8$. How long is the hypotenuse?`, [r`$10$`, r`$14$`, r`$12$`, r`$\sqrt{28}$`], 0, r`$c = \sqrt{6^2 + 8^2} = \sqrt{100} = 10$.`],
      [r`What is the area of a circle with radius $3$?`, [r`$6\pi$`, r`$9\pi$`, r`$3\pi$`, r`$18\pi$`], 1, r`$A = \pi r^2 = 9\pi$.`],
      [r`What is the sum of the interior angles of a hexagon?`, [r`$540^\circ$`, r`$1080^\circ$`, r`$720^\circ$`, r`$360^\circ$`], 2, r`$(n - 2) \cdot 180^\circ = 4 \cdot 180^\circ = 720^\circ$.`],
      [r`Two angles of a triangle are $40^\circ$ and $65^\circ$. What is the third?`, [r`$85^\circ$`, r`$75^\circ$`, r`$65^\circ$`, r`$95^\circ$`], 1, r`$180^\circ - 40^\circ - 65^\circ = 75^\circ$.`],
      [r`What is the circumference of a circle with diameter $10$?`, [r`$10\pi$`, r`$20\pi$`, r`$25\pi$`, r`$5\pi$`], 0, r`$C = \pi d = 10\pi$.`],
    ],
  },
  {
    topic: 'trigonometry',
    title: 'Unit Circle Essentials',
    description: 'Exact values, radians and the Pythagorean identity.',
    difficulty: 'medium',
    xpReward: 75,
    questions: [
      [r`Evaluate $\sin\left(\frac{\pi}{6}\right)$`, [r`$\frac{\sqrt{3}}{2}$`, r`$\frac{1}{2}$`, r`$\frac{\sqrt{2}}{2}$`, r`$1$`], 1, r`$\frac{\pi}{6} = 30^\circ$, and $\sin 30^\circ = \frac{1}{2}$.`],
      [r`Evaluate $\cos(\pi)$`, [r`$0$`, r`$1$`, r`$-1$`, r`undefined`], 2, r`At angle $\pi$ the unit circle point is $(-1, 0)$, so $\cos\pi = -1$.`],
      [r`Evaluate $\tan\left(\frac{\pi}{4}\right)$`, [r`$1$`, r`$0$`, r`$\sqrt{3}$`, r`$\frac{1}{\sqrt{3}}$`], 0, r`$\tan\frac{\pi}{4} = \frac{\sin(\pi/4)}{\cos(\pi/4)} = 1$.`],
      [r`Simplify $\sin^2\theta + \cos^2\theta$`, [r`$0$`, r`$2$`, r`$\tan\theta$`, r`$1$`], 3, r`This is the Pythagorean identity.`],
      [r`Convert $135^\circ$ to radians`, [r`$\frac{2\pi}{3}$`, r`$\frac{3\pi}{4}$`, r`$\frac{5\pi}{6}$`, r`$\frac{3\pi}{2}$`], 1, r`$135 \cdot \frac{\pi}{180} = \frac{3\pi}{4}$.`],
    ],
  },
  {
    topic: 'precalculus',
    title: 'Functions & Logarithms',
    description: 'Composition, inverses, domains and log rules.',
    difficulty: 'medium',
    xpReward: 75,
    questions: [
      [r`If $f(x) = 2x + 1$ and $g(x) = x^2$, what is $f(g(3))$?`, [r`$49$`, r`$19$`, r`$13$`, r`$18$`], 1, r`$g(3) = 9$, then $f(9) = 19$.`],
      [r`Evaluate $\log_2 32$`, [r`$4$`, r`$16$`, r`$5$`, r`$6$`], 2, r`$2^5 = 32$.`],
      [r`What is the inverse of $f(x) = 3x - 6$?`, [r`$f^{-1}(x) = \frac{x}{3} + 2$`, r`$f^{-1}(x) = 3x + 6$`, r`$f^{-1}(x) = \frac{x - 6}{3}$`, r`$f^{-1}(x) = \frac{1}{3x - 6}$`], 0, r`Swap and solve: $x = 3y - 6 \Rightarrow y = \frac{x + 6}{3} = \frac{x}{3} + 2$.`],
      [r`Solve $e^x = 1$`, [r`$x = 1$`, r`$x = e$`, r`$x = -1$`, r`$x = 0$`], 3, r`Any nonzero base to the power $0$ is $1$.`],
      [r`What is the domain of $\sqrt{x - 4}$?`, [r`$x > 4$`, r`$x \ge 4$`, r`$x \le 4$`, r`all real numbers`], 1, r`The radicand must be non-negative: $x - 4 \ge 0$.`],
    ],
  },
  {
    topic: 'calculus',
    title: 'Derivatives 101',
    description: 'Power rule, trig, exponential and log derivatives.',
    difficulty: 'medium',
    xpReward: 100,
    questions: [
      [r`Find $\frac{d}{dx}\left(x^3\right)$`, [r`$3x^2$`, r`$x^2$`, r`$3x^3$`, r`$\frac{x^4}{4}$`], 0, r`Power rule: $\frac{d}{dx}x^n = nx^{n-1}$.`],
      [r`Find $\frac{d}{dx}\sin x$`, [r`$-\cos x$`, r`$\cos x$`, r`$\tan x$`, r`$-\sin x$`], 1, r`The derivative of $\sin x$ is $\cos x$.`],
      [r`Find $\frac{d}{dx}e^{2x}$`, [r`$e^{2x}$`, r`$2xe^{2x}$`, r`$2e^{2x}$`, r`$\frac{e^{2x}}{2}$`], 2, r`Chain rule: $e^{2x} \cdot \frac{d}{dx}(2x) = 2e^{2x}$.`],
      [r`What is the slope of the tangent to $y = x^2$ at $x = 3$?`, [r`$9$`, r`$3$`, r`$2$`, r`$6$`], 3, r`$y' = 2x$, so the slope at $x = 3$ is $6$.`],
      [r`Find $\frac{d}{dx}\ln x$`, [r`$\frac{1}{x}$`, r`$\ln x$`, r`$x$`, r`$e^x$`], 0, r`$\frac{d}{dx}\ln x = \frac{1}{x}$ for $x > 0$.`],
    ],
  },
  {
    topic: 'calculus',
    title: 'Limits & Integrals',
    description: 'Classic limits, antiderivatives and definite integrals.',
    difficulty: 'hard',
    xpReward: 125,
    questions: [
      [r`Evaluate $\displaystyle\lim_{x \to 0} \frac{\sin x}{x}$`, [r`$0$`, r`$1$`, r`$\infty$`, r`does not exist`], 1, r`A famous limit — provable with the squeeze theorem.`],
      [r`Find $\displaystyle\int 2x\,dx$`, [r`$2x^2 + C$`, r`$x^2 + C$`, r`$2 + C$`, r`$\frac{x^2}{2} + C$`], 1, r`Reverse power rule: $\int 2x\,dx = x^2 + C$.`],
      [r`Evaluate $\displaystyle\int_0^1 x^2\,dx$`, [r`$\frac{1}{2}$`, r`$1$`, r`$\frac{1}{3}$`, r`$\frac{2}{3}$`], 2, r`$\left[\frac{x^3}{3}\right]_0^1 = \frac{1}{3}$.`],
      [r`Evaluate $\displaystyle\lim_{x \to 2} \frac{x^2 - 4}{x - 2}$`, [r`$0$`, r`$2$`, r`undefined`, r`$4$`], 3, r`Factor: $\frac{(x - 2)(x + 2)}{x - 2} = x + 2 \to 4$.`],
      [r`Find $\displaystyle\int \cos x\,dx$`, [r`$\sin x + C$`, r`$-\sin x + C$`, r`$\cos x + C$`, r`$-\cos x + C$`], 0, r`Since $\frac{d}{dx}\sin x = \cos x$.`],
    ],
  },
  {
    topic: 'statistics',
    title: 'Data & Probability',
    description: 'Mean, median, range, combinations and simple probability.',
    difficulty: 'easy',
    xpReward: 50,
    questions: [
      [r`What is the mean of $2, 4, 6, 8, 10$?`, [r`$5$`, r`$6$`, r`$7$`, r`$30$`], 1, r`$\frac{2 + 4 + 6 + 8 + 10}{5} = \frac{30}{5} = 6$.`],
      [r`What is the median of $3, 9, 1, 7, 5$?`, [r`$5$`, r`$7$`, r`$3$`, r`$9$`], 0, r`Sorted: $1, 3, 5, 7, 9$ — the middle value is $5$.`],
      [r`Two fair coins are flipped. What is $P(\text{two heads})$?`, [r`$\frac{1}{2}$`, r`$\frac{1}{3}$`, r`$\frac{1}{4}$`, r`$\frac{3}{4}$`], 2, r`$\frac{1}{2} \cdot \frac{1}{2} = \frac{1}{4}$.`],
      [r`Evaluate $\binom{5}{2}$`, [r`$20$`, r`$10$`, r`$25$`, r`$5$`], 1, r`$\binom{5}{2} = \frac{5!}{2!\,3!} = 10$.`],
      [r`What is the range of $12, 4, 19, 7$?`, [r`$7$`, r`$19$`, r`$11$`, r`$15$`], 3, r`$\max - \min = 19 - 4 = 15$.`],
    ],
  },
];

const people = [
  { name: 'Demo Student', email: 'demo@mathlink.dev' },
  { name: 'Priya Natarajan', email: 'priya@mathlink.dev' },
  { name: 'Marcus Chen', email: 'marcus@mathlink.dev' },
  { name: 'Sofia Alvarez', email: 'sofia@mathlink.dev' },
  { name: 'Jordan Okafor', email: 'jordan@mathlink.dev' },
  { name: 'Aiden Park', email: 'aiden@mathlink.dev' },
  { name: 'Maya Goldberg', email: 'maya@mathlink.dev' },
  { name: 'Ethan Nguyen', email: 'ethan@mathlink.dev' },
  { name: 'Zara Hussain', email: 'zara@mathlink.dev' },
  { name: 'Leo Martins', email: 'leo@mathlink.dev' },
];

// offsetHours is relative to "now" when the seed runs, so sessions are always fresh.
const sessions: {
  topic: string;
  host: number;
  title: string;
  description: string;
  offsetHours: number;
  durationMin: number;
  capacity: number;
  lesson: string;
}[] = [
  {
    topic: 'calculus',
    host: 1,
    title: 'Power Rule Power Hour',
    description: 'Build intuition for derivatives and master the power rule with lots of practice.',
    offsetHours: -0.5,
    durationMin: 60,
    capacity: 12,
    lesson: r`## What a derivative measures
The derivative $f'(x)$ is the instantaneous rate of change of $f$ — the slope of the tangent line.

$$f'(x) = \lim_{h \to 0} \frac{f(x + h) - f(x)}{h}$$

## The power rule
For any real number $n$:

$$\frac{d}{dx}x^n = n x^{n-1}$$

## Worked example
Differentiate $f(x) = 4x^3 - 2x + 7$. Each term separately: $12x^2 - 2 + 0$, so $f'(x) = 12x^2 - 2$.

## Try it
Find the slope of $y = x^4$ at $x = 2$. (Answer: $4 \cdot 2^3 = 32$.)`,
  },
  {
    topic: 'algebra',
    host: 2,
    title: 'Factoring Bootcamp',
    description: 'GCF, trinomials, difference of squares — every factoring pattern you need for exams.',
    offsetHours: 3,
    durationMin: 90,
    capacity: 15,
    lesson: r`## Patterns to recognize
- Greatest common factor: $6x^2 + 9x = 3x(2x + 3)$
- Difference of squares: $a^2 - b^2 = (a + b)(a - b)$
- Perfect square: $a^2 + 2ab + b^2 = (a + b)^2$

## Trinomials with $a = 1$
To factor $x^2 + bx + c$, find two numbers that multiply to $c$ and add to $b$.

$$x^2 + 7x + 12 = (x + 3)(x + 4)$$

## Challenge
Factor $x^4 - 16$ completely. Hint: it is a difference of squares twice.`,
  },
  {
    topic: 'trigonometry',
    host: 3,
    title: 'Unit Circle Without Memorizing',
    description: 'Derive every special angle from two triangles instead of memorizing a chart.',
    offsetHours: 26,
    durationMin: 60,
    capacity: 10,
    lesson: r`## Two triangles are all you need
The $45$-$45$-$90$ triangle has sides $1, 1, \sqrt{2}$. The $30$-$60$-$90$ triangle has sides $1, \sqrt{3}, 2$.

## Coordinates on the unit circle
A point at angle $\theta$ is $(\cos\theta, \sin\theta)$. Scaling the triangles to hypotenuse $1$ gives

$$\left(\cos\tfrac{\pi}{6}, \sin\tfrac{\pi}{6}\right) = \left(\tfrac{\sqrt{3}}{2}, \tfrac{1}{2}\right)$$

## Symmetry
Reflecting across the axes only changes signs. Use the quadrant to choose the sign.`,
  },
  {
    topic: 'statistics',
    host: 4,
    title: 'Probability Puzzles',
    description: 'Counting, combinations and some surprising probability puzzles (Monty Hall included).',
    offsetHours: 30,
    durationMin: 75,
    capacity: 20,
    lesson: r`## Counting principle
If one task has $m$ outcomes and another has $n$, together they have $m \cdot n$ outcomes.

## Combinations
Choosing $k$ items from $n$ without order:

$$\binom{n}{k} = \frac{n!}{k!\,(n - k)!}$$

## Puzzle
What is the probability that at least two of $23$ people share a birthday? (It is just over $50\%$.)`,
  },
  {
    topic: 'precalculus',
    host: 5,
    title: 'Logarithms Made Logical',
    description: 'Understand logs as inverses of exponentials and use the rules with confidence.',
    offsetHours: 50,
    durationMin: 60,
    capacity: 12,
    lesson: r`## Definition
$\log_b a = c$ means exactly $b^c = a$.

## Rules
$$\log_b(xy) = \log_b x + \log_b y \qquad \log_b\left(\frac{x}{y}\right) = \log_b x - \log_b y \qquad \log_b(x^k) = k\log_b x$$

## Example
Solve $2^{x} = 20$: take logs to get $x = \frac{\ln 20}{\ln 2} \approx 4.32$.`,
  },
  {
    topic: 'geometry',
    host: 6,
    title: 'Proofs & Pythagoras',
    description: 'Several visual proofs of the Pythagorean theorem, then practice problems.',
    offsetHours: 54,
    durationMin: 45,
    capacity: 8,
    lesson: r`## The theorem
For a right triangle with legs $a, b$ and hypotenuse $c$:

$$a^2 + b^2 = c^2$$

## Proof by rearrangement
Four copies of the triangle inside a square of side $a + b$ leave a tilted square of area $c^2$. Rearranging them leaves two squares of area $a^2$ and $b^2$.

## Practice
Find the diagonal of a $5 \times 12$ rectangle. ($13$)`,
  },
  {
    topic: 'calculus',
    host: 7,
    title: 'Integration Techniques',
    description: 'u-substitution and integration by parts with step-by-step worked examples.',
    offsetHours: 74,
    durationMin: 90,
    capacity: 15,
    lesson: r`## u-substitution
Reverse the chain rule. For $\int 2x\cos(x^2)\,dx$, let $u = x^2$ so $du = 2x\,dx$:

$$\int \cos u\,du = \sin(x^2) + C$$

## Integration by parts
$$\int u\,dv = uv - \int v\,du$$

Example: $\int x e^x\,dx = xe^x - e^x + C$.`,
  },
  {
    topic: 'algebra',
    host: 8,
    title: 'Systems of Equations Showdown',
    description: 'Substitution vs. elimination vs. matrices — pick the fastest method every time.',
    offsetHours: 98,
    durationMin: 60,
    capacity: 12,
    lesson: r`## Elimination
Add or subtract equations to cancel a variable:

$$\begin{cases} 2x + 3y = 12 \\ 2x - y = 4 \end{cases} \Rightarrow 4y = 8 \Rightarrow y = 2,\ x = 3$$

## When to substitute
If a variable already has coefficient $1$, substitution is usually fastest.`,
  },
  {
    topic: 'statistics',
    host: 9,
    title: 'Normal Distribution & z-Scores',
    description: 'Standardize data, read z-tables and apply the 68-95-99.7 rule.',
    offsetHours: 122,
    durationMin: 60,
    capacity: 18,
    lesson: r`## z-scores
$$z = \frac{x - \mu}{\sigma}$$

## The empirical rule
About $68\%$ of data lies within $1\sigma$ of the mean, $95\%$ within $2\sigma$, and $99.7\%$ within $3\sigma$.`,
  },
  {
    topic: 'trigonometry',
    host: 2,
    title: 'Identities Speedrun',
    description: 'Prove identities fast: strategies for double-angle and sum formulas.',
    offsetHours: -48,
    durationMin: 60,
    capacity: 10,
    lesson: r`## Double-angle formulas
$$\sin 2\theta = 2\sin\theta\cos\theta \qquad \cos 2\theta = \cos^2\theta - \sin^2\theta$$`,
  },
  {
    topic: 'geometry',
    host: 3,
    title: 'Volume & Surface Area Review',
    description: 'Prisms, cylinders, cones and spheres — with formulas derived, not memorized.',
    offsetHours: -96,
    durationMin: 60,
    capacity: 12,
    lesson: r`## Sphere
$$V = \frac{4}{3}\pi r^3 \qquad A = 4\pi r^2$$`,
  },
];

const resources: { topic: string; title: string; description: string; url: string; type: string }[] = [
  { topic: 'algebra', title: 'Khan Academy: Algebra 1', type: 'Course', url: 'https://www.khanacademy.org/math/algebra', description: 'Free, self-paced lessons and practice for every Algebra 1 skill.' },
  { topic: 'algebra', title: 'OpenStax: Algebra and Trigonometry 2e', type: 'Book', url: 'https://openstax.org/details/books/algebra-and-trigonometry-2e', description: 'A free, peer-reviewed college algebra and trig textbook.' },
  { topic: 'algebra', title: '3Blue1Brown: Essence of Linear Algebra', type: 'Video', url: 'https://www.3blue1brown.com/topics/linear-algebra', description: 'Beautiful visual intuition for vectors, matrices and transformations.' },
  { topic: 'geometry', title: 'Khan Academy: Geometry', type: 'Course', url: 'https://www.khanacademy.org/math/geometry', description: 'Congruence, similarity, trig ratios, circles and solid geometry.' },
  { topic: 'geometry', title: 'GeoGebra Geometry', type: 'Interactive', url: 'https://www.geogebra.org/geometry', description: 'Construct shapes and explore theorems interactively.' },
  { topic: 'trigonometry', title: 'Khan Academy: Trigonometry', type: 'Course', url: 'https://www.khanacademy.org/math/trigonometry', description: 'Right triangles, the unit circle, graphs and identities.' },
  { topic: 'precalculus', title: 'Khan Academy: Precalculus', type: 'Course', url: 'https://www.khanacademy.org/math/precalculus', description: 'Complex numbers, vectors, matrices, series and conic sections.' },
  { topic: 'precalculus', title: 'Desmos Graphing Calculator', type: 'Interactive', url: 'https://www.desmos.com/calculator', description: 'Graph any function instantly and explore with sliders.' },
  { topic: 'calculus', title: "Paul's Online Notes: Calculus I", type: 'Notes', url: 'https://tutorial.math.lamar.edu/Classes/CalcI/CalcI.aspx', description: 'Clear notes and worked examples for limits, derivatives and integrals.' },
  { topic: 'calculus', title: '3Blue1Brown: Essence of Calculus', type: 'Video', url: 'https://www.3blue1brown.com/topics/calculus', description: 'A visual series that makes calculus feel like you could have invented it.' },
  { topic: 'calculus', title: 'OpenStax: Calculus Volume 1', type: 'Book', url: 'https://openstax.org/details/books/calculus-volume-1', description: 'A free, complete textbook for single-variable calculus.' },
  { topic: 'statistics', title: 'Khan Academy: Statistics & Probability', type: 'Course', url: 'https://www.khanacademy.org/math/statistics-probability', description: 'Data analysis, probability, distributions and inference.' },
  { topic: 'statistics', title: 'Seeing Theory', type: 'Interactive', url: 'https://seeing-theory.brown.edu/', description: 'A visual introduction to probability and statistics from Brown University.' },
];

async function main() {
  console.log('Clearing existing data…');
  await prisma.chatMessage.deleteMany();
  await prisma.xpEvent.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.sessionAttendee.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.session.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.user.deleteMany();

  const topicIds = new Map<string, string>();
  for (const [order, t] of topics.entries()) {
    const created = await prisma.topic.create({ data: { ...t, order } });
    topicIds.set(t.slug, created.id);
  }

  const createdQuizzes = [];
  for (const q of quizzes) {
    createdQuizzes.push(
      await prisma.quiz.create({
        data: {
          title: q.title,
          description: q.description,
          difficulty: q.difficulty,
          xpReward: q.xpReward,
          topicId: topicIds.get(q.topic)!,
          questions: {
            create: q.questions.map(([prompt, choices, answerIndex, explanation], order) => ({
              order,
              prompt,
              choices,
              answerIndex,
              explanation,
            })),
          },
        },
      }),
    );
  }

  await prisma.resource.createMany({
    data: resources.map(({ topic, ...rest }) => ({ ...rest, topicId: topicIds.get(topic)! })),
  });

  const passwordHash = await bcrypt.hash('password123', 10);
  const users = [];
  for (const p of people) {
    users.push(await prisma.user.create({ data: { ...p, passwordHash } }));
  }

  const now = Date.now();
  const createdSessions = [];
  for (const s of sessions) {
    createdSessions.push(
      await prisma.session.create({
        data: {
          title: s.title,
          description: s.description,
          lesson: s.lesson,
          startsAt: new Date(now + s.offsetHours * HOUR),
          durationMin: s.durationMin,
          capacity: s.capacity,
          meetingUrl: 'https://meet.jit.si/mathlink-' + s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          topicId: topicIds.get(s.topic)!,
          hostId: users[s.host].id,
        },
      }),
    );
  }

  // Everyone attends a random handful of sessions; the host always attends.
  for (const [i, session] of createdSessions.entries()) {
    const host = users[sessions[i].host];
    const others = users.filter((u) => u.id !== host.id && rand() < 0.45);
    const attendees = [host, ...others].slice(0, sessions[i].capacity - 1);
    await prisma.sessionAttendee.createMany({
      data: attendees.map((u) => ({ userId: u.id, sessionId: session.id })),
    });
  }

  // Generate 30 days of quiz attempts and XP history for every user.
  for (const [ui, user] of users.entries()) {
    const activity = ui === 0 ? 0.35 : 0.2 + rand() * 0.5;
    const skill = 0.45 + rand() * 0.5;
    const best = new Map<string, number>();
    const events: { amount: number; reason: string; createdAt: Date }[] = [];
    let streak = 0;
    let lastActive: Date | null = null;

    for (let day = 29; day >= 0; day--) {
      if (rand() > activity) {
        // Missing today doesn't break the streak yet — you still have until midnight.
        if (day > 0) streak = 0;
        continue;
      }
      const when = new Date(now - day * DAY - rand() * 6 * HOUR);
      const quiz = createdQuizzes[Math.floor(rand() * createdQuizzes.length)];
      const total = 5;
      let score = 0;
      for (let k = 0; k < total; k++) if (rand() < skill) score++;
      const prev = best.get(quiz.id) ?? 0;
      const xp = Math.max(0, Math.round((quiz.xpReward * score) / total) - Math.round((quiz.xpReward * prev) / total));
      best.set(quiz.id, Math.max(prev, score));

      await prisma.quizAttempt.create({ data: { userId: user.id, quizId: quiz.id, score, total, xpEarned: xp, createdAt: when } });
      if (xp > 0) events.push({ amount: xp, reason: `Scored ${score}/${total} on "${quiz.title}"`, createdAt: when });
      if (rand() < 0.4) {
        events.push({ amount: 15, reason: 'Joined a study session', createdAt: new Date(when.getTime() + HOUR) });
      }
      streak++;
      lastActive = when;
    }

    await prisma.xpEvent.createMany({ data: events.map((e) => ({ ...e, userId: user.id })) });
    await prisma.user.update({
      where: { id: user.id },
      data: { xp: events.reduce((sum, e) => sum + e.amount, 0), streak, lastActiveAt: lastActive },
    });
  }

  console.log(`Seeded ${topics.length} topics, ${quizzes.length} quizzes, ${sessions.length} sessions, ${users.length} users.`);
  console.log('Demo login: demo@mathlink.dev / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
