// Delete an IPI user by email.
//
//   npm --prefix server run user:delete -- --email someone@x.com

import 'dotenv/config';
import { supabase } from '../src/supabase.js';

const idx = process.argv.indexOf('--email');
const email = idx >= 0 ? process.argv[idx + 1] : null;
if (!email) {
  console.error('Usage: npm run user:delete -- --email someone@x.com');
  process.exit(1);
}

const { data, error } = await supabase
  .from('users')
  .delete()
  .ilike('email', email)
  .select('email');

if (error) {
  console.error(error);
  process.exit(1);
}

if (!data.length) console.log(`(no user with email "${email}")`);
else console.log(`✔ deleted ${data.length} user(s): ${data.map((u) => u.email).join(', ')}`);
