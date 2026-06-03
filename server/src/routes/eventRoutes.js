import { Router } from 'express';
import { events, processes } from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();

const canManage = requireRole('manager', 'bidder');
const canView = requireRole('manager', 'bidder', 'interviewer');

router.get('/', canView, async (req, res, next) => {
  try {
    res.json(await events.listVisibleTo(req.user));
  } catch (e) {
    next(e);
  }
});

router.post('/', canManage, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.start) return res.status(400).json({ error: 'start is required' });
    const ev = await events.create(body, req.user.id);
    await processes.syncFromEvent(ev);
    res.status(201).json(ev);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const ev = await events.get(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Not found' });

    const role = req.user.role;
    const isAssignedInterviewer =
      role === 'interviewer' &&
      (ev.interviewerName || '').toLowerCase() === req.user.name.toLowerCase();

    if (role === 'interviewer') {
      if (!isAssignedInterviewer) return res.status(403).json({ error: 'Not your event' });
      const patch = {};
      if ('status' in (req.body || {})) patch.status = req.body.status;
      const updated = await events.update(req.params.id, patch);
      return res.json(updated);
    }
    if (role !== 'manager' && role !== 'bidder') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const updated = await events.update(req.params.id, req.body || {});
    await processes.syncFromEvent(updated);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', canManage, async (req, res, next) => {
  try {
    await events.remove(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
