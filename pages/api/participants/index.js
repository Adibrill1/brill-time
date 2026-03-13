import { readDb, writeDb } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export default function handler(req, res) {
  if (req.method === 'POST') return createParticipant(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

function createParticipant(req, res) {
  const { event_id, name } = req.body;

  if (!event_id || !name?.trim()) {
    return res.status(400).json({ error: 'event_id and name are required' });
  }

  const db = readDb();
  const event = db.events[event_id];
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.status !== 'open') return res.status(400).json({ error: 'Event is closed' });

  const participant_id = uuidv4().replace(/-/g, '').substring(0, 12);

  db.participants[participant_id] = {
    id: participant_id,
    event_id,
    name: name.trim(),
    is_organizer: false,
    is_vip: false,
    has_confirmed: false,
    submitted_at: null,
    created_at: Date.now(),
  };

  writeDb(db);

  return res.status(201).json({ participant_id });
}
