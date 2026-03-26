import { getParticipant, updateParticipant } from '../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') return getParticipantHandler(req, res, id);
  if (req.method === 'POST') return confirmParticipantHandler(req, res, id);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function getParticipantHandler(req, res, id) {
  const p = await getParticipant(id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  return res.status(200).json({ participant: p });
}

async function confirmParticipantHandler(req, res, id) {
  const p = await getParticipant(id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  await updateParticipant(id, { has_confirmed: true });
  return res.status(200).json({ ok: true });
}
