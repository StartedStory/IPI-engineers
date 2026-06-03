import { Router } from 'express';
import { findUserByEmail, requireAuth, signToken, verifyPassword } from '../auth.js';
import { users } from '../db.js';

const router = Router();

// Max size of an avatar data URL we accept (~700 KB once base64-encoded).
const MAX_AVATAR_LEN = 700 * 1024;

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatar_url || '',
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Any signed-in user may change their own avatar.
// Send { avatarUrl: 'data:image/...' } to set, or { avatarUrl: '' } / null to remove.
router.put('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    let { avatarUrl } = req.body || {};
    if (avatarUrl === null || avatarUrl === undefined) avatarUrl = '';
    if (typeof avatarUrl !== 'string') {
      return res.status(400).json({ error: 'avatarUrl must be a string' });
    }
    if (avatarUrl && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(avatarUrl)) {
      return res.status(400).json({ error: 'avatarUrl must be a base64 image data URL' });
    }
    if (avatarUrl.length > MAX_AVATAR_LEN) {
      return res.status(413).json({ error: 'Image is too large. Please choose a smaller photo.' });
    }
    const updated = await users.update(req.user.id, { avatarUrl });
    res.json({ user: updated });
  } catch (e) {
    next(e);
  }
});

export default router;
