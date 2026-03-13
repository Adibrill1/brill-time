import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useTranslation } from '../lib/useTranslation';

const TEAL = '#3b82f6';
const BIT_PHONE = '0523919350';
const BIT_LINK = `https://www.bitpay.co.il/app/pay/${BIT_PHONE}`;
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(BIT_LINK)}&bgcolor=ffffff&color=0d3d3d&margin=12`;

function IconBox({ children }) {
  return (
    <div className="flex items-center justify-center rounded-2xl mb-4 mx-auto"
      style={{ width: 56, height: 56, backgroundColor: TEAL }}>
      {children}
    </div>
  );
}

function DonateModal({ onClose }) {
  const [copied, setCopied] = useState(false);
  const copyPhone = () => {
    navigator.clipboard?.writeText(BIT_PHONE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ duration: 0.22 }}
        className="rounded-3xl p-6 w-full max-w-xs relative text-center"
        style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-muted)' }}>×</button>
        <div className="text-3xl mb-1">🌿</div>
        <h2 className="font-bold text-lg mb-1">תזמינו אותי לתה</h2>
        <p className="text-xs mb-5" style={{ color: 'var(--color-muted)' }}>
          כל תרומה, קטנה כגדולה, עוזרת לשמור את השירות חינמי 🙏
        </p>
        <div className="mb-4">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-muted)' }}>
            📱 סרקו עם הטלפון לתשלום בביט
          </p>
          <div className="flex justify-center">
            <img src={QR_URL} alt="QR ביט" width={160} height={160}
              className="rounded-xl" style={{ border: '2px solid var(--color-border)' }} />
          </div>
        </div>
        <a href={BIT_LINK} target="_blank" rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white no-underline mb-3"
          style={{ backgroundColor: '#006d6d' }}>
          <span style={{ fontSize: 18 }}>bit</span>
          פתח בביט
        </a>
        <button onClick={copyPhone}
          className="w-full py-2.5 rounded-xl text-xs font-medium transition-colors"
          style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
          {copied ? '✅ הועתק!' : `📋 העתק מספר: ${BIT_PHONE}`}
        </button>
      </motion.div>
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const [showDonate, setShowDonate] = useState(false);

  return (
    <Layout title={t('index.title')}>
      <div className="text-center">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="pt-8 pb-6">
          <Link href="/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 no-underline transition-opacity hover:opacity-80 cursor-pointer"
            style={{ backgroundColor: '#eff6ff', color: TEAL, border: `1px solid #bfdbfe` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {t('index.badge')}
          </Link>
          <h1 className="font-bold mb-4 leading-tight" style={{ fontSize: 'clamp(2rem, 6vw, 2.8rem)', color: 'var(--color-text)' }}>
            {t('index.h1line1')}<br />{t('index.h1line2')}
          </h1>
          <p className="text-base mb-2 mx-auto" style={{ color: 'var(--color-muted)', maxWidth: 420 }}>{t('index.subtitle')}</p>
          <p className="text-sm mb-8 mx-auto font-medium" style={{ color: TEAL, maxWidth: 420 }}>{t('index.subtitleFree')}</p>
          <Link href="/create"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-bold text-base no-underline transition-opacity hover:opacity-90"
            style={{ backgroundColor: TEAL }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            {t('index.cta')}
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }} className="mt-10">
          <h2 className="text-xl font-bold mb-6">{t('index.howTitle')}</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl text-center" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              <IconBox><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></IconBox>
              <div className="font-bold text-sm mb-1">{t('index.step1.title')}</div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>{t('index.step1.desc')}</div>
            </div>
            <div className="p-4 rounded-2xl text-center" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              <IconBox><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></IconBox>
              <div className="font-bold text-sm mb-1">{t('index.step2.title')}</div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>{t('index.step2.desc')}</div>
            </div>
            <div className="p-4 rounded-2xl text-center" style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
              <IconBox><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></IconBox>
              <div className="font-bold text-sm mb-1">{t('index.step3.title')}</div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--color-muted)' }}>{t('index.step3.desc')}</div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }} className="mt-12 pb-2">
          <button onClick={() => setShowDonate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', cursor: 'pointer' }}>
            {t('index.donate.text')}
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {showDonate && <DonateModal onClose={() => setShowDonate(false)} />}
      </AnimatePresence>
    </Layout>
  );
}
