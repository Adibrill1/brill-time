import { getEvent, getParticipant, replaceParticipantAvailability, updateParticipant } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method === 'POST') return submitAvailabilityHandler(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function submitAvailabilityHandler(req, res) {
  const { event_id, participant_id, slots } = req.body;

  if (!event_id || !participant_id) {
    return res.status(400).json({ error: 'event_id and participant_id are required' });
  }

  const event = await getEvent(event_id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const participant = await getParticipant(participant_id);
  if (!participant) return res.status(404).json({ error: 'Participant not found' });

  await replaceParticipantAvailability(participant_id, event_id, slots);
  await updateParticipant(participant_id, { submitted_at: Date.now() });

  return res.status(200).json({ ok: true });
}
