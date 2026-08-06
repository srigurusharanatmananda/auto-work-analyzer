/**
 * Setup Admin User Script
 * Creates the initial admin user for the system
 */

import * as readline from 'readline';
import { AuthService } from '../services/AuthService.js';
import { PasswordService } from '../services/PasswordService.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

async function setupAdmin() {
  console.log('\n🔐 Auto Work Analyzer - Admin Setup\n');
  console.log('========================================\n');

  try {
    // Check if users already exist
    const authService = new AuthService();
    const { AuthDatabaseService } = await import('../services/AuthDatabaseService.js');
    const db = new AuthDatabaseService();
    const existingUsers = await db.getAllUsers(1, 0);

    if (existingUsers.length > 0) {
      console.log('⚠️  Users already exist in the system.');
      const proceed = await question('Do you want to create another admin user? (y/n): ');

      if (proceed.toLowerCase() !== 'y') {
        console.log('\n❌ Setup cancelled.');
        db.close();
        authService.close();
        rl.close();
        process.exit(0);
      }
    }

    db.close();

    // Get admin details
    const email = await question('\nAdmin Email: ');
    if (!email || !email.includes('@')) {
      console.error('\n❌ Invalid email address.');
      authService.close();
      rl.close();
      process.exit(1);
    }

    const fullName = await question('Full Name: ');
    if (!fullName || fullName.trim().length === 0) {
      console.error('\n❌ Full name is required.');
      authService.close();
      rl.close();
      process.exit(1);
    }

    let password = await question('Password (leave empty for auto-generated): ');
    let generatedPassword = false;

    if (!password || password.trim().length === 0) {
      password = PasswordService.generateRandomPassword(16);
      generatedPassword = true;
      console.log(`\n✅ Generated secure password: ${password}`);
      console.log('⚠️  IMPORTANT: Save this password securely!\n');
    } else {
      // Validate password
      const validation = PasswordService.validateStrength(password);
      if (!validation.isValid) {
        console.error(`\n❌ ${validation.error}`);
        authService.close();
        rl.close();
        process.exit(1);
      }
    }

    // Create admin user
    console.log('\n🔄 Creating admin user...');

    const result = await authService.register({
      email,
      password,
      fullName,
      role: 'admin',
    });

    authService.close();

    if (!result.success) {
      console.error(`\n❌ Failed to create admin user: ${result.error}`);
      rl.close();
      process.exit(1);
    }

    console.log('\n✅ Admin user created successfully!');
    console.log('\n========================================');
    console.log('Admin Credentials:');
    console.log(`  Email:    ${email}`);
    if (generatedPassword) {
      console.log(`  Password: ${password}`);
      console.log('\n⚠️  SAVE THIS PASSWORD - it will not be shown again!');
    }
    console.log('========================================\n');

    console.log('You can now start the server and login with these credentials.');
    console.log('Run: npm run webhook\n');

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    rl.close();
    process.exit(1);
  }
}

setupAdmin();
