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

export default function OrganizerDash() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, participants: participantsParam } = router.query;

  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [organizerParticipantId, setOrganizerParticipantId] = useState(null);
  const [gridOpen, setGridOpen] = useState(false); // collapsed by default
  const [heatmapOpen, setHeatmapOpen] = useState(false); // collapsed by default
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);

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
      if (!res.ok) return;
      const data = await res.json();
      setEventData(data);
      setIsDeadlinePassed(Date.now() > data.event.deadline_at);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // On mount: extract organizer participant from URL params or find in event data
  useEffect(() => {
    if (!id) return;

    // Try to restore organizer participant_id from localStorage
    const stored = localStorage.getItem(`brilltime_organizer_${id}`);
    if (stored) {
      setOrganizerParticipantId(stored);
    } else if (participantsParam) {
      try {
        const list = JSON.parse(decodeURIComponent(participantsParam));
        const organizer = list.find(p => p.is_organizer);
        if (organizer) {
          setOrganizerParticipantId(organizer.id);
          localStorage.setItem(`brilltime_organizer_${id}`, organizer.id);
        }
      } catch {}
    }

    fetchEvent();
  }, [id, participantsParam, fetchEvent]);

  // After event data loads, find organizer participant if still unknown
  useEffect(() => {
    if (!eventData || organizerParticipantId) return;
    const organizer = eventData.participants.find(p => p.is_organizer);
    if (organizer) {
      setOrganizerParticipantId(organizer.id);
      localStorage.setItem(`brilltime_organizer_${id}`, organizer.id);
    }
  }, [eventData, organizerParticipantId, id]);

  // Pre-fill organizer's existing slots
  useEffect(() => {
    if (!eventData || !organizerParticipantId) return;
    const orgSlots = eventData.availability[organizerParticipantId];
    if (orgSlots && orgSlots.length > 0) {
      setSelectedSlots(new Set(orgSlots.map(s => s.slot_start)));
      setHasSaved(true);
    }
  }, [eventData, organizerParticipantId]);

  // Poll every 5s while event is open (picks up new submissions + auto-transitions on decision)
  useEffect(() => {
    if (!eventData || eventData.event.status !== 'open') return;
    const interval = setInterval(fetchEvent, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [eventData, fetchEvent]);

  const handleTimerExpire = useCallback(async () => {
    if (!id) return;
    setIsDeadlinePassed(true);
    try {
      await fetch(`/api/events/${id}?action=decide`, { method: 'POST' });
    } catch {}
    window.location.reload();
  }, [id]);

  const handleSaveAvailability = async () => {
    if (!organizerParticipantId) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const slots = Array.from(selectedSlots).map(start => ({
        slot_start: start,
        slot_end: start + 3600000,
      }));
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: id, participant_id: organizerParticipantId, slots }),
      });
      if (!res.ok) throw new Error('Save failed');
      setHasSaved(true);
      setGridOpen(false);
      await fetchEvent();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = () => {
    const joinUrl = `${window.location.origin}/join/${id}`;
    navigator.clipboard?.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (loading) {
    return <Layout><div className="text-center py-12">{t('common.loading')}</div></Layout>;
  }
  if (!eventData) {
    return <Layout><div className="text-center py-12">{t('common.eventNotFound')}</div></Layout>;
  }

  const { event, participants, availability, organizer_slots } = eventData;
  const isPending = isDeadlinePassed && !event.winning_slot_start && event.status === 'open';
  const nonOrganizerParticipants = participants.filter(p => !p.is_organizer);
  const submitted = nonOrganizerParticipants.filter(p => availability[p.id]);
  const minNeeded = event.min_participants || 2;
  const stillNeeded = Math.max(0, minNeeded - submitted.length);

  // Current leading slot — shown while event is open and there are enough participants
  const leadingSlot = (event.status === 'open' && stillNeeded === 0)
    ? findWinningSlot(participants, availability, minNeeded, organizer_slots?.length > 0 ? organizer_slots : null)
    : null;

  const cardStyle = { backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' };

  return (
    <Layout title={`${t('organizer.dashTitle')} — ${event.name}`}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            {t('organizer.dashTitle')} · {event.organizer_name}
          </p>
        </div>

        {/* Timer */}
        <div className="rounded-xl p-4 mb-4" style={cardStyle}>
          <div className="text-xs mb-2 font-medium" style={{ color: 'var(--color-muted)' }}>
            {t('organizer.deadlineLabel')}
          </div>
          <CountdownTimer
            deadlineAt={event.deadline_at}
            onExpire={handleTimerExpire}
            winningSlotStart={event.winning_slot_start}
            winningSlotEnd={event.winning_slot_end}
            isPending={isPending}
          />
        </div>

        {/* Organizer availability section — collapsed by default */}
        <div className="rounded-xl mb-4 overflow-hidden" style={cardStyle}>
          <button
            onClick={() => setGridOpen(o => !o)}
            className="w-full flex items-center justify-between p-4 text-sm font-bold"
            style={{ backgroundColor: 'transparent' }}
          >
            <span>
              {t('organizer.myAvailability.title')}
              {hasSaved && (
                <span className="ms-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
                  {t('organizer.myAvailability.badge')}
                </span>
              )}
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: gridOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {gridOpen && (
            <div className="px-4 pb-4">
              <p className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>
                {hasSaved ? t('organizer.myAvailability.editHint') : t('organizer.myAvailability.openHint')}
              </p>
              <AvailabilityGrid
                selectedSlots={selectedSlots}
                onSlotsChange={setSelectedSlots}
                existingAvailability={availability}
                currentParticipantId={organizerParticipantId}
                startDate={startDate}
                numDays={DAYS_TO_SHOW}
              />
              {saveError && (
                <p className="text-xs mt-2" style={{ color: '#dc2626' }}>{saveError}</p>
              )}
              <button
                onClick={handleSaveAvailability}
                disabled={isSaving}
                className="mt-3 w-full py-3 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: '#3b82f6' }}
              >
                {isSaving
                  ? t('organizer.myAvailability.saving')
                  : hasSaved
                    ? t('organizer.myAvailability.updateBtn')
                    : t('organizer.myAvailability.saveBtn')}
              </button>
            </div>
          )}
        </div>

        {/* Join link */}
        <div className="rounded-xl p-4 mb-4" style={cardStyle}>
          <div className="font-bold text-sm mb-1">{t('organizer.joinLink.title')}</div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>{t('organizer.joinLink.desc')}</p>
          <div className="flex gap-2 items-center">
            <input
              readOnly
              value={typeof window !== 'undefined' ? `${window.location.origin}/join/${id}` : `/join/${id}`}
              className="flex-1 px-3 py-2 rounded-lg text-xs"
              style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}
            />
            <button
              onClick={handleCopyLink}
              className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap"
              style={{ backgroundColor: copied ? '#dcfce7' : '#eff6ff', color: copied ? '#16a34a' : '#2563eb', border: '1px solid var(--color-border)' }}
            >
              {copied ? t('organizer.joinLink.copied') : t('organizer.joinLink.copyBtn')}
            </button>
          </div>
        </div>

        {/* Participant count + leading slot */}
        {nonOrganizerParticipants.length > 0 && (
          <div className="rounded-xl p-4 mb-4 text-sm" style={cardStyle}>
            <span className="font-medium">{submitted.length}/{nonOrganizerParticipants.length}</span>
            <span style={{ color: 'var(--color-muted)' }}> {t('grid.participants')} {t('join.done.countSuffix')}</span>
            {leadingSlot && !leadingSlot.cancelled && (
              <p className="mt-2 text-xs font-medium" style={{ color: '#16a34a' }}>
                {t('join.done.leadingSlot', { slot: fmtSlot(leadingSlot, t) })}
              </p>
            )}
          </div>
        )}

        {/* Heatmap of all participants (read-only) — collapsible */}
        {Object.keys(availability).length > 0 && (
          <div className="rounded-xl" style={cardStyle}>
            <button
              className="w-full flex items-center justify-between p-4 text-sm font-bold"
              onClick={() => setHeatmapOpen(o => !o)}
            >
              <span>{t('join.done.heatmapTitle')}</span>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"
                style={{ flexShrink: 0, transition: 'transform 0.2s', transform: heatmapOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
            {heatmapOpen && (
              <div className="px-4 pb-4">
                <p className="text-xs mb-3" style={{ color: 'var(--color-muted)' }}>{t('join.done.heatmapDesc')}</p>
                <AvailabilityGrid
                  selectedSlots={new Set()}
                  allowedSlots={organizer_slots?.length > 0 ? organizer_slots : null}
                  existingAvailability={availability}
                  currentParticipantId={organizerParticipantId}
                  startDate={startDate}
                  numDays={DAYS_TO_SHOW}
                  readOnly
                  filterDisplayDays
                  filterDisplayHours
                />
              </div>
            )}
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
