import type { ApplianceId } from '../types';

export function ApplianceIllustration({
  id,
  active,
}: {
  id: ApplianceId;
  active: boolean;
}) {
  const stroke = active ? '#15803D' : '#52525B';
  const accent = active ? '#EA580C' : '#A1A1AA';

  switch (id) {
    case 'stove':
      return (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect x="6" y="18" width="28" height="15" rx="3" stroke={stroke} strokeWidth="2" />
          <path d="M12 18V15M28 18V15" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path d="M10 15H17M23 15H30" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path
            d="M13.5 12C13.5 10.5 14.5 9.5 14.5 8.5M26.5 12C26.5 10.5 25.5 9.5 25.5 8.5"
            stroke={accent}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="14" cy="25.5" r="2" stroke={stroke} strokeWidth="1.75" />
          <circle cx="20" cy="25.5" r="2" stroke={stroke} strokeWidth="1.75" />
          <circle cx="26" cy="25.5" r="2" stroke={stroke} strokeWidth="1.75" />
        </svg>
      );
    case 'air-fryer':
      return (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path
            d="M11 11C11 8.8 12.8 7 15 7H25C27.2 7 29 8.8 29 11V29C29 31.2 27.2 33 25 33H15C12.8 33 11 31.2 11 29V11Z"
            stroke={stroke}
            strokeWidth="2"
          />
          <path d="M11 21H29" stroke={stroke} strokeWidth="2" />
          <path d="M17 26H23" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="20" cy="14" r="2.5" stroke={accent} strokeWidth="1.75" />
        </svg>
      );
    case 'oven':
      return (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect x="7" y="8" width="26" height="24" rx="3" stroke={stroke} strokeWidth="2" />
          <path d="M7 14H33" stroke={stroke} strokeWidth="2" />
          <rect x="11" y="18" width="18" height="10" rx="1.5" stroke={stroke} strokeWidth="1.75" />
          <path d="M15 23H25" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <circle cx="13" cy="11" r="1.2" fill={stroke} />
          <circle cx="20" cy="11" r="1.2" fill={stroke} />
          <circle cx="27" cy="11" r="1.2" fill={accent} />
        </svg>
      );
    case 'blender':
      return (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path d="M13 9H27L25 23H15L13 9Z" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
          <path d="M15 23H25L27 32H13L15 23Z" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
          <path d="M16 7H24" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path d="M27 12H30C31 12 31.5 13 31.5 14V18C31.5 19 31 19.5 29.5 19.5H26" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="20" cy="27.5" r="1.8" fill={accent} />
        </svg>
      );
    case 'microwave':
      return (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect x="6" y="10" width="28" height="20" rx="3" stroke={stroke} strokeWidth="2" />
          <rect x="10" y="14" width="15" height="12" rx="1.5" stroke={stroke} strokeWidth="1.75" />
          <path d="M29 15V21" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <circle cx="29" cy="25" r="1.5" fill={stroke} />
          <path d="M14 20C15.5 18.5 17 21.5 18.5 20C20 18.5 21 20 21 20" stroke={accent} strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    case 'pressure-cooker':
      return (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path d="M10 17H30V28C30 30.2 28.2 32 26 32H14C11.8 32 10 30.2 10 28V17Z" stroke={stroke} strokeWidth="2" />
          <path d="M9 17C9 13.5 13.5 11.5 20 11.5C26.5 11.5 31 13.5 31 17" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path d="M18 11.5V8.5H22V11.5" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 19H10M30 19H33" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path d="M16 24.5H24" stroke={accent} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
}
