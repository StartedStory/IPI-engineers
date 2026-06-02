// Add (or update) an IPI login user.
//
// Usage:
//   npm --prefix server run user:add -- --email alice@x.com --name "Alice" --role manager --password "secret"
//
// Any missing flag is asked for interactively. Re-running with the same email
// updates the user (password, name, role).

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { supabase } from '../src/supabase.js';

const ROLES = ['manager', 'bidder', 'interviewer', 'broker'];

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

function makeRl(maskPassword = false) {
  const muted = new Writable({
    write(chunk, _enc, cb) {
      if (!maskPassword) process.stdout.write(chunk);
      cb();
    },
  });
  return readline.createInterface({ input: process.stdin, output: muted, terminal: true });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    });
  });
}

function askPassword(question) {
  process.stdout.write(question);
  const rl = makeRl(true);
  return new Promise((resolve) => {
    rl.question('', (a) => {
      rl.close();
      process.stdout.write('\n');
      resolve(a);
    });
  });
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  let email = flags.email || (await ask('Email: '));
  email = email.toLowerCase().trim();
  if (!email) throw new Error('email is required');

  let name = flags.name || (await ask('Display name: '));
  if (!name) throw new Error('name is required');

  let role = (flags.role || (await ask(`Role (${ROLES.join(' | ')}): `))).toLowerCase();
  if (!ROLES.includes(role)) throw new Error(`role must be one of: ${ROLES.join(', ')}`);

  let password = flags.password || (await askPassword('Password: '));
  if (!password || password.length < 6) throw new Error('password must be at least 6 characters');

  const passwordHash = bcrypt.hashSync(password, 10);

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('users')
      .update({ name, role, password_hash: passwordHash })
      .eq('id', existing.id);
    if (error) throw error;
    console.log(`✔ updated user ${email} (role=${role})`);
  } else {
    const { error } = await supabase
      .from('users')
      .insert({ email, name, role, password_hash: passwordHash });
    if (error) throw error;
    console.log(`✔ created user ${email} (role=${role})`);
  }
}

main().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
