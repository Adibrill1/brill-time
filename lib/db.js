import { supabase } from './supabase';

// Events
export async function getEvent(id) {
  const { data } = await supabase.from('events').select('*').eq('id', id).single();
  return data;
}

export async function createEvent(event) {
  await supabase.from('events').insert(event);
}

export async function updateEvent(id, fields) {
  await supabase.from('events').update(fields).eq('id', id);
}

// Participants
export async function getParticipantsByEvent(event_id) {
  const { data } = await supabase.from('participants').select('*').eq('event_id', event_id);
  return data || [];
}

export async function getParticipant(id) {
  const { data } = await supabase.from('participants').select('*').eq('id', id).single();
  return data;
}

export async function createParticipant(participant) {
  await supabase.from('participants').insert(participant);
}

export async function updateParticipant(id, fields) {
  await supabase.from('participants').update(fields).eq('id', id);
}

// Availability
export async function getAvailabilityByEvent(event_id) {
  const { data } = await supabase.from('availability').select('*').eq('event_id', event_id);
  return data || [];
}

export async function replaceParticipantAvailability(participant_id, event_id, slots) {
  await supabase.from('availability').delete().eq('participant_id', participant_id);
  if (slots && slots.length > 0) {
    await supabase.from('availability').insert(
      slots.map(s => ({ event_id, participant_id, slot_start: s.slot_start, slot_end: s.slot_end }))
    );
  }
}
