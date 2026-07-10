'use client';

interface ReviewStarsProps {
  rating: number;
  max?: number;
  size?: 'sm' | 'md';
}

export function ReviewStars({ rating, max = 5, size = 'sm' }: ReviewStarsProps) {
  const filled = Math.round(rating);
  const px = size === 'sm' ? 'text-xs' : 'text-sm';
  return (
    <span
      className={`inline-flex gap-0.5 ${px}`}
      aria-label={`${rating.toFixed(1)} de ${max} estrelas`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < filled ? 'text-amber-400' : 'text-slate-600'}>
          ★
        </span>
      ))}
    </span>
  );
}
