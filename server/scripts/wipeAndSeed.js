require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM "RoleRequest"');
    await client.query('DELETE FROM "Invitation"');
    await client.query('DELETE FROM "Issue"');
    await client.query('DELETE FROM "File"');
    await client.query('DELETE FROM "ProjectMember"');
    await client.query('DELETE FROM "Project"');
    await client.query('DELETE FROM "User"');

    console.log('All tables wiped.');

    const adminPassword = 'Admin@CoDev2026';
    const collabPassword = 'Collab@CoDev2026';

    const adminHash = await bcrypt.hash(adminPassword, 10);
    const collabHash = await bcrypt.hash(collabPassword, 10);

    const adminResult = await client.query(
      'INSERT INTO "User" (id, email, password, name) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id, email, name',
      ['admin@codev.test', adminHash, 'CoDev Admin']
    );
    const admin = adminResult.rows[0];

    const collabResult = await client.query(
      'INSERT INTO "User" (id, email, password, name) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id, email, name',
      ['collab@codev.test', collabHash, 'Test Collaborator']
    );
    const collab = collabResult.rows[0];

    const projectResult = await client.query(
      'INSERT INTO "Project" (id, name, "createdAt") VALUES (gen_random_uuid(), $1, NOW()) RETURNING id, name',
      ['Phase10 War Room']
    );
    const project = projectResult.rows[0];

    await client.query(
      'INSERT INTO "ProjectMember" (id, "userId", "projectId", "roleName") VALUES (gen_random_uuid(), $1, $2, $3)',
      [admin.id, project.id, 'Admin']
    );

    await client.query(
      'INSERT INTO "ProjectMember" (id, "userId", "projectId", "roleName") VALUES (gen_random_uuid(), $1, $2, $3)',
      [collab.id, project.id, 'Collaborator']
    );

    console.log('Seed complete.');
    console.log('Admin:', admin.email, '| Password:', adminPassword);
    console.log('Collaborator:', collab.email, '| Password:', collabPassword);
    console.log('Project ID:', project.id);

    const passwordsContent = `ADMIN\nEmail: ${admin.email}\nPassword: ${adminPassword}\n\nCOLLABORATOR\nEmail: ${collab.email}\nPassword: ${collabPassword}\n\nPROJECT\nID: ${project.id}\nName: ${project.name}\n`;
    fs.writeFileSync(path.join(__dirname, '../../passwords.txt'), passwordsContent, 'utf8');
    console.log('passwords.txt written to project root.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
