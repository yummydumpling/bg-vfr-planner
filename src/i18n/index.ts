import { useSettings } from '../store/settings';
import { bg } from './bg';
import { en, type Dict } from './en';

export type Lang = 'bg' | 'en';
const dicts: Record<Lang, Dict> = { en, bg };

export function useT(): Dict {
  const lang = useSettings((s) => s.lang);
  return dicts[lang];
}

export const getDict = (lang: Lang): Dict => dicts[lang];
