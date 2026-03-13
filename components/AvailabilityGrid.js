import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../lib/useTranslation';

const START_HOUR = 7;
const END_HOUR = 23; // slots: 7:00–22:00 (16 slots)
const ALL_HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

// Fixed colors — identical in light & dark mode
const DARK_BG = '#0f172a';      // slate-900: empty / blocked slots (black)
const OPEN_BG = '#ffffff';      // white: organizer-allowed, no one picked yet

// Heat gradient when organizer set allowed slots: white → blue-500
// (allowed slots stay light/white-based so they stay visually distinct from blocked black)
function heatColorOnWhite(intensity) {
  const r = Math.round(255 + (59  - 255) * intensity);
  const g = Math.round(255 + (130 - 255) * intensity);
  const b = Math.round(255 + (246 - 255) * intensity);
  return `rgb(${r},${g},${b})`;
}

// Heat gradient when no organizer restriction: blue-300 (תכלת) → blue-800 (כחול כהה)
function heatColor(intensity) {
  const r = Math.round(147 + (30  - 147) * intensity);
  const g = Math.round(197 + (64  - 197) * intensity);
  const b = Math.round(253 + (175 - 253) * intensity);
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
  const isAllowed = allowedSet ? allowedSet.has(slotStart) : true;
  const heatCount = heat[slotStart] || 0;
  const intensity = maxHeat > 0 ? heatCount / maxHeat : 0;

  // Not in organizer's allowed window → BLACK
  if (!isAllowed && allowedSet) {
    return { bg: DARK_BG, cursor: 'not-allowed' };
  }
  // Current user's selection (white for organizer, blue for participant)
  if (isSelected) {
    return { bg: selectionColor, cursor: readOnly ? 'default' : 'pointer' };
  }
  // Organizer-allowed slot with heat → white → blue-500 gradient
  // (stays light so allowed slots always read as "white" vs blocked "black")
  if (heatCount > 0 && allowedSet) {
    return { bg: heatColorOnWhite(intensity), cursor: readOnly ? 'default' : 'pointer' };
  }
  // Unrestricted slot with heat → blue-300 → blue-800 gradient
  if (heatCount > 0) {
    return { bg: heatColor(intensity), cursor: readOnly ? 'default' : 'pointer' };
  }
  // Organizer allowed this slot, no heat yet → pure WHITE
  if (isAllowed && allowedSet) {
    return { bg: OPEN_BG, cursor: readOnly ? 'default' : 'pointer' };
  }
  // No organizer restriction, empty → BLACK
  return { bg: DARK_BG, cursor: readOnly ? 'default' : 'pointer' };
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
  selectionColor = '#2563eb',   // color for the current user's selected slots
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

  const displayDays = activeDays.length > 0 ? activeDays : days;
  const displayHours = activeHours.length > 0 ? activeHours : ALL_HOURS;

  // Drag handling (mouse/stylus only — touch uses onClick)
  const isDraggingRef = useRef(false);
  const dragActionRef = useRef('select');
  const dragStartedRef = useRef(false);

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
    isDraggingRef.current = true;
    dragActionRef.current = selectedSlots.has(slotStart) ? 'deselect' : 'select';
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

  const isWhiteSelection = selectionColor === '#ffffff';

  const cellStyle = (slotStart) => {
    const { bg, cursor } = getCellBg(slotStart, { selectedSlots, allowedSet, heat, maxHeat, readOnly, selectionColor });
    return {
      backgroundColor: bg,
      cursor,
      border: '1px solid rgba(255,255,255,0.07)',  // subtle fixed grid-line
      height: 28,
      touchAction: 'pan-y',
      userSelect: 'none',
      transition: 'background-color 0.07s',
    };
  };

  return (
    <div>
      <p className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>{hint}</p>
      <div className="overflow-x-auto rounded-lg overflow-hidden">
        <table style={{ borderCollapse: 'collapse', width: '100%', backgroundColor: DARK_BG }}>
          <thead>
            <tr>
              <th style={{ width: 36, backgroundColor: DARK_BG }} />
              {displayDays.map((day, i) => (
                <th key={i} style={{
                  textAlign: 'center', fontSize: 11, fontWeight: 500, paddingBottom: 4,
                  minWidth: 34, color: '#94a3b8', backgroundColor: DARK_BG,
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
                  color: '#94a3b8', verticalAlign: 'middle',
                  backgroundColor: DARK_BG,
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
          <LegendDot color={selectionColor} label={t('grid.legend.selected')} bordered={isWhiteSelection} />
        )}
        {allowedSet && <LegendDot color={OPEN_BG} label={t('grid.legend.shared')} bordered />}
        {maxHeat > 0 && (
          <LegendDot
            gradient={allowedSet ? ['#ffffff', '#3b82f6'] : ['#93c5fd', '#1e40af']}
            label={t('grid.legend.others')}
            bordered={!!allowedSet}
          />
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, gradient, label, bordered }) {
  const bg = gradient
    ? `linear-gradient(to right, ${gradient[0]}, ${gradient[1]})`
    : color;
  const isGradient = !!gradient;
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-muted)' }}>
      <div style={{
        width: isGradient ? 28 : 14,
        height: 14,
        borderRadius: 3,
        background: bg,
        border: bordered ? '2px solid #94a3b8' : '1px solid rgba(0,0,0,0.15)',
        flexShrink: 0,
      }} />
      {label}
    </div>
  );
}
