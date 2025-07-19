const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticateToken, logAdminActivity, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Register new admin (protected route - only existing admins can create new ones)
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if admin already exists
    const existingAdmin = await db.get('SELECT id FROM admins WHERE email = ?', [email]);
    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin with this email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new admin
    const result = await db.insert(
      'INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)',
      [email, passwordHash, name]
    );

    // Log activity
    await logAdminActivity(req.admin.id, 'admin_created', 'admin', null, { id: result.id, email, name });

    res.status(201).json({
      message: 'Admin created successfully',
      admin: { id: result.id, email, name }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find admin
    const admin = await db.get(
      'SELECT id, email, name, password_hash, active FROM admins WHERE email = ?',
      [email]
    );

    if (!admin || !admin.active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log login activity
    await logAdminActivity(admin.id, 'login', 'admin', null, null);

    res.json({
      message: 'Login successful',
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current admin profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const admin = await db.get(
      'SELECT id, email, name, created_at, last_login FROM admins WHERE id = ?',
      [req.admin.id]
    );

    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    res.json({ admin });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update admin profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Get current admin data
    const currentAdmin = await db.get(
      'SELECT email, name, password_hash FROM admins WHERE id = ?',
      [req.admin.id]
    );

    let updateFields = [];
    let updateValues = [];

    // Check if email is changing and not taken by another admin
    if (email !== currentAdmin.email) {
      const existingAdmin = await db.get(
        'SELECT id FROM admins WHERE email = ? AND id != ?',
        [email, req.admin.id]
      );
      if (existingAdmin) {
        return res.status(400).json({ error: 'Email already in use by another admin' });
      }
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    // Update name if changed
    if (name !== currentAdmin.name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required to change password' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, currentAdmin.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);
      updateFields.push('password_hash = ?');
      updateValues.push(passwordHash);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No changes detected' });
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(req.admin.id);

    // Update admin
    await db.run(
      `UPDATE admins SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Log activity
    await logAdminActivity(req.admin.id, 'profile_updated', 'admin', req.admin.id, { email, name });

    res.json({
      message: 'Profile updated successfully',
      admin: { id: req.admin.id, email, name }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (client-side token removal, but we can log the activity)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Log logout activity
    await logAdminActivity(req.admin.id, 'logout', 'admin', req.admin.id, null);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all admins (protected route)
router.get('/admins', authenticateToken, async (req, res) => {
  try {
    const admins = await db.query(`
      SELECT id, email, name, created_at, last_login, active
      FROM admins
      ORDER BY created_at DESC
    `);

    res.json({ admins });
  } catch (error) {
    console.error('Admins fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate admin
router.put('/admins/:id/deactivate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.admin.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const admin = await db.get('SELECT id, email, name FROM admins WHERE id = ?', [id]);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    await db.run('UPDATE admins SET active = 0 WHERE id = ?', [id]);

    // Log activity
    await logAdminActivity(req.admin.id, 'admin_deactivated', 'admin', id, admin);

    res.json({ message: 'Admin deactivated successfully' });
  } catch (error) {
    console.error('Admin deactivation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;