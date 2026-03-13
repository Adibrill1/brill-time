import { readDb, writeDb } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export default function handler(req, res) {
  if (req.method === 'POST') return createEvent(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

function createEvent(req, res) {
  const { name, organizer_name, deadline_hours, deadline_at, min_participants } = req.body;

  if (!name || !organizer_name) {
    return res.status(400).json({ error: 'Name and organizer name are required' });
  }

  const db = readDb();
  const now = Date.now();

  const event_id = uuidv4().replace(/-/g, '').substring(0, 10);
  const participant_id = uuidv4().replace(/-/g, '').substring(0, 12);

  const deadlineAt = deadline_at
    ? Number(deadline_at)
    : now + (Number(deadline_hours) || 24) * 3600 * 1000;

  db.events[event_id] = {
    id: event_id,
    name,
    organizer_name,
    deadline_at: deadlineAt,
    min_participants: Number(min_participants) || 2,
    status: 'open',
    winning_slot_start: null,
    winning_slot_end: null,
    created_at: now,
  };

  db.participants[participant_id] = {
    id: participant_id,
    event_id,
    name: organizer_name,
    is_organizer: true,
    is_vip: true,
    has_confirmed: false,
    submitted_at: null,
    created_at: now,
  };

  writeDb(db);

  return res.status(201).json({
    event_id,
    participants: [
      {
        id: participant_id,
        name: organizer_name,
        is_organizer: true,
        is_vip: true,
      },
    ],
  });
}
