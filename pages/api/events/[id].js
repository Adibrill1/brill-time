import { readDb, writeDb } from '../../../lib/db';
import { findWinningSlot } from '../../../lib/algorithm';

export default function handler(req, res) {
  const { id, action } = req.query;
  if (req.method === 'GET') return getEvent(req, res, id);
  if (req.method === 'POST' && action === 'decide') return decideEvent(req, res, id);
  return res.status(405).json({ error: 'Method not allowed' });
}

function getEvent(req, res, id) {
  const db = readDb();
  const event = db.events[id];
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const participants = Object.values(db.participants).filter(p => p.event_id === id);
  const availability = db.availability.filter(a => a.event_id === id);
  const availabilityMap = {};
  for (const slot of availability) {
    if (!availabilityMap[slot.participant_id]) availabilityMap[slot.participant_id] = [];
    availabilityMap[slot.participant_id].push(slot);
  }

  const organizerParticipant = participants.find(p => p.is_organizer);
  const organizerSlots = organizerParticipant
    ? (availabilityMap[organizerParticipant.id] || []).map(s => ({ slot_start: s.slot_start, slot_end: s.slot_end }))
    : [];
  const slotRestriction = organizerSlots.length > 0 ? organizerSlots : null;

  // Auto-decide if deadline passed — always resolve to decided or cancelled
  if (event.status === 'open' && Date.now() > event.deadline_at) {
    const winning = findWinningSlot(participants, availabilityMap, event.min_participants || 1, slotRestriction);
    const newStatus = (winning && !winning.cancelled) ? 'decided' : 'cancelled';
    db.events[id].status = newStatus;
    db.events[id].winning_slot_start = winning?.slot_start ?? null;
    db.events[id].winning_slot_end = winning?.slot_end ?? null;
    writeDb(db);
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
}

function decideEvent(req, res, id) {
  const db = readDb();
  const event = db.events[id];
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const participants = Object.values(db.participants).filter(p => p.event_id === id);
  const availability = db.availability.filter(a => a.event_id === id);
  const availabilityMap = {};
  for (const slot of availability) {
    if (!availabilityMap[slot.participant_id]) availabilityMap[slot.participant_id] = [];
    availabilityMap[slot.participant_id].push(slot);
  }

  const organizerParticipant = participants.find(p => p.is_organizer);
  const organizerSlots = organizerParticipant
    ? (availabilityMap[organizerParticipant.id] || []).map(s => ({ slot_start: s.slot_start, slot_end: s.slot_end }))
    : [];
  const slotRestriction = organizerSlots.length > 0 ? organizerSlots : null;

  const winning = findWinningSlot(participants, availabilityMap, event.min_participants || 1, slotRestriction);
  if (!winning) return res.status(400).json({ error: 'No availability submitted yet' });

  const newStatus = winning.cancelled ? 'cancelled' : 'decided';
  db.events[id].status = newStatus;
  db.events[id].winning_slot_start = winning.slot_start;
  db.events[id].winning_slot_end = winning.slot_end;
  writeDb(db);

  return res.status(200).json({ winning });
}
