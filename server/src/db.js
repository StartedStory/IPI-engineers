// Async data-access layer backed by Supabase (Postgres).
// All functions return JSON shaped exactly like the previous file-backed db
// so the REST API contract with the client stays the same.

import { supabase, unwrap, STORAGE_BUCKET } from './supabase.js';

// ─── mapping helpers (snake_case  ↔  camelCase) ─────────────────────────────

function devRow(d) {
  if (!d) return d;
  return {
    id: d.id,
    name: d.name,
    location: d.location || '',
    email: d.email || '',
    password: d.password || '',
    linkedin: d.linkedin || '',
    cvFile: d.cv_path
      ? { filename: d.cv_path, originalName: d.cv_original_name || d.cv_path }
      : null,
    createdAt: d.created_at,
  };
}

function eventRow(e) {
  if (!e) return e;
  return {
    id: e.id,
    developerId: e.developer_id,
    developerName: e.developer_name || '',
    interviewerName: e.interviewer_name || '',
    recruiterName: e.recruiter_name || '',
    start: e.start_at,
    end: e.end_at,
    meetingLink: e.meeting_link || '',
    jdLink: e.jd_link || '',
    roleTitle: e.role_title || '',
    companyName: e.company_name || '',
    color: e.color || '#3b82f6',
    status: e.status,
    processStage: e.process_stage,
    createdBy: e.created_by,
  };
}

function eventInsert(e, userId) {
  return {
    developer_id: e.developerId || null,
    developer_name: e.developerName || '',
    interviewer_name: e.interviewerName || '',
    recruiter_name: e.recruiterName || '',
    start_at: e.start,
    end_at: e.end || e.start,
    meeting_link: e.meetingLink || '',
    jd_link: e.jdLink || '',
    role_title: e.roleTitle || '',
    company_name: e.companyName || '',
    color: e.color || '#3b82f6',
    status: e.status || 'scheduled',
    process_stage: e.processStage || 'intro',
    created_by: userId || null,
  };
}

const EVENT_PATCH_MAP = {
  developerId: 'developer_id',
  developerName: 'developer_name',
  interviewerName: 'interviewer_name',
  recruiterName: 'recruiter_name',
  start: 'start_at',
  end: 'end_at',
  meetingLink: 'meeting_link',
  jdLink: 'jd_link',
  roleTitle: 'role_title',
  companyName: 'company_name',
  color: 'color',
  status: 'status',
  processStage: 'process_stage',
};

function pickMapped(body, map) {
  const out = {};
  for (const k of Object.keys(map)) {
    if (k in body) out[map[k]] = body[k];
  }
  return out;
}

function processRow(p) {
  if (!p) return p;
  return {
    id: p.id,
    companyName: p.company_name,
    roleTitle: p.role_title,
    developerId: p.developer_id,
    developerName: p.developer_name || '',
    stage: p.stage,
    interviewerName: p.interviewer_name || '',
    brokerName: p.broker_name || '',
    jdLink: p.jd_link || '',
    notes: p.notes || '',
    updatedAt: p.updated_at,
  };
}

function processInsert(p) {
  return {
    company_name: p.companyName,
    role_title: p.roleTitle,
    developer_id: p.developerId || null,
    developer_name: p.developerName || '',
    stage: p.stage || 'intro',
    interviewer_name: p.interviewerName || '',
    broker_name: p.brokerName || '',
    jd_link: p.jdLink || '',
    notes: p.notes || '',
    updated_at: new Date().toISOString(),
  };
}

const PROCESS_PATCH_MAP = {
  companyName: 'company_name',
  roleTitle: 'role_title',
  developerId: 'developer_id',
  developerName: 'developer_name',
  stage: 'stage',
  interviewerName: 'interviewer_name',
  brokerName: 'broker_name',
  jdLink: 'jd_link',
  notes: 'notes',
};

function teammateRow(t) {
  if (!t) return t;
  return {
    id: t.id,
    role: t.role,
    name: t.name,
    email: t.email || '',
    telegram: t.telegram || '',
    discord: t.discord ?? undefined,
    whatsapp: t.whatsapp ?? undefined,
  };
}

function teammateInsert(t) {
  return {
    role: t.role,
    name: t.name,
    email: t.email || '',
    telegram: t.telegram || '',
    discord: t.role !== 'bidder' ? (t.discord || '') : null,
    whatsapp: t.role !== 'bidder' ? (t.whatsapp || '') : null,
  };
}

const TEAMMATE_PATCH_MAP = {
  role: 'role',
  name: 'name',
  email: 'email',
  telegram: 'telegram',
  discord: 'discord',
  whatsapp: 'whatsapp',
};

// ─── users ──────────────────────────────────────────────────────────────────
function userRow(u) {
  if (!u) return u;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.created_at,
  };
}

export const users = {
  async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async list() {
    const data = unwrap(
      await supabase
        .from('users')
        .select('id, name, email, role, created_at')
        .order('role')
        .order('email')
    );
    return data.map(userRow);
  },
  async create({ name, email, role, passwordHash }) {
    const data = unwrap(
      await supabase
        .from('users')
        .insert({ name, email, role, password_hash: passwordHash })
        .select('id, name, email, role, created_at')
        .single()
    );
    return userRow(data);
  },
  async update(id, { name, email, role, passwordHash }) {
    const upd = {};
    if (name !== undefined) upd.name = name;
    if (email !== undefined) upd.email = email;
    if (role !== undefined) upd.role = role;
    if (passwordHash !== undefined) upd.password_hash = passwordHash;
    const data = unwrap(
      await supabase
        .from('users')
        .update(upd)
        .eq('id', id)
        .select('id, name, email, role, created_at')
        .single()
    );
    return userRow(data);
  },
  async remove(id) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─── developers ─────────────────────────────────────────────────────────────
export const developers = {
  async list() {
    const data = unwrap(
      await supabase.from('developers').select('*').order('created_at', { ascending: false })
    );
    return data.map(devRow);
  },
  async get(id) {
    const { data, error } = await supabase
      .from('developers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return devRow(data);
  },
  async create({ name, location, email, password, linkedin, cv }) {
    const insert = {
      name,
      location: location || '',
      email: email || '',
      password: password || '',
      linkedin: linkedin || '',
      cv_path: cv?.path || null,
      cv_original_name: cv?.originalName || null,
    };
    const data = unwrap(
      await supabase.from('developers').insert(insert).select('*').single()
    );
    return devRow(data);
  },
  async update(id, patch) {
    const upd = {};
    if ('name' in patch) upd.name = patch.name;
    if ('location' in patch) upd.location = patch.location ?? '';
    if ('email' in patch) upd.email = patch.email ?? '';
    if ('password' in patch) upd.password = patch.password ?? '';
    if ('linkedin' in patch) upd.linkedin = patch.linkedin ?? '';
    if ('cv' in patch) {
      upd.cv_path = patch.cv?.path || null;
      upd.cv_original_name = patch.cv?.originalName || null;
    }
    const data = unwrap(
      await supabase.from('developers').update(upd).eq('id', id).select('*').single()
    );
    return devRow(data);
  },
  async remove(id) {
    const { error } = await supabase.from('developers').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─── events ─────────────────────────────────────────────────────────────────
export const events = {
  async listVisibleTo(user) {
    let q = supabase.from('events').select('*').order('start_at', { ascending: true });
    if (user.role === 'interviewer') {
      q = q.ilike('interviewer_name', user.name);
    }
    const data = unwrap(await q);
    return data.map(eventRow);
  },
  async get(id) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return eventRow(data);
  },
  async create(body, userId) {
    const data = unwrap(
      await supabase.from('events').insert(eventInsert(body, userId)).select('*').single()
    );
    return eventRow(data);
  },
  async update(id, patch) {
    const upd = pickMapped(patch, EVENT_PATCH_MAP);
    if (!Object.keys(upd).length) return await this.get(id);
    const data = unwrap(
      await supabase.from('events').update(upd).eq('id', id).select('*').single()
    );
    return eventRow(data);
  },
  async remove(id) {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─── processes ──────────────────────────────────────────────────────────────
export const processes = {
  async listVisibleTo(user) {
    let q = supabase.from('processes').select('*').order('updated_at', { ascending: false });
    if (user.role === 'broker') {
      q = q.ilike('broker_name', user.name);
    }
    const data = unwrap(await q);
    return data.map(processRow);
  },
  async create(body) {
    const data = unwrap(
      await supabase.from('processes').insert(processInsert(body)).select('*').single()
    );
    return processRow(data);
  },
  async update(id, patch) {
    const upd = pickMapped(patch, PROCESS_PATCH_MAP);
    if (Object.keys(upd).length) upd.updated_at = new Date().toISOString();
    const data = unwrap(
      await supabase.from('processes').update(upd).eq('id', id).select('*').single()
    );
    return processRow(data);
  },
  async remove(id) {
    const { error } = await supabase.from('processes').delete().eq('id', id);
    if (error) throw error;
  },
  async listAllForAnalytics() {
    const data = unwrap(await supabase.from('processes').select('*'));
    return data.map(processRow);
  },
  async listAllEventsForAnalytics() {
    const data = unwrap(await supabase.from('events').select('*'));
    return data.map(eventRow);
  },
};

// ─── teammates ──────────────────────────────────────────────────────────────
export const teammates = {
  async list() {
    const data = unwrap(
      await supabase.from('teammates').select('*').order('role').order('name')
    );
    return data.map(teammateRow);
  },
  async create(body) {
    const data = unwrap(
      await supabase.from('teammates').insert(teammateInsert(body)).select('*').single()
    );
    return teammateRow(data);
  },
  async update(id, patch) {
    const upd = pickMapped(patch, TEAMMATE_PATCH_MAP);
    const data = unwrap(
      await supabase.from('teammates').update(upd).eq('id', id).select('*').single()
    );
    return teammateRow(data);
  },
  async remove(id) {
    const { error } = await supabase.from('teammates').delete().eq('id', id);
    if (error) throw error;
  },
};

// ─── CV storage (Supabase Storage bucket) ───────────────────────────────────
export const cvStorage = {
  async upload(buffer, filename, mimetype) {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, buffer, { contentType: mimetype, upsert: false });
    if (error) throw error;
    return filename;
  },
  async download(path) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  },
  async remove(path) {
    if (!path) return;
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  },
};
