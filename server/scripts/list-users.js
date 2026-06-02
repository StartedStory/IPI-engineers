// List all IPI users (no password hashes).
//
//   npm --prefix server run user:list

import 'dotenv/config';
import { supabase } from '../src/supabase.js';

const { data, error } = await supabase
  .from('users')
  .select('id, name, email, role, created_at')
  .order('role')
  .order('email');

if (error) {
  console.error(error);
  process.exit(1);
}

if (!data.length) {
  console.log('(no users yet — run `npm run seed` or `npm run user:add`)');
  process.exit(0);
}

const colW = {
  role: Math.max(4, ...data.map((u) => u.role.length)),
  email: Math.max(5, ...data.map((u) => u.email.length)),
  name: Math.max(4, ...data.map((u) => u.name.length)),
};

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('ROLE', colW.role)}  ${pad('EMAIL', colW.email)}  ${pad('NAME', colW.name)}`);
console.log('-'.repeat(colW.role + colW.email + colW.name + 4));
for (const u of data) {
  console.log(`${pad(u.role, colW.role)}  ${pad(u.email, colW.email)}  ${pad(u.name, colW.name)}`);
}
