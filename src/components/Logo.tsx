import { ShoppingBasket } from 'lucide-react';

interface LogoProps {
  className?: string;
}

export function PikaCartLogo({ className = '' }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 shrink-0 ${className}`}>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-basil-solid)] text-white shrink-0"
      >
        <ShoppingBasket className="h-5 w-5" strokeWidth={2.1} />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-[var(--text)] whitespace-nowrap">
        Pika<span className="text-[var(--accent-basil)]">Cart</span>
      </span>
    </div>
  );
}
