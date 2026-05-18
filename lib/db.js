import { supabase } from './supabase';

function throwOnError({ data, error }, context) {
  if (error) throw new Error(`DB error (${context}): ${error.message}`);
  return data;
}

// Events
export async function getEvent(id) {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw new Error(`DB error (getEvent): ${error.message}`);
  return data;
}

export async function createEvent(event) {
  return throwOnError(await supabase.from('events').insert(event).select().single(), 'createEvent');
}

export async function updateEvent(id, fields) {
  throwOnError(await supabase.from('events').update(fields).eq('id', id), 'updateEvent');
}

// Participants
export async function getParticipantsByEvent(event_id) {
  const { data, error } = await supabase.from('participants').select('*').eq('event_id', event_id);
  if (error) throw new Error(`DB error (getParticipantsByEvent): ${error.message}`);
  return data || [];
}

export async function getParticipant(id) {
  const { data, error } = await supabase.from('participants').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw new Error(`DB error (getParticipant): ${error.message}`);
  return data;
}

export async function createParticipant(participant) {
  return throwOnError(await supabase.from('participants').insert(participant).select().single(), 'createParticipant');
}

export async function updateParticipant(id, fields) {
  throwOnError(await supabase.from('participants').update(fields).eq('id', id), 'updateParticipant');
}

// Availability
export async function getAvailabilityByEvent(event_id) {
  const { data, error } = await supabase.from('availability').select('*').eq('event_id', event_id);
  if (error) throw new Error(`DB error (getAvailabilityByEvent): ${error.message}`);
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
