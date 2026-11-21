import type { Prefs, RawJob } from '@/lib/types';
import { normalize } from './fingerprint';

const TH_PLACES = ['thailand', 'bangkok', 'กรุงเทพ', 'ไทย'];

export function prefilter(job: Pick<RawJob, 'title' | 'remote' | 'location'>, prefs: Prefs): boolean {
  const title = ` ${normalize(job.title)} `;
  const roleOk = prefs.roles.length === 0 || prefs.roles.some((r) => title.includes(normalize(r)));
  const loc = (job.location ?? '').toLowerCase();
  const inTh = TH_PLACES.some((p) => loc.includes(p));
  const modeOk = prefs.modes.some((m) => (m === 'remote' ? job.remote : inTh));
  return roleOk && modeOk;
}
