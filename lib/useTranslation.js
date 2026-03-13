import { useRouter } from 'next/router';
import translations from './translations';

export function useTranslation() {
  const router = useRouter();
  const lang = router.pathname.startsWith('/en') ? 'en' : 'he';
  const dict = translations[lang];

  function t(key, vars) {
    const val = dict[key];
    if (val === undefined) return key;
    if (Array.isArray(val)) return val;
    if (!vars) return val;
    return String(val).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  }

  return { t, lang, dir: dict.dir };
}
