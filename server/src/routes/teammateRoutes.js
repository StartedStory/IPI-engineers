import { Router } from 'express';
import { teammates } from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();

const ROLES = ['bidder', 'interviewer', 'broker'];

function stripContacts(t) {
  return { id: t.id, role: t.role, name: t.name };
}

router.get('/', requireRole('manager', 'bidder', 'interviewer'), async (req, res, next) => {
  try {
    const list = await teammates.list();
    if (req.user.role === 'manager') return res.json(list);
    res.json(list.map(stripContacts));
  } catch (e) {
    next(e);
  }
});

router.post('/', requireRole('manager'), async (req, res, next) => {
  try {
    const t = req.body || {};
    if (!t.name || !ROLES.includes(t.role)) {
      return res.status(400).json({ error: 'name and valid role required' });
    }
    res.status(201).json(await teammates.create(t));
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    if (req.body?.role && !ROLES.includes(req.body.role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    res.json(await teammates.update(req.params.id, req.body || {}));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    await teammates.remove(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
