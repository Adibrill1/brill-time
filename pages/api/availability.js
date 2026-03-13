import { readDb, writeDb } from '../../lib/db';

export default function handler(req, res) {
  if (req.method === 'POST') return submitAvailability(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

function submitAvailability(req, res) {
  const { event_id, participant_id, slots } = req.body;

  if (!event_id || !participant_id) {
    return res.status(400).json({ error: 'event_id and participant_id are required' });
  }

  const db = readDb();
  const event = db.events[event_id];
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const participant = db.participants[participant_id];
  if (!participant) return res.status(404).json({ error: 'Participant not found' });

  // Replace existing availability for this participant
  db.availability = db.availability.filter(a => a.participant_id !== participant_id);

  for (const slot of slots || []) {
    db.availability.push({
      event_id,
      participant_id,
      slot_start: slot.slot_start,
      slot_end: slot.slot_end,
    });
  }

  db.participants[participant_id].submitted_at = Date.now();
  writeDb(db);

  return res.status(200).json({ ok: true });
}
