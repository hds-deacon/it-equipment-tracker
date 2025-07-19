const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify admin still exists and is active
    const admin = await db.get(
      'SELECT id, email, name, active FROM admins WHERE id = ? AND active = 1',
      [decoded.id]
    );

    if (!admin) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to log admin activities
const logActivity = (action, entityType = null) => {
  return async (req, res, next) => {
    // Store original res.json to capture response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log the activity after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAdminActivity(req.admin.id, action, entityType, req, data);
      }
      originalJson.call(this, data);
    };
    
    next();
  };
};

// Function to log admin activities
const logAdminActivity = async (adminId, action, entityType, req, responseData) => {
  try {
    const entityId = responseData?.id || req.params?.id || null;
    const oldValues = req.body?.oldValues || null;
    const newValues = req.body || null;
    
    await db.insert(`
      INSERT INTO activity_log (admin_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      adminId,
      action,
      entityType,
      entityId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent') || 'Unknown'
    ]);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

module.exports = {
  authenticateToken,
  logActivity,
  logAdminActivity,
  JWT_SECRET
};