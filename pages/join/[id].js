import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import Layout from '../../components/Layout';
import CountdownTimer from '../../components/CountdownTimer';
import AvailabilityGrid from '../../components/AvailabilityGrid';
import { useTranslation } from '../../lib/useTranslation';
import { findWinningSlot } from '../../lib/algorithm';

const DAYS_TO_SHOW = 7;
const POLL_INTERVAL = 5000;

function fmtSlot(slot, t) {
  const start = new Date(slot.slot_start);
  const end = new Date(slot.slot_end);
  const pad = n => String(n).padStart(2, '0');
  return t('common.slotFormat', {
    day: t('common.days')[start.getDay()],
    date: start.getDate(),
    month: start.getMonth() + 1,
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  });
}

function FinalScreen({ event, participants, availability, t }) {
  const pad = n => String(n).padStart(2, '0');
  const dayNames = t('common.days');

  if (event.status === 'cancelled') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">😔</div>
        <h2 className="text-xl font-bold mb-2">{t('join.final.cancelled')}</h2>
        <p style={{ color: 'var(--color-muted)' }}>{t('join.final.cancelledDesc')}</p>
      </div>
    );
  }

  const winStart = event.winning_slot_start ? new Date(event.winning_slot_start) : null;
  const winEnd = event.winning_slot_end ? new Date(event.winning_slot_end) : null;

  const canAttend = [];
  const cannotAttend = [];
  for (const p of participants) {
    if (p.is_organizer) continue;
    const slots = availability[p.id] || [];
    const hasSlot = winStart
      ? slots.some(s => s.slot_start <= event.winning_slot_start && s.slot_end >= event.winning_slot_end)
      : false;
    if (hasSlot) canAttend.push(p);
    else cannotAttend.push(p);
  }

  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        <div className="text-3xl mb-2">🎉</div>
        <h2 className="text-xl font-bold mb-1">{t('join.final.winner')}</h2>
        {winStart && (
          <div className="mt-3 p-4 rounded-xl" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
            <div className="text-2xl font-bold tabular-nums">
              {pad(winStart.getHours())}:{pad(winStart.getMinutes())}
              {winEnd && ` – ${pad(winEnd.getHours())}:${pad(winEnd.getMinutes())}`}
            </div>
            <div className="text-sm mt-1">
              {dayNames[winStart.getDay()]}, {winStart.getDate()}/{winStart.getMonth() + 1}
            </div>
            <div className="text-sm mt-2 font-medium">נתראה! 👋</div>
          </div>
        )}
      </div>

      {canAttend.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2">{t('join.final.canAttend')}:</div>
          <div className="flex flex-wrap gap-2">
            {canAttend.map(p => (
              <span key={p.id} className="px-2 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: '#16a34a' }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {cannotAttend.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2">{t('join.final.cannotAttend')}:</div>
          <div className="flex flex-wrap gap-2">
            {cannotAttend.map(p => (
              <span key={p.id} className="px-2 py-1 rounded-full text-xs text-white" style={{ backgroundColor: '#6b7280' }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function JoinEvent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = router.query;

  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [phase, setPhase] = useState('input'); // 'input' | 'done'
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [participantId, setParticipantId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  const [heatmapOpen, setHeatmapOpen] = useState(false);

  // Use event creation date as fixed anchor so every participant sees identical columns
  const startDate = (() => {
    const d = new Date(eventData?.event?.created_at || Date.now());
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/events/${id}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setEventData(data);
      const now = Date.now();
      setIsDeadlinePassed(now > data.event.deadline_at);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial load + restore from localStorage
  useEffect(() => {
    if (!id) return;
    const storedPid = localStorage.getItem(`brilltime_participant_${id}`);
    if (storedPid) {
      setParticipantId(storedPid);
    }
    fetchEvent();
  }, [id, fetchEvent]);

  // After event loads, pre-fill from existing data
  useEffect(() => {
    if (!eventData || !participantId) return;
    const existing = eventData.availability[participantId];
    if (existing && existing.length > 0) {
      setSelectedSlots(new Set(existing.map(s => s.slot_start)));
      setPhase('done');
    }
    const p = eventData.participants.find(p => p.id === participantId);
    if (p && p.name) setName(p.name);
  }, [eventData, participantId]);

  // Poll while on the done screen and event is still open:
  // picks up new submissions from other participants and auto-transitions when decided/cancelled
  useEffect(() => {
    if (!eventData || eventData.event.status !== 'open' || phase !== 'done') return;
    const interval = setInterval(fetchEvent, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [eventData, phase, fetchEvent]);

  const handleTimerExpire = useCallback(async () => {
    if (!id) return;
    setIsDeadlinePassed(true);
    try {
      await fetch(`/api/events/${id}?action=decide`, { method: 'POST' });
    } catch {}
    window.location.reload();
  }, [id]);

  const doSubmit = async (slotsSet) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      let pid = participantId;
      if (!pid) {
        const res = await fetch('/api/participants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: id, name: name.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error creating participant');
        pid = data.participant_id;
        setParticipantId(pid);
        localStorage.setItem(`brilltime_participant_${id}`, pid);
      }

      const slots = Array.from(slotsSet).map(start => ({
        slot_start: start,
        slot_end: start + 3600000,
      }));

      const res2 = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: id, participant_id: pid, slots }),
      });
      if (!res2.ok) throw new Error('Error saving availability');

      await fetchEvent();
      setPhase('done');
      setIsEditing(false);
    } catch (e) {
      setSubmitError(e.message || t('join.saveError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) { setNameError(t('join.nameError')); return; }
    setNameError('');
    doSubmit(selectedSlots);
  };

  const handleUnavailable = () => {
    if (!name.trim()) { setNameError(t('join.nameError')); return; }
    setNameError('');
    doSubmit(new Set());
  };

  if (loading) {
    return <Layout><div className="text-center py-12">{t('common.loading')}</div></Layout>;
  }
  if (!eventData) {
    return <Layout><div className="text-center py-12">{t('join.notFound')}</div></Layout>;
  }

  const { event, participants, availability, organizer_slots } = eventData;
  const isPending = isDeadlinePassed && !event.winning_slot_start && event.status === 'open';
  // Exclude the organizer from heat so their allowed slots stay white, not blue
  const organizerParticipantId = participants.find(p => p.is_organizer)?.id ?? null;

  const cardStyle = { backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' };

  // Final state
  if (event.status === 'decided' || event.status === 'cancelled') {
    return (
      <Layout title={event.name}>
        <div className="mb-6">
          <h1 className="text-xl font-bold">{event.name}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            {t('join.organizedBy', { name: event.organizer_name })}
          </p>
        </div>
        <FinalScreen event={event} participants={participants} availability={availability} t={t} />
      </Layout>
    );
  }

  // Participant count for "done" screen
  const nonOrgParticipants = participants.filter(p => !p.is_organizer);
  const submitted = nonOrgParticipants.filter(p => availability[p.id]);
  const total = submitted.length;
  const minNeeded = event.min_participants || 2;
  const stillNeeded = Math.max(0, minNeeded - total);

  // Compute the current leading slot (best candidate right now, before deadline)
  const leadingSlot = (!isDeadlinePassed && stillNeeded === 0)
    ? findWinningSlot(participants, availability, minNeeded, organizer_slots?.length > 0 ? organizer_slots : null)
    : null;

  // Done screen
  if (phase === 'done' && !isEditing) {
    return (
      <Layout title={event.name}>
        <div className="mb-4">
          <h1 className="text-xl font-bold">{event.name}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            {t('join.organizedBy', { name: event.organizer_name })}
          </p>
        </div>

        <div className="mb-4">
          <CountdownTimer
            deadlineAt={event.deadline_at}
            onExpire={handleTimerExpire}
            winningSlotStart={event.winning_slot_start}
            winningSlotEnd={event.winning_slot_end}
            isPending={isPending}
          />
        </div>

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="rounded-xl p-5 mb-4" style={cardStyle}>
            <div className="text-center mb-4">
              <div className="text-3xl mb-1">✅</div>
              <h2 className="font-bold text-lg">{t('join.done.thanks', { name })}</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>{t('join.done.saved')}</p>
            </div>

            <div className="text-sm mb-3">
              <span className="font-medium">{total}</span>
              <span style={{ color: 'var(--color-muted)' }}> {t('join.done.countMany')} {t('join.done.countSuffix')}</span>
              {minNeeded > 1 && (
                <span className="text-xs ms-2" style={{ color: 'var(--color-muted)' }}>
                  ({t('join.done.minParticipants', { n: minNeeded })})
                </span>
              )}
            </div>

            {!isDeadlinePassed && stillNeeded > 0 && (
              <div className="py-2 px-3 rounded-lg text-sm mb-2" style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}>
                {t('join.done.stillNeeded', { n: stillNeeded })}
              </div>
            )}

            {isPending && (
              <div className="py-2 px-3 rounded-lg text-sm" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                ⏳ {t('join.done.deciding')}
              </div>
            )}
          </div>

          {/* Heatmap — collapsed by default */}
          {Object.keys(availability).length > 0 && (
            <div className="rounded-xl mb-4 overflow-hidden" style={cardStyle}>
              <button
                onClick={() => setHeatmapOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)' }}
              >
                <span>{t('join.done.heatmapTitle')}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0, transition: 'transform 0.2s', transform: heatmapOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {leadingSlot && !leadingSlot.cancelled && !isDeadlinePassed && (
                <div className="px-4 pb-3 text-sm font-medium" style={{ color: '#16a34a' }}>
                  {t('join.done.leadingSlot', { slot: fmtSlot(leadingSlot, t) })}
                </div>
              )}
              {heatmapOpen && (
                <div className="px-4 pb-4">
                  <AvailabilityGrid
                    selectedSlots={new Set()}
                    allowedSlots={organizer_slots?.length > 0 ? organizer_slots : null}
                    existingAvailability={availability}
                    currentParticipantId={organizerParticipantId}
                    startDate={startDate}
                    numDays={DAYS_TO_SHOW}
                    readOnly
                  />
                </div>
              )}
            </div>
          )}

          {!isDeadlinePassed && (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-3 rounded-2xl font-medium text-sm"
              style={cardStyle}
            >
              {t('join.done.editBtn')}
            </button>
          )}
        </motion.div>
      </Layout>
    );
  }

  // Input / editing phase
  return (
    <Layout title={event.name}>
      <div className="mb-4">
        <h1 className="text-xl font-bold">{event.name}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          {t('join.organizedBy', { name: event.organizer_name })}
        </p>
      </div>

      <div className="mb-4">
        <div className="text-xs mb-1 font-medium" style={{ color: 'var(--color-muted)' }}>
          {t('join.deadlineLabel')}
        </div>
        <CountdownTimer
          deadlineAt={event.deadline_at}
          onExpire={handleTimerExpire}
          winningSlotStart={event.winning_slot_start}
          winningSlotEnd={event.winning_slot_end}
          isPending={isPending}
        />
      </div>

      {isEditing && (
        <div className="flex items-center gap-2 mb-4 py-2 px-3 rounded-xl text-sm" style={{ backgroundColor: '#fef9c3', color: '#854d0e' }}>
          <span>{t('join.editBanner')}</span>
          <button
            onClick={() => { setIsEditing(false); setPhase('done'); }}
            className="font-medium text-xs"
            style={{ marginRight: 'auto' }}
          >
            {t('join.editCancel')}
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('join.yourName')}</label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setNameError(''); }}
            placeholder={t('join.namePlaceholder')}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--color-bg)',
              border: `1px solid ${nameError ? '#dc2626' : 'var(--color-border)'}`,
              color: 'var(--color-text)',
            }}
            disabled={!!participantId}
          />
          {nameError && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{nameError}</p>}
        </div>

        <div>
          <h2 className="text-sm font-bold mb-2">{t('join.gridTitle')}</h2>
          <AvailabilityGrid
            selectedSlots={selectedSlots}
            onSlotsChange={setSelectedSlots}
            allowedSlots={organizer_slots?.length > 0 ? organizer_slots : null}
            existingAvailability={availability}
            currentParticipantId={participantId}
            startDate={startDate}
            numDays={DAYS_TO_SHOW}
          />
        </div>

        {submitError && (
          <div className="py-2 px-3 rounded-lg text-sm" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
            {submitError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-60"
          style={{ backgroundColor: '#3b82f6' }}
        >
          {isSubmitting ? t('join.submitting') : t('join.submitBtn')}
        </button>

        <button
          onClick={handleUnavailable}
          disabled={isSubmitting}
          className="w-full py-3 rounded-2xl font-medium text-sm"
          style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
        >
          {t('join.unavailableBtn')}
        </button>
      </div>
    </Layout>
  );
}
