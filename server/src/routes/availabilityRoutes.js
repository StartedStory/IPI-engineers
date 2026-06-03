import { Router } from 'express';
import { availability } from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();

const canView = requireRole('manager', 'bidder', 'interviewer');

function sameName(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

// Whether `user` is allowed to edit a slot belonging to `interviewerName`.
function canEditFor(user, interviewerName) {
  if (user.role === 'manager') return true;
  if (user.role === 'interviewer') return sameName(user.name, interviewerName);
  return false;
}

router.get('/', canView, async (req, res, next) => {
  try {
    res.json(await availability.listVisibleTo(req.user));
  } catch (e) {
    next(e);
  }
});

router.post('/', requireRole('manager', 'interviewer'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.start || !body.end) {
      return res.status(400).json({ error: 'start and end are required' });
    }
    // Interviewers can only create slots for themselves; managers must name the interviewer.
    const interviewerName =
      req.user.role === 'interviewer' ? req.user.name : (body.interviewerName || '').trim();
    if (!interviewerName) {
      return res.status(400).json({ error: 'interviewerName is required' });
    }
    if (!canEditFor(req.user, interviewerName)) {
      return res.status(403).json({ error: 'Not your availability' });
    }
    const slot = await availability.create({ ...body, interviewerName }, req.user.id);
    res.status(201).json(slot);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requireRole('manager', 'interviewer'), async (req, res, next) => {
  try {
    const slot = await availability.get(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Not found' });
    if (!canEditFor(req.user, slot.interviewerName)) {
      return res.status(403).json({ error: 'Not your availability' });
    }
    // Never allow reassigning a slot to a different interviewer here.
    const patch = { ...(req.body || {}) };
    delete patch.interviewerName;
    res.json(await availability.update(req.params.id, patch));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireRole('manager', 'interviewer'), async (req, res, next) => {
  try {
    const slot = await availability.get(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Not found' });
    if (!canEditFor(req.user, slot.interviewerName)) {
      return res.status(403).json({ error: 'Not your availability' });
    }
    await availability.remove(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
