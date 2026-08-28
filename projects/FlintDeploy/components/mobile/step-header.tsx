import { IconChevronLeft } from '@/components/icons';

interface StepHeaderProps {
  step: number;
  total: number;
  title: string;
  onBack?: () => void;
}

export function StepHeader({ step, total, title, onBack }: StepHeaderProps) {
  return (
    <div className="px-5 pt-1 pb-3">
      <div className="flex items-center justify-between mb-3">
        <button
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#f5f5f5] hover:bg-[#161616]"
          onClick={onBack}
        >
          <IconChevronLeft size={22} />
        </button>
        <div className="text-[11px] font-mono text-[#888888] uppercase tracking-[0.14em]">
          Step <span className="text-[#f5f5f5]">{step}</span> of{' '}
          <span>{total}</span>
        </div>
      </div>
      <h1 className="text-[22px] font-semibold leading-tight text-[#f5f5f5]">{title}</h1>
      <div className="mt-4 flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden bg-[#2a2a2a]">
            <div
              className="h-full rounded-full"
              style={{ width: i < step ? '100%' : '0%', background: i < step ? '#22c55e' : 'transparent' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
