interface LogoProps {
  className?: string;
}

export function PikaCartLogo({ className = '' }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 shrink-0 ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="8" fill="#15803D" />
        {/* 2-stroke custom shopping basket + fresh basil leaf accent */}
        <path
          d="M8.5 14.5H23.5L21.8 22.8C21.6 23.8 20.7 24.5 19.7 24.5H12.3C11.3 24.5 10.4 23.8 10.2 22.8L8.5 14.5Z"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.5 14.5C12.5 11.2 14.8 8.5 18.8 8C19.2 11.5 16.8 14 12.5 14.5Z"
          stroke="#FDBA74"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight text-[#18181B] whitespace-nowrap">
        Pika<span className="text-[#15803D]">Cart</span>
      </span>
    </div>
  );
}
