import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { users } from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();
const ROLES = ['manager', 'bidder', 'interviewer', 'broker'];

router.use(requireRole('manager'));

router.get('/', async (_req, res, next) => {
  try {
    res.json(await users.list());
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, email, role, password } = req.body || {};
    if (!name || !email || !role || !password) {
      return res.status(400).json({ error: 'name, email, role, password are required' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }
    const existing = await users.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'A user with this email already exists' });
    const created = await users.create({
      name,
      email: String(email).toLowerCase().trim(),
      role,
      passwordHash: bcrypt.hashSync(password, 10),
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const target = await users.findById(id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const { name, email, role, password } = req.body || {};

    if (role !== undefined && !ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
    }
    // Prevent a manager from demoting themselves and locking out admin access.
    if (id === req.user.id && role !== undefined && role !== 'manager') {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }
    if (email !== undefined && String(email).toLowerCase() !== target.email.toLowerCase()) {
      const dupe = await users.findByEmail(email);
      if (dupe && dupe.id !== id) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }
    }
    if (password !== undefined && String(password).length > 0 && String(password).length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    const patch = {};
    if (name !== undefined) patch.name = name;
    if (email !== undefined) patch.email = String(email).toLowerCase().trim();
    if (role !== undefined) patch.role = role;
    if (password) patch.passwordHash = bcrypt.hashSync(password, 10);

    const updated = await users.update(id, patch);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const target = await users.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    await users.remove(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
