// Idempotently seeds default users + teammates into Supabase.
// Safe to run multiple times.
//
//   cd server
//   npm run seed
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { supabase } from '../src/supabase.js';

const hash = (pw) => bcrypt.hashSync(pw, 10);

const DEFAULT_USERS = [
  { name: 'Alice Manager',     email: 'manager@ipi.local',     password: 'manager123',     role: 'manager' },
  { name: 'Ben Bidder',        email: 'bidder@ipi.local',      password: 'bidder123',      role: 'bidder' },
  { name: 'Ivy Interviewer',   email: 'interviewer@ipi.local', password: 'interviewer123', role: 'interviewer' },
  { name: 'Bob Broker',        email: 'broker@ipi.local',      password: 'broker123',      role: 'broker' },
];

const DEFAULT_TEAMMATES = [
  { role: 'bidder',      name: 'Ben Bidder',      email: 'bidder@ipi.local',      telegram: '@benb' },
  { role: 'interviewer', name: 'Ivy Interviewer', email: 'interviewer@ipi.local', telegram: '@ivyi', discord: 'ivy#1234', whatsapp: '+1-555-0100' },
  { role: 'broker',      name: 'Bob Broker',      email: 'broker@ipi.local',      telegram: '@bobb', discord: 'bob#5678', whatsapp: '+1-555-0101' },
];

async function upsertUser(u) {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .ilike('email', u.email)
    .maybeSingle();
  if (existing) {
    console.log(`  · user exists: ${u.email}`);
    return;
  }
  const { error } = await supabase.from('users').insert({
    name: u.name,
    email: u.email,
    role: u.role,
    password_hash: hash(u.password),
  });
  if (error) throw error;
  console.log(`  + user inserted: ${u.email}`);
}

async function upsertTeammate(t) {
  const { data: existing } = await supabase
    .from('teammates')
    .select('id')
    .eq('role', t.role)
    .ilike('name', t.name)
    .maybeSingle();
  if (existing) {
    console.log(`  · teammate exists: ${t.role}/${t.name}`);
    return;
  }
  const { error } = await supabase.from('teammates').insert({
    role: t.role,
    name: t.name,
    email: t.email || '',
    telegram: t.telegram || '',
    discord: t.role !== 'bidder' ? (t.discord || '') : null,
    whatsapp: t.role !== 'bidder' ? (t.whatsapp || '') : null,
  });
  if (error) throw error;
  console.log(`  + teammate inserted: ${t.role}/${t.name}`);
}

async function ensureBucket() {
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'cvs';
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if (buckets.find((b) => b.name === bucketName)) {
    console.log(`  · storage bucket exists: ${bucketName}`);
    return;
  }
  const { error: createErr } = await supabase.storage.createBucket(bucketName, {
    public: false,
  });
  if (createErr) throw createErr;
  console.log(`  + storage bucket created: ${bucketName}`);
}

async function main() {
  console.log('Seeding IPI database in Supabase...');
  console.log('Users:');
  for (const u of DEFAULT_USERS) await upsertUser(u);
  console.log('Teammates:');
  for (const t of DEFAULT_TEAMMATES) await upsertTeammate(t);
  console.log('Storage:');
  await ensureBucket();
  console.log('Done.');
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
