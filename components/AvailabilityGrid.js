import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../lib/useTranslation';

const START_HOUR = 7;
const END_HOUR = 23; // slots: 7:00–22:00 (16 slots)
const ALL_HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function getSlotStart(day, hour) {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function buildAllowedSet(days, allowedSlots) {
  if (!allowedSlots || allowedSlots.length === 0) return null;
  const set = new Set();
  for (const day of days) {
    for (const hour of ALL_HOURS) {
      const slotStart = getSlotStart(day, hour);
      const slotEnd = slotStart + 3600000;
      for (const allowed of allowedSlots) {
        if (allowed.slot_start <= slotStart && slotEnd <= allowed.slot_end + 1) {
          set.add(slotStart);
          break;
        }
      }
    }
  }
  return set;
}

function buildHeatmap(existingAvailability, currentParticipantId) {
  const heat = {};
  let maxHeat = 0;
  for (const [pid, slots] of Object.entries(existingAvailability || {})) {
    if (pid === currentParticipantId) continue;
    for (const slot of slots) {
      heat[slot.slot_start] = (heat[slot.slot_start] || 0) + 1;
      if (heat[slot.slot_start] > maxHeat) maxHeat = heat[slot.slot_start];
    }
  }
  return { heat, maxHeat };
}

function getCellBg(slotStart, { selectedSlots, allowedSet, heat, maxHeat, readOnly }) {
  const isSelected = selectedSlots.has(slotStart);
  const isAllowed = allowedSet ? allowedSet.has(slotStart) : true;
  const heatCount = heat[slotStart] || 0;
  const intensity = maxHeat > 0 ? heatCount / maxHeat : 0;

  if (!isAllowed && allowedSet) {
    return { bg: 'var(--color-grid-blocked)', cursor: readOnly ? 'default' : 'not-allowed', opacity: 1 };
  }
  if (isSelected) {
    return { bg: '#2563eb', cursor: readOnly ? 'default' : 'pointer', opacity: 1 };
  }
  if (heatCount > 0) {
    // Gradient from light sky blue (low) to deep blue (high)
    const alpha = 0.2 + intensity * 0.75;
    return { bg: `rgba(37,99,235,${alpha.toFixed(2)})`, cursor: readOnly ? 'default' : 'pointer', opacity: 1 };
  }
  if (isAllowed && allowedSet) {
    // Allowed slots with no heat: use card background (neutral, not tinted)
    return { bg: 'var(--color-card)', cursor: readOnly ? 'default' : 'pointer', opacity: 1 };
  }
  return { bg: 'var(--color-grid-empty)', cursor: readOnly ? 'default' : 'pointer', opacity: 1 };
}

export default function AvailabilityGrid({
  selectedSlots = new Set(),
  onSlotsChange,
  allowedSlots = null,          // [{slot_start, slot_end}] from organizer, or null
  existingAvailability = {},    // {participantId: [{slot_start, slot_end}]}
  currentParticipantId = null,
  readOnly = false,
  startDate,                    // Date object (midnight)
  numDays = 7,
  filterDisplayDays = false,
  filterDisplayHours = false,
}) {
  const { t } = useTranslation();

  const base = startDate ? new Date(startDate) : new Date();
  base.setHours(0, 0, 0, 0);

  const days = Array.from({ length: numDays }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return d;
  });

  const allowedSet = buildAllowedSet(days, allowedSlots);
  const { heat, maxHeat } = buildHeatmap(existingAvailability, currentParticipantId);

  // Lean mode filtering
  const hasActivity = (day, hour) => {
    const s = getSlotStart(day, hour);
    return selectedSlots.has(s) || heat[s] || (allowedSet && allowedSet.has(s));
  };

  const activeDays = filterDisplayDays
    ? days.filter(d => ALL_HOURS.some(h => hasActivity(d, h)))
    : days;
  const activeHours = filterDisplayHours
    ? ALL_HOURS.filter(h => days.some(d => hasActivity(d, h)))
    : ALL_HOURS;

  // Show all days/hours if lean mode would produce empty grid
  const displayDays = activeDays.length > 0 ? activeDays : days;
  const displayHours = activeHours.length > 0 ? activeHours : ALL_HOURS;

  // Drag handling (mouse/stylus only — touch uses onClick)
  const isDraggingRef = useRef(false);
  const dragActionRef = useRef('select');
  const dragStartedRef = useRef(false); // true when mouse drag is active (skip onClick)

  const applyDrag = useCallback((slotStart) => {
    const isAllowed = allowedSet ? allowedSet.has(slotStart) : true;
    if (!isAllowed) return;
    const next = new Set(selectedSlots);
    if (dragActionRef.current === 'select') next.add(slotStart);
    else next.delete(slotStart);
    onSlotsChange?.(next);
  }, [selectedSlots, allowedSet, onSlotsChange]);

  const handlePointerDown = useCallback((slotStart, e) => {
    if (readOnly) return;
    const isAllowed = allowedSet ? allowedSet.has(slotStart) : true;
    if (!isAllowed) return;

    // Touch: skip drag — let scroll work naturally, handle selection via onClick
    if (e.pointerType === 'touch') {
      dragStartedRef.current = false;
      return;
    }

    e.preventDefault();
    dragStartedRef.current = true;
    isDraggingRef.current = true;
    dragActionRef.current = selectedSlots.has(slotStart) ? 'deselect' : 'select';
    applyDrag(slotStart);
  }, [readOnly, allowedSet, selectedSlots, applyDrag]);

  const handlePointerEnter = useCallback((slotStart) => {
    if (!isDraggingRef.current || readOnly) return;
    applyDrag(slotStart);
  }, [readOnly, applyDrag]);

  // Touch tap handler: toggle cell on tap (drag skipped for touch)
  const handleClick = useCallback((slotStart) => {
    if (readOnly || dragStartedRef.current) return; // skip if mouse drag already handled it
    const isAllowed = allowedSet ? allowedSet.has(slotStart) : true;
    if (!isAllowed) return;
    const next = new Set(selectedSlots);
    if (next.has(slotStart)) next.delete(slotStart);
    else next.add(slotStart);
    onSlotsChange?.(next);
  }, [readOnly, allowedSet, selectedSlots, onSlotsChange]);

  useEffect(() => {
    const up = () => { isDraggingRef.current = false; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const dayNames = t('common.days');
  const hint = allowedSet
    ? t('grid.hint.vip')
    : maxHeat > 0
      ? t('grid.hint.heatmap')
      : t('grid.hint.plain');

  const cellStyle = (slotStart) => {
    const { bg, cursor } = getCellBg(slotStart, { selectedSlots, allowedSet, heat, maxHeat, readOnly });
    return {
      backgroundColor: bg,
      cursor,
      border: '1px solid var(--color-border)',
      height: 28,
      touchAction: 'pan-y', // allow vertical page scrolling on touch
      userSelect: 'none',
      transition: 'background-color 0.07s',
    };
  };

  return (
    <div>
      <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>{hint}</p>
      <div className="overflow-x-auto">
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              {displayDays.map((day, i) => (
                <th key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, paddingBottom: 4, minWidth: 34, color: 'var(--color-muted)' }}>
                  <div>{dayNames[day.getDay()]}</div>
                  <div>{day.getDate()}/{day.getMonth() + 1}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayHours.map(hour => (
              <tr key={hour}>
                <td style={{ fontSize: 11, paddingLeft: 0, paddingRight: 6, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--color-muted)', verticalAlign: 'middle' }}>
                  {String(hour).padStart(2, '0')}:00
                </td>
                {displayDays.map((day, di) => {
                  const slotStart = getSlotStart(day, hour);
                  return (
                    <td
                      key={di}
                      style={cellStyle(slotStart)}
                      onPointerDown={e => handlePointerDown(slotStart, e)}
                      onPointerEnter={() => handlePointerEnter(slotStart)}
                      onClick={() => handleClick(slotStart)}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 flex-wrap">
        <LegendDot color="#2563eb" label={t('grid.legend.selected')} />
        {allowedSet && <LegendDot color="var(--color-card)" label={t('grid.legend.shared')} bordered />}
        {maxHeat > 0 && <LegendDot color="rgba(37,99,235,0.55)" label={t('grid.legend.others')} />}
      </div>
    </div>
  );
}

function LegendDot({ color, label, bordered }) {
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-muted)' }}>
      <div style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        backgroundColor: color,
        border: bordered ? '2px solid var(--color-border)' : '1px solid rgba(0,0,0,0.12)',
        flexShrink: 0,
      }} />
      {label}
    </div>
  );
}
