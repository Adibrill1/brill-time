import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../lib/useTranslation';

const START_HOUR = 7;
const END_HOUR = 23; // slots: 7:00–22:00 (16 slots)
const ALL_HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

// Cell colors — fixed, independent of light/dark mode
const OPEN_BG     = '#dbeafe';  // blue-100: organizer-allowed, nobody picked yet (shared time)
const DISABLED_BG = '#94a3b8';  // slate-400: not in organizer's window → shown at opacity 0.35

// 3-stop heat gradient: blue-periwinkle → warm gray → amber orange
// Matches the diverging heatmap palette (low = blue, mid = gray, high = orange).
// Green (selectionColor) always overrides heat for the current user's own picks.
const HEAT_STOPS = [
  [110, 135, 215],   // blue-periwinkle  (1 participant)
  [160, 148, 132],   // warm gray        (mid)
  [242, 160, 28],    // amber orange     (max participants)
];

function heatColor(intensity) {
  let r, g, b;
  if (intensity <= 0.5) {
    const t = intensity * 2;
    r = Math.round(HEAT_STOPS[0][0] + (HEAT_STOPS[1][0] - HEAT_STOPS[0][0]) * t);
    g = Math.round(HEAT_STOPS[0][1] + (HEAT_STOPS[1][1] - HEAT_STOPS[0][1]) * t);
    b = Math.round(HEAT_STOPS[0][2] + (HEAT_STOPS[1][2] - HEAT_STOPS[0][2]) * t);
  } else {
    const t = (intensity - 0.5) * 2;
    r = Math.round(HEAT_STOPS[1][0] + (HEAT_STOPS[2][0] - HEAT_STOPS[1][0]) * t);
    g = Math.round(HEAT_STOPS[1][1] + (HEAT_STOPS[2][1] - HEAT_STOPS[1][1]) * t);
    b = Math.round(HEAT_STOPS[1][2] + (HEAT_STOPS[2][2] - HEAT_STOPS[1][2]) * t);
  }
  return `rgb(${r},${g},${b})`;
}

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

function getCellBg(slotStart, { selectedSlots, allowedSet, heat, maxHeat, readOnly, selectionColor }) {
  const isSelected = selectedSlots.has(slotStart);
  const isAllowed  = allowedSet ? allowedSet.has(slotStart) : true;
  const heatCount  = heat[slotStart] || 0;
  const intensity  = maxHeat > 0 ? heatCount / maxHeat : 0;

  // Disabled: not in organizer's allowed window → dimmed (opacity applied in cellStyle)
  if (!isAllowed && allowedSet) {
    return { bg: DISABLED_BG, cursor: 'not-allowed', opacity: 0.35 };
  }
  // Current user's own pick → GREEN (always overrides everything else)
  if (isSelected) {
    return { bg: selectionColor, cursor: readOnly ? 'default' : 'pointer' };
  }
  // Others have picked this slot → blue heat gradient (light = few, dark = many)
  if (heatCount > 0) {
    return { bg: heatColor(intensity), cursor: readOnly ? 'default' : 'pointer' };
  }
  // Organizer allowed this slot, nobody picked yet → light blue (shared time)
  if (isAllowed && allowedSet) {
    return { bg: OPEN_BG, cursor: readOnly ? 'default' : 'pointer' };
  }
  // No organizer restriction, empty → transparent (shows card background)
  return { bg: 'transparent', cursor: readOnly ? 'default' : 'pointer' };
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
  selectionColor = '#22c55e',   // green while picking
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

  const displayDays  = activeDays.length  > 0 ? activeDays  : days;
  const displayHours = activeHours.length > 0 ? activeHours : ALL_HOURS;

  // Drag handling (mouse/stylus only — touch uses onClick)
  const isDraggingRef    = useRef(false);
  const dragActionRef    = useRef('select');
  const dragStartedRef   = useRef(false);

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
    if (e.pointerType === 'touch') { dragStartedRef.current = false; return; }
    e.preventDefault();
    dragStartedRef.current = true;
    isDraggingRef.current  = true;
    dragActionRef.current  = selectedSlots.has(slotStart) ? 'deselect' : 'select';
    applyDrag(slotStart);
  }, [readOnly, allowedSet, selectedSlots, applyDrag]);

  const handlePointerEnter = useCallback((slotStart) => {
    if (!isDraggingRef.current || readOnly) return;
    applyDrag(slotStart);
  }, [readOnly, applyDrag]);

  const handleClick = useCallback((slotStart) => {
    if (readOnly || dragStartedRef.current) return;
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
    const { bg, cursor, opacity } = getCellBg(slotStart, { selectedSlots, allowedSet, heat, maxHeat, readOnly, selectionColor });
    return {
      backgroundColor: bg,
      cursor,
      opacity: opacity ?? 1,
      border: '1px solid rgba(0,0,0,0.08)',
      height: 28,
      touchAction: 'pan-y',
      userSelect: 'none',
      transition: 'background-color 0.07s',
    };
  };

  const labelStyle = { color: '#94a3b8', backgroundColor: 'transparent' };

  return (
    <div>
      <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>{hint}</p>
      <div className="overflow-x-auto rounded-lg overflow-hidden">
        <table style={{ borderCollapse: 'collapse', width: '100%', backgroundColor: 'transparent' }}>
          <thead>
            <tr>
              <th style={{ width: 36, ...labelStyle }} />
              {displayDays.map((day, i) => (
                <th key={i} style={{
                  textAlign: 'center', fontSize: 11, fontWeight: 500, paddingBottom: 4,
                  minWidth: 34, ...labelStyle,
                }}>
                  <div>{dayNames[day.getDay()]}</div>
                  <div>{day.getDate()}/{day.getMonth() + 1}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayHours.map(hour => (
              <tr key={hour}>
                <td style={{
                  fontSize: 11, paddingLeft: 0, paddingRight: 6,
                  textAlign: 'right', whiteSpace: 'nowrap',
                  verticalAlign: 'middle', ...labelStyle,
                }}>
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
        {!readOnly && (
          <LegendDot color={selectionColor} label={t('grid.legend.selected')} />
        )}
        {allowedSet && (
          <LegendDot color={OPEN_BG} label={t('grid.legend.shared')} bordered />
        )}
        {maxHeat > 0 && (
          <LegendDot
            gradient={HEAT_STOPS.map(([r, g, b]) => `rgb(${r},${g},${b})`)}
            label={t('grid.legend.others')}
          />
        )}
        {allowedSet && (
          <LegendDot color={DISABLED_BG} label={t('grid.legend.unavailable')} dotOpacity={0.35} />
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, gradient, label, bordered, dotOpacity }) {
  const bg = gradient
    ? `linear-gradient(to right, ${gradient.join(', ')})`
    : color;
  const isGradient = !!gradient;
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-muted)' }}>
      <div style={{
        width: isGradient ? 28 : 14,
        height: 14,
        borderRadius: 3,
        background: bg,
        border: bordered ? '1px solid #93c5fd' : '1px solid rgba(0,0,0,0.12)',
        opacity: dotOpacity ?? 1,
        flexShrink: 0,
      }} />
      {label}
    </div>
  );
}
