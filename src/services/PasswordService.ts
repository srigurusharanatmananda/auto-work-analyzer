/**
 * Password Service
 * Handles secure password hashing and verification
 * Following OWASP 2025 recommendations
 *
 * Uses bcrypt with work factor 12 (OWASP recommends minimum 10)
 */

import bcrypt from 'bcryptjs';

export class PasswordService {
  // Work factor (cost parameter) - higher is more secure but slower
  // OWASP recommends minimum 10, we use 12 for better security
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a password securely
   * Uses bcrypt with automatic salt generation
   *
   * @param password - Plain text password
   * @returns Promise<string> - Hashed password
   */
  static async hash(password: string): Promise<string> {
    if (!password || password.length === 0) {
      throw new Error('Password cannot be empty');
    }

    // bcrypt automatically generates a unique salt for each hash
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   * Uses constant-time comparison to prevent timing attacks
   *
   * @param password - Plain text password
   * @param hash - Hashed password from database
   * @returns Promise<boolean> - True if password matches
   */
  static async verify(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }

    try {
      // bcrypt.compare uses constant-time comparison
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Validate password strength
   * Following OWASP recommendations:
   * - Minimum 8 characters (we recommend 12+)
   * - Maximum 128 characters (to prevent DoS via bcrypt)
   * - No complexity requirements (allows passphrases)
   *
   * @param password - Password to validate
   * @returns Object with isValid boolean and error message
   */
  static validateStrength(password: string): { isValid: boolean; error?: string } {
    if (!password) {
      return { isValid: false, error: 'Password is required' };
    }

    // Minimum length
    if (password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters long' };
    }

    // Maximum length (bcrypt has 72 byte limit, we set lower for safety)
    if (password.length > 128) {
      return { isValid: false, error: 'Password must not exceed 128 characters' };
    }

    // Check for common weak passwords (you can extend this list)
    const commonWeakPasswords = [
      'password',
      'password123',
      '12345678',
      'qwerty123',
      'admin123',
      'letmein',
    ];

    if (commonWeakPasswords.includes(password.toLowerCase())) {
      return { isValid: false, error: 'This password is too common. Please choose a stronger password' };
    }

    // Optional: Check for at least one number or special character (soft requirement)
    // OWASP now recommends against strict composition rules, but this is a soft check
    const hasNumberOrSpecial = /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    if (!hasNumberOrSpecial) {
      // This is just a warning, not a hard requirement
      console.warn('Password lacks numbers or special characters - consider using a stronger password');
    }

    return { isValid: true };
  }

  /**
   * Generate a secure random password
   * Useful for temporary passwords or password reset
   *
   * @param length - Length of password (default 16)
   * @returns string - Random secure password
   */
  static generateRandomPassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';

    // Use crypto.randomBytes for secure random generation
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      const randomIndex = randomBytes[i] % charset.length;
      password += charset[randomIndex];
    }

    return password;
  }
}
