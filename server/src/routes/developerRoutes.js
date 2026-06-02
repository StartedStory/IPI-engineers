import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { nanoid } from '../utils/ids.js';
import { developers, cvStorage } from '../db.js';
import { requireRole } from '../auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /pdf|doc|docx|png|jpg|jpeg/i.test(path.extname(file.originalname));
    cb(ok ? null : new Error('Unsupported file type'), ok);
  },
});

const canEdit = requireRole('manager', 'bidder');
const canView = requireRole('manager', 'bidder', 'interviewer');

router.get('/', canView, async (_req, res, next) => {
  try {
    res.json(await developers.list());
  } catch (e) {
    next(e);
  }
});

router.post('/', canEdit, upload.single('cv'), async (req, res, next) => {
  try {
    const { name, location, email, password, linkedin } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    let cv = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const storedName = `${nanoid()}${ext}`;
      await cvStorage.upload(req.file.buffer, storedName, req.file.mimetype);
      cv = { path: storedName, originalName: req.file.originalname };
    }
    const dev = await developers.create({ name, location, email, password, linkedin, cv });
    res.status(201).json(dev);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', canEdit, upload.single('cv'), async (req, res, next) => {
  try {
    const current = await developers.get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });

    const { name, location, email, password, linkedin, removeCv } = req.body || {};
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (location !== undefined) patch.location = location;
    if (email !== undefined) patch.email = email;
    if (password !== undefined) patch.password = password;
    if (linkedin !== undefined) patch.linkedin = linkedin;

    if (req.file) {
      if (current.cvFile?.filename) await cvStorage.remove(current.cvFile.filename);
      const ext = path.extname(req.file.originalname);
      const storedName = `${nanoid()}${ext}`;
      await cvStorage.upload(req.file.buffer, storedName, req.file.mimetype);
      patch.cv = { path: storedName, originalName: req.file.originalname };
    } else if (removeCv === 'true') {
      if (current.cvFile?.filename) await cvStorage.remove(current.cvFile.filename);
      patch.cv = null;
    }

    const updated = await developers.update(req.params.id, patch);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', canEdit, async (req, res, next) => {
  try {
    const current = await developers.get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Not found' });
    if (current.cvFile?.filename) await cvStorage.remove(current.cvFile.filename);
    await developers.remove(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/cv', canView, async (req, res, next) => {
  try {
    const dev = await developers.get(req.params.id);
    if (!dev || !dev.cvFile) return res.status(404).json({ error: 'No CV' });
    const buf = await cvStorage.download(dev.cvFile.filename);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${dev.cvFile.originalName.replace(/"/g, '')}"`
    );
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

export default router;
