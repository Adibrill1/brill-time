import { useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import { useTranslation } from '../lib/useTranslation';

export default function CreateEvent() {
  const { t } = useTranslation();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', organizer_name: '', deadline_hours: 24, min_participants: 2 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deadlineMode, setDeadlineMode] = useState('hours');
  const [deadlineDateTime, setDeadlineDateTime] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (deadlineMode === 'datetime') {
      const chosen = new Date(deadlineDateTime).getTime();
      if (!deadlineDateTime || isNaN(chosen) || chosen <= Date.now()) {
        setError(t('create.error.futureDate'));
        setLoading(false);
        return;
      }
    }
    try {
      const payload = { ...form };
      if (deadlineMode === 'datetime') {
        payload.deadline_at = new Date(deadlineDateTime).getTime();
        delete payload.deadline_hours;
      }
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || `${t('create.error.serverError')} (${res.status})`); return; }
      if (!data.event_id) { setError(t('create.error.noEventId')); return; }
      const participantsParam = encodeURIComponent(JSON.stringify(data.participants || []));
      window.location.href = `/organizer/${data.event_id}?participants=${participantsParam}`;
    } catch (err) {
      setError(t('create.error.connectionError') + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

  return (
    <Layout title={t('create.pageTitle')}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-6"><h1 className="text-2xl font-bold mt-2">{t('create.h1')}</h1></div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <h2 className="font-bold text-base">{t('create.sectionDetails')}</h2>
            <div>
              <label className="block text-sm mb-1 font-medium">{t('create.eventName.label')}</label>
              <input type="text" required placeholder={t('create.eventName.placeholder')} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm mb-1 font-medium">{t('create.organizerName.label')}</label>
              <input type="text" required placeholder={t('create.organizerName.placeholder')} value={form.organizer_name}
                onChange={e => setForm(f => ({ ...f, organizer_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-sm mb-1 font-medium">{t('create.minParticipants.label')}</label>
              <input type="number" min={1} max={100} value={form.min_participants}
                onChange={e => setForm(f => ({ ...f, min_participants: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{t('create.minParticipants.hint')}</p>
            </div>
            <div>
              <label className="block text-sm mb-2 font-medium">{t('create.deadline.label')}</label>
              <select value={deadlineMode === 'datetime' ? 'custom' : String(form.deadline_hours)}
                onChange={e => {
                  if (e.target.value === 'custom') { setDeadlineMode('datetime'); }
                  else { setDeadlineMode('hours'); setForm(f => ({ ...f, deadline_hours: Number(e.target.value) })); }
                }}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="0.05">{t('create.deadline.3min')}</option>
                <option value="0.25">{t('create.deadline.quarter')}</option>
                <option value="1">{t('create.deadline.1h')}</option>
                <option value="12">{t('create.deadline.12h')}</option>
                <option value="24">{t('create.deadline.24h')}</option>
                <option disabled>──────────</option>
                <option value="custom">{t('create.deadline.custom')}</option>
              </select>
              {deadlineMode === 'datetime' ? (
                <div className="mt-2">
                  <input type="datetime-local" value={deadlineDateTime}
                    min={(() => { const d = new Date(Date.now() + 5 * 60 * 1000); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })()}
                    onChange={e => setDeadlineDateTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{t('create.deadline.datetimeHint')}</p>
                </div>
              ) : (
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{t('create.deadline.hoursHint')}</p>
              )}
            </div>
          </div>
          {error && <div className="py-2 px-4 rounded-lg text-sm" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl text-white font-bold text-base transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#3b82f6' }}>
            {loading ? t('create.submitting') : t('create.submit')}
          </button>
        </form>
      </motion.div>
    </Layout>
  );
}
