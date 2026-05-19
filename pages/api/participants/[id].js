import { getParticipant, updateParticipant } from '../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') return getParticipantHandler(req, res, id);
  if (req.method === 'POST') return confirmParticipantHandler(req, res, id);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getParticipantHandler(req, res, id) {
  try {
    const p = await getParticipant(id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({
      participant: {
        id: p.id,
        event_id: p.event_id,
        name: p.name,
        is_organizer: !!p.is_organizer,
        is_vip: !!p.is_vip,
        has_confirmed: !!p.has_confirmed,
        submitted_at: p.submitted_at,
      },
    });
  } catch (e) {
    console.error('getParticipant error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function confirmParticipantHandler(req, res, id) {
  try {
    const p = await getParticipant(id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    await updateParticipant(id, { has_confirmed: true });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('confirmParticipant error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
