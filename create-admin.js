/**
 * Quick Admin User Creation Script
 * Non-interactive version for automation
 */

import { AuthService } from './dist/services/AuthService.js';

const email = 'admin@auto-work-analyzer.local';
const password = 'Admin123!';
const fullName = 'System Administrator';

console.log('\n🔐 Creating Admin User...\n');
console.log('========================================');

const authService = new AuthService();

try {
  const result = await authService.register({
    email,
    password,
    fullName,
    role: 'admin',
  });

  authService.close();

  if (!result.success) {
    console.error(`\n❌ Failed: ${result.error}`);
    process.exit(1);
  }

  console.log('\n✅ Admin user created successfully!');
  console.log('\n========================================');
  console.log('Admin Credentials:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('========================================\n');
  console.log('⚠️  IMPORTANT: Change this password after first login!\n');
  console.log('You can now start the servers:');
  console.log('  Backend:  npm run webhook');
  console.log('  Frontend: cd ui && npm run dev\n');

  process.exit(0);
} catch (error) {
  console.error('\n❌ Error:', error.message);
  authService.close();
  process.exit(1);
}
