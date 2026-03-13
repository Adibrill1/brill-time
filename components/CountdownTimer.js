import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../lib/useTranslation';

export default function CountdownTimer({ deadlineAt, onExpire, winningSlotStart, winningSlotEnd, isPending }) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const calc = () => {
      const diff = deadlineAt - Date.now();
      if (diff <= 0) {
        setTimeLeft(null);
        if (!firedRef.current) { firedRef.current = true; onExpire?.(); }
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      setTimeLeft({
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
      });
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [deadlineAt]);

  const pad = n => String(n).padStart(2, '0');
  const dayNames = t('common.days');

  // Format the deadline as a readable date/time string
  const deadlineLabel = deadlineAt
    ? t('common.deadlineFormat', {
        day: dayNames[new Date(deadlineAt).getDay()],
        date: new Date(deadlineAt).getDate(),
        month: new Date(deadlineAt).getMonth() + 1,
        time: `${pad(new Date(deadlineAt).getHours())}:${pad(new Date(deadlineAt).getMinutes())}`,
      })
    : null;

  const DeadlineNote = ({ past }) => {
    if (!deadlineLabel) return null;
    return (
      <div className="text-xs text-center mt-1" style={{ color: 'var(--color-muted)' }}>
        {t(past ? 'timer.deadlinePast' : 'timer.deadlineFuture', { datetime: deadlineLabel })}
      </div>
    );
  };

  if (!timeLeft) {
    if (winningSlotStart) {
      const winStart = new Date(winningSlotStart);
      const winEnd = winningSlotEnd ? new Date(winningSlotEnd) : null;
      const dateStr = t('common.winDateFormat', { day: dayNames[winStart.getDay()], date: winStart.getDate(), month: winStart.getMonth() + 1 });
      const timeStr = winEnd
        ? `${pad(winStart.getHours())}:${pad(winStart.getMinutes())} – ${pad(winEnd.getHours())}:${pad(winEnd.getMinutes())}`
        : `${pad(winStart.getHours())}:${pad(winStart.getMinutes())}`;
      return (
        <div>
          <div className="text-center py-2 px-4 rounded-lg text-sm font-bold" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
            {t('timer.decided', { date: dateStr, time: timeStr })}
          </div>
          <DeadlineNote past />
        </div>
      );
    }
    if (isPending) {
      return (
        <div>
          <div className="text-center py-2 px-4 rounded-lg text-sm font-medium" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
            ⏳ {t('timer.pending')}
          </div>
          <DeadlineNote past />
        </div>
      );
    }
    return (
      <div>
        <div className="text-center py-2 px-4 rounded-lg text-sm font-medium" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
          {t('timer.expired')}
        </div>
        <DeadlineNote past />
      </div>
    );
  }

  const { days, hours, minutes, seconds } = timeLeft;
  const Block = ({ value, label }) => (
    <div className="rounded-lg p-2 min-w-[52px] text-center" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
      <div className="text-2xl font-bold tabular-nums leading-none">{String(value).padStart(2, '0')}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{label}</div>
    </div>
  );
  const Colon = () => <span className="text-xl font-bold" style={{ lineHeight: '1', alignSelf: 'center', paddingBottom: '14px' }}>:</span>;

  return (
    <div>
      <div className="flex items-end justify-center gap-1" style={{ direction: 'ltr' }}>
        {days > 0 && <><Block value={days} label={t('timer.days')} /><Colon /></>}
        <Block value={hours} label={t('timer.hours')} />
        <Colon />
        <Block value={minutes} label={t('timer.minutes')} />
        <Colon />
        <Block value={seconds} label={t('timer.seconds')} />
      </div>
      <DeadlineNote past={false} />
    </div>
  );
}
