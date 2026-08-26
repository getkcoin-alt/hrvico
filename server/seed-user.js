import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db, { initDb } from './src/db.js';

async function seedUser() {
  await initDb();

  const email = 'karnveer@scriza.in';
  const rawPassword = process.env.SEED_PASSWORD || 'Karnveer@2026';
  const mobile = '+919876543210';
  const fullName = 'Karnveer Singh';

  console.log(`\n🌱 Seeding user: ${email}...`);

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    console.log(`⚠️ User ${email} already exists! Updating status & password...`);
    const newHash = await bcrypt.hash(rawPassword, 10);
    await db.prepare(`
      UPDATE users
      SET password_hash = ?, status = 'ACTIVE', email_verified_at = CURRENT_TIMESTAMP
      WHERE email = ?
    `).run(newHash, email);
    console.log(`✅ User ${email} updated successfully!`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${rawPassword}\n`);
    process.exit(0);
  }

  const tenantId = uuidv4();
  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const tenantName = "Karnveer's Restaurant Group";

  await db.prepare('INSERT INTO tenants (id, name, status) VALUES (?, ?, ?)').run(tenantId, tenantName, 'ACTIVE');

  await db.prepare(`
    INSERT INTO users (id, tenant_id, role, full_name, email, mobile, password_hash, status, email_verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(userId, tenantId, 'OWNER', fullName, email, mobile, passwordHash, 'ACTIVE');

  // Add initial restaurant for Karnveer
  const restaurantId = uuidv4();
  await db.prepare(`
    INSERT INTO restaurants (
      id, tenant_id, restaurant_code, name, business_type, mobile, email,
      address_line, city, state, country, pincode, status, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    restaurantId, tenantId, 'RV-R0001', 'RestroVico Flagship', 'Restaurant', mobile, email,
    'Connaught Place', 'New Delhi', 'Delhi', 'IN', '110001', 'ACTIVE', userId, userId
  );

  console.log(`\n✅ Created User and Restaurant successfully!`);
  console.log(`   Owner Email:    ${email}`);
  console.log(`   Owner Password: ${rawPassword}`);
  console.log(`   Mobile:         ${mobile}`);
  console.log(`   Tenant ID:      ${tenantId}`);
  console.log(`   Restaurant:     RestroVico Flagship (RV-R0001)\n`);
  process.exit(0);
}

seedUser().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
