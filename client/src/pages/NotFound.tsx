import { Link } from 'react-router-dom';
import { MathText } from '../components/MathText';
import { buttonStyles } from '../components/ui';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <MathText className="text-4xl" text={String.raw`$\lim_{x \to \text{page}} f(x) = \varnothing$`} />
      <h1 className="mt-6 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-zinc-500">This page doesn't exist, even in the complex plane.</p>
      <Link to="/dashboard" className={`${buttonStyles.primary} mt-6`}>
        Back to dashboard
      </Link>
    </div>
  );
}
