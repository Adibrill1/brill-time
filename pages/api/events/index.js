import { createEvent, createParticipant } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method === 'POST') return createEventHandler(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function createEventHandler(req, res) {
  const { name, organizer_name, deadline_hours, deadline_at, min_participants } = req.body;

  if (!name || !organizer_name) {
    return res.status(400).json({ error: 'Name and organizer name are required' });
  }

  const now = Date.now();
  const event_id = uuidv4().replace(/-/g, '').substring(0, 10);
  const participant_id = uuidv4().replace(/-/g, '').substring(0, 12);
  const deadlineAt = deadline_at
    ? Number(deadline_at)
    : now + (Number(deadline_hours) || 24) * 3600 * 1000;

  await createEvent({
    id: event_id,
    name,
    organizer_name,
    deadline_at: deadlineAt,
    min_participants: Number(min_participants) || 2,
    status: 'open',
    winning_slot_start: null,
    winning_slot_end: null,
    created_at: now,
  });

  await createParticipant({
    id: participant_id,
    event_id,
    name: organizer_name,
    is_organizer: true,
    is_vip: true,
    has_confirmed: false,
    submitted_at: null,
    created_at: now,
  });

  return res.status(201).json({
    event_id,
    participants: [{ id: participant_id, name: organizer_name, is_organizer: true, is_vip: true }],
  });
}
