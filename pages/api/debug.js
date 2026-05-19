import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const checks = {};

  checks.env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
  };

  try {
    const { data, error } = await supabase.from('events').select('id').limit(1);
    checks.selectEvents = error ? { error: error.message, code: error.code } : { ok: true, rowCount: data?.length ?? 0 };
  } catch (e) {
    checks.selectEvents = { threw: e.message };
  }

  try {
    const testId = '__debug_test__';
    const { error } = await supabase.from('events').insert({
      id: testId,
      name: 'debug-test',
      organizer_name: 'debug',
      deadline_at: Date.now() + 3600000,
      min_participants: 1,
      status: 'open',
      winning_slot_start: null,
      winning_slot_end: null,
      created_at: Date.now(),
    });
    if (error) {
      checks.insertEvent = { error: error.message, code: error.code };
    } else {
      checks.insertEvent = { ok: true };
      await supabase.from('events').delete().eq('id', testId);
    }
  } catch (e) {
    checks.insertEvent = { threw: e.message };
  }

  return res.status(200).json(checks);
}
