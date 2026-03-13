import { readDb, writeDb } from '../../../lib/db';

export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') return getParticipant(req, res, id);
  if (req.method === 'POST') return confirmParticipant(req, res, id);
  return res.status(405).json({ error: 'Method not allowed' });
}

function getParticipant(req, res, id) {
  const db = readDb();
  const p = db.participants[id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  return res.status(200).json({ participant: p });
}

function confirmParticipant(req, res, id) {
  const db = readDb();
  if (!db.participants[id]) return res.status(404).json({ error: 'Not found' });
  db.participants[id].has_confirmed = true;
  writeDb(db);
  return res.status(200).json({ ok: true });
}
