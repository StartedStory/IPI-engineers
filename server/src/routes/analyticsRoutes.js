import { Router } from 'express';
import { processes } from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();
router.use(requireRole('manager', 'bidder', 'interviewer'));

function weekKey(d) {
  const date = new Date(d);
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function monthKey(d) {
  const date = new Date(d);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function bucketize(items, getDate, getGroupKeys) {
  const byWeek = {};
  const byMonth = {};
  for (const item of items) {
    const d = getDate(item);
    if (!d) continue;
    const wk = weekKey(d);
    const mk = monthKey(d);
    const keys = getGroupKeys(item);
    for (const key of keys) {
      byWeek[wk] = byWeek[wk] || {};
      byMonth[mk] = byMonth[mk] || {};
      byWeek[wk][key] = (byWeek[wk][key] || 0) + 1;
      byMonth[mk][key] = (byMonth[mk][key] || 0) + 1;
    }
  }
  const toSeries = (obj) =>
    Object.keys(obj).sort().map((k) => ({ key: k, ...obj[k] }));
  return { week: toSeries(byWeek), month: toSeries(byMonth) };
}

router.get('/bidders', async (_req, res, next) => {
  try {
    const items = await processes.listAllEventsForAnalytics();
    res.json(bucketize(items, (e) => e.start, (e) => [e.recruiterName || 'Unknown']));
  } catch (e) {
    next(e);
  }
});

router.get('/interviewers', async (_req, res, next) => {
  try {
    const items = (await processes.listAllEventsForAnalytics()).filter((e) => e.status === 'done');
    const result = bucketize(
      items,
      (e) => e.start,
      (e) => [`${e.interviewerName || 'Unknown'} :: ${e.processStage || 'intro'}`]
    );
    const stages = ['intro', 'tech', 'final', 'onboard'];
    const transform = (series) =>
      series.map((row) => {
        const out = { key: row.key };
        const totals = {};
        const totalsByInterviewer = {};
        for (const k of Object.keys(row)) {
          if (k === 'key') continue;
          const [interviewer] = k.split(' :: ');
          totalsByInterviewer[interviewer] = (totalsByInterviewer[interviewer] || 0) + row[k];
        }
        for (const interviewer of Object.keys(totalsByInterviewer)) {
          for (const stage of stages) {
            const cell = row[`${interviewer} :: ${stage}`] || 0;
            out[`${interviewer} (${stage})`] = cell;
            totals[stage] = (totals[stage] || 0) + cell;
          }
        }
        out.__stageTotals = totals;
        return out;
      });
    res.json({ week: transform(result.week), month: transform(result.month), stages });
  } catch (e) {
    next(e);
  }
});

router.get('/brokers', async (_req, res, next) => {
  try {
    const items = (await processes.listAllForAnalytics()).filter((p) => p.stage === 'onboard');
    res.json(bucketize(items, (p) => p.updatedAt, (p) => [p.brokerName || 'Unknown']));
  } catch (e) {
    next(e);
  }
});

export default router;
