/**
 * Finds the best winning slot given participant availability.
 *
 * @param {Array} participants - all participants for this event
 * @param {Object} availabilityMap - { participantId: [{slot_start, slot_end}] }
 * @param {number} minParticipants - minimum needed for event to happen
 * @param {Array|null} slotRestriction - organizer's allowed slots [{slot_start, slot_end}], or null
 * @returns {{ slot_start, slot_end, count, cancelled }}
 */
export function findWinningSlot(participants, availabilityMap, minParticipants, slotRestriction) {
  // Tally counts per unique slot_start (exclude organizer)
  const slotCounts = {};

  for (const [participantId, slots] of Object.entries(availabilityMap)) {
    const participant = participants.find(p => p.id === participantId);
    if (!participant || participant.is_organizer) continue;

    for (const slot of slots) {
      const key = slot.slot_start;
      if (!slotCounts[key]) {
        slotCounts[key] = { slot_start: slot.slot_start, slot_end: slot.slot_end, count: 0 };
      }
      slotCounts[key].count += 1;
    }
  }

  let validSlots = Object.values(slotCounts);

  // Apply organizer restriction by hour-of-day (robust against date mismatches
  // when organizer and participants access the grid on different days)
  if (slotRestriction && slotRestriction.length > 0) {
    const allowedHours = new Set(slotRestriction.map(r => new Date(r.slot_start).getHours()));
    const restricted = validSlots.filter(slot => allowedHours.has(new Date(slot.slot_start).getHours()));
    // Only apply restriction if it doesn't eliminate all slots (safety fallback)
    if (restricted.length > 0) validSlots = restricted;
  }

  if (validSlots.length === 0) {
    return { cancelled: true, slot_start: null, slot_end: null, count: 0 };
  }

  // Best = highest count, earliest time as tiebreaker
  validSlots.sort((a, b) => b.count - a.count || a.slot_start - b.slot_start);
  const best = validSlots[0];

  if (best.count < minParticipants) {
    return { cancelled: true, slot_start: null, slot_end: null, count: best.count };
  }

  return {
    cancelled: false,
    slot_start: best.slot_start,
    slot_end: best.slot_end,
    count: best.count,
  };
}
