import {
  Blend,
  ChefHat,
  CookingPot,
  Flame,
  Microwave,
  Wind,
} from 'lucide-react';
import type { ApplianceId } from '../types';

const APPLIANCE_ICON_MAP: Record<ApplianceId, typeof Flame> = {
  stove: Flame,
  air_fryer: Wind,
  oven: ChefHat,
  blender: Blend,
  microwave: Microwave,
  pressure_cooker: CookingPot,
};

export function ApplianceIllustration({
  id,
  active,
}: {
  id: ApplianceId;
  active: boolean;
}) {
  const Icon = APPLIANCE_ICON_MAP[id] || Flame;

  return (
    <span
      aria-hidden="true"
      className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors duration-150 ${
        active
          ? 'bg-[var(--accent-ember-tint)] border-[var(--accent-ember-border)] text-[var(--accent-ember)]'
          : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)]'
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </span>
  );
}
