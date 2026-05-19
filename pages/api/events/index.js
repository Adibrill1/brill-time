import { createEvent, createParticipant } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method === 'POST') return createEventHandler(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function createEventHandler(req, res) {
  const { name, organizer_name, deadline_hours, deadline_at, min_participants } = req.body;

  if (!name?.trim() || !organizer_name?.trim()) {
    return res.status(400).json({ error: 'Name and organizer name are required' });
  }
  if (name.trim().length > 200) {
    return res.status(400).json({ error: 'Event name must be 200 characters or fewer' });
  }
  if (organizer_name.trim().length > 100) {
    return res.status(400).json({ error: 'Organizer name must be 100 characters or fewer' });
  }

  const minP = Number(min_participants);
  if (!Number.isInteger(minP) || minP < 1 || minP > 100) {
    return res.status(400).json({ error: 'min_participants must be an integer between 1 and 100' });
  }

  try {
  const now = Date.now();
  const event_id = uuidv4().replace(/-/g, '').substring(0, 10);
  const participant_id = uuidv4().replace(/-/g, '').substring(0, 12);
  const deadlineAt = deadline_at
    ? Number(deadline_at)
    : now + (Number(deadline_hours) || 24) * 3600 * 1000;

  if (deadlineAt <= now) {
    return res.status(400).json({ error: 'Deadline must be in the future' });
  }

  console.log('[createEvent] attempting insert, event_id:', event_id, 'supabaseUrl:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING', 'serviceKey:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING');
  await createEvent({
    id: event_id,
    name: name.trim(),
    organizer_name: organizer_name.trim(),
    deadline_at: deadlineAt,
    min_participants: minP,
    status: 'open',
    winning_slot_start: null,
    winning_slot_end: null,
    created_at: now,
  });

  await createParticipant({
    id: participant_id,
    event_id,
    name: organizer_name.trim(),
    is_organizer: true,
    is_vip: true,
    has_confirmed: false,
    submitted_at: null,
    created_at: now,
  });

  console.log('[createEvent] success, event_id:', event_id);
  return res.status(201).json({
    event_id,
    participants: [{ id: participant_id, name: organizer_name.trim(), is_organizer: true, is_vip: true }],
  });
  } catch (e) {
    console.error('[createEvent] error:', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
