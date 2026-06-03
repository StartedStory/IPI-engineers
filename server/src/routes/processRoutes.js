import { Router } from 'express';
import { processes } from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();

const STAGES = ['intro', 'tech', 'final', 'onboard'];

router.get('/', async (req, res, next) => {
  try {
    res.json(await processes.listVisibleTo(req.user));
  } catch (e) {
    next(e);
  }
});

/** Backfill processes from existing calendar events (manager/bidder). */
router.post('/sync-from-events', requireRole('manager', 'bidder'), async (_req, res, next) => {
  try {
    const result = await processes.syncAllFromEvents();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/', requireRole('manager', 'bidder'), async (req, res, next) => {
  try {
    const p = req.body || {};
    if (!p.companyName || !p.roleTitle) {
      return res.status(400).json({ error: 'companyName and roleTitle are required' });
    }
    if (p.stage && !STAGES.includes(p.stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }
    const created = await processes.create(p);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requireRole('manager', 'bidder'), async (req, res, next) => {
  try {
    if (req.body?.stage && !STAGES.includes(req.body.stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }
    const updated = await processes.update(req.params.id, req.body || {});
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    await processes.remove(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
