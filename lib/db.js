import { supabase } from './supabase';

// Events
export async function getEvent(id) {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') console.error('getEvent error:', error.code, error.message);
  return data;
}

export async function createEvent(event) {
  const { error } = await supabase.from('events').insert(event);
  if (error) throw new Error(`DB error (createEvent): ${error.message}`);
}

export async function updateEvent(id, fields) {
  const { error } = await supabase.from('events').update(fields).eq('id', id);
  if (error) throw new Error(`DB error (updateEvent): ${error.message}`);
}

// Participants
export async function getParticipantsByEvent(event_id) {
  const { data } = await supabase.from('participants').select('*').eq('event_id', event_id);
  return data || [];
}

export async function getParticipant(id) {
  const { data, error } = await supabase.from('participants').select('*').eq('id', id).single();
  if (error) {
    if (error.code !== 'PGRST116') console.error('getParticipant error:', error.message);
    return null;
  }
  return data;
}

export async function createParticipant(participant) {
  const { error } = await supabase.from('participants').insert(participant);
  if (error) throw new Error(`DB error (createParticipant): ${error.message}`);
}

export async function updateParticipant(id, fields) {
  const { error } = await supabase.from('participants').update(fields).eq('id', id);
  if (error) throw new Error(`DB error (updateParticipant): ${error.message}`);
}

// Availability
export async function getAvailabilityByEvent(event_id) {
  const { data } = await supabase.from('availability').select('*').eq('event_id', event_id);
  return data || [];
}

export async function replaceParticipantAvailability(participant_id, event_id, slots) {
  const { error: delError } = await supabase.from('availability').delete().eq('participant_id', participant_id);
  if (delError) throw new Error(`DB error (replaceParticipantAvailability delete): ${delError.message}`);
  if (slots && slots.length > 0) {
    const { error: insError } = await supabase.from('availability').insert(
      slots.map(s => ({ event_id, participant_id, slot_start: s.slot_start, slot_end: s.slot_end }))
    );
    if (insError) throw new Error(`DB error (replaceParticipantAvailability insert): ${insError.message}`);
  }
}
