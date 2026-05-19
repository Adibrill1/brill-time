import { getEvent, updateEvent, getParticipantsByEvent, getAvailabilityByEvent } from '../../../lib/db';
import { findWinningSlot } from '../../../lib/algorithm';

export default async function handler(req, res) {
  const { id, action } = req.query;
  if (req.method === 'GET') return getEventHandler(req, res, id);
  if (req.method === 'POST' && action === 'decide') return decideEventHandler(req, res, id);
  return res.status(405).json({ error: 'Method not allowed' });
}

function buildAvailabilityMap(availability) {
  const map = {};
  for (const slot of availability) {
    if (!map[slot.participant_id]) map[slot.participant_id] = [];
    map[slot.participant_id].push(slot);
  }
  return map;
}

function getOrganizerRestriction(participants, availabilityMap) {
  const organizer = participants.find(p => p.is_organizer);
  const slots = organizer
    ? (availabilityMap[organizer.id] || []).map(s => ({ slot_start: s.slot_start, slot_end: s.slot_end }))
    : [];
  return { organizerSlots: slots, slotRestriction: slots.length > 0 ? slots : null };
}

async function getEventHandler(req, res, id) {
  try {
    const event = await getEvent(id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const [participants, availability] = await Promise.all([
      getParticipantsByEvent(id),
      getAvailabilityByEvent(id),
    ]);

    const availabilityMap = buildAvailabilityMap(availability);
    const { organizerSlots, slotRestriction } = getOrganizerRestriction(participants, availabilityMap);

    if (event.status === 'open' && Date.now() > event.deadline_at) {
      const winning = findWinningSlot(participants, availabilityMap, event.min_participants || 1, slotRestriction);
      const newStatus = (winning && !winning.cancelled) ? 'decided' : 'cancelled';
      await updateEvent(id, {
        status: newStatus,
        winning_slot_start: winning?.slot_start ?? null,
        winning_slot_end: winning?.slot_end ?? null,
      });
      event.status = newStatus;
      event.winning_slot_start = winning?.slot_start ?? null;
      event.winning_slot_end = winning?.slot_end ?? null;
    }

    return res.status(200).json({
      event,
      phase: 'participant_phase',
      organizer_slots: organizerSlots,
      participants: participants.map(p => ({
        id: p.id, name: p.name, is_vip: !!p.is_vip, is_organizer: !!p.is_organizer,
        has_confirmed: !!p.has_confirmed, submitted_at: p.submitted_at,
      })),
      availability: availabilityMap,
    });
  } catch (e) {
    console.error('getEvent error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function decideEventHandler(req, res, id) {
  try {
    const event = await getEvent(id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.status !== 'open') {
      return res.status(200).json({ status: event.status, winning_slot_start: event.winning_slot_start, winning_slot_end: event.winning_slot_end });
    }

    const [participants, availability] = await Promise.all([
      getParticipantsByEvent(id),
      getAvailabilityByEvent(id),
    ]);

    const availabilityMap = buildAvailabilityMap(availability);
    const { slotRestriction } = getOrganizerRestriction(participants, availabilityMap);

    const winning = findWinningSlot(participants, availabilityMap, event.min_participants || 1, slotRestriction);
    if (!winning) return res.status(400).json({ error: 'No availability submitted yet' });

    const newStatus = winning.cancelled ? 'cancelled' : 'decided';
    await updateEvent(id, {
      status: newStatus,
      winning_slot_start: winning.slot_start,
      winning_slot_end: winning.slot_end,
    });

    return res.status(200).json({ winning });
  } catch (e) {
    console.error('decideEvent error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
