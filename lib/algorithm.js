/**
 * Finds the best winning slot given participant availability.
 *
 * @param {Array} participants - all participants for this event
 * @param {Object} availabilityMap - { participantId: [{slot_start, slot_end}] }
 * @param {number} minParticipants - minimum needed for event to happen
 * @param {Array|null} slotRestriction - organizer's allowed slots [{slot_start, slot_end}], or null for no restriction
 * @returns {{ slot_start, slot_end, count, cancelled }}
 */
export function findWinningSlot(participants, availabilityMap, minParticipants, slotRestriction) {
  // Non-organizer participants who submitted availability
  const voters = participants.filter(p => !p.is_organizer);

  // Tally counts per unique slot_start
  const slotCounts = {};

  for (const [participantId, slots] of Object.entries(availabilityMap)) {
    const participant = participants.find(p => p.id === participantId);
    if (!participant || participant.is_organizer) continue;

    for (const slot of slots) {
      const key = slot.slot_start;
      if (!slotCounts[key]) {
        slotCounts[key] = { slot_start: slot.slot_start, slot_end: slot.slot_end, count: 0, participantIds: [] };
      }
      slotCounts[key].count += 1;
      slotCounts[key].participantIds.push(participantId);
    }
  }

  let validSlots = Object.values(slotCounts);

  // Filter by organizer slot restriction
  if (slotRestriction && slotRestriction.length > 0) {
    validSlots = validSlots.filter(slot =>
      slotRestriction.some(r => r.slot_start <= slot.slot_start && slot.slot_end <= r.slot_end + 1)
    );
  }

  if (validSlots.length === 0) {
    return { cancelled: true, slot_start: null, slot_end: null, count: 0 };
  }

  // Find slot with highest count, breaking ties by earliest time
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
