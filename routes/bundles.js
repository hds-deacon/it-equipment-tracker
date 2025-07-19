const express = require('express');
const db = require('../database/db');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all bundles
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', active = '1' } = req.query;
    
    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];

    if (search) {
      whereConditions.push('(b.name LIKE ? OR b.description LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    if (active !== 'all') {
      whereConditions.push('b.active = ?');
      queryParams.push(active);
    }

    let query = `
      SELECT 
        b.*,
        COUNT(bc.equipment_id) as equipment_count,
        CASE 
          WHEN bt.bundle_id IS NOT NULL AND bt.returned_date IS NULL THEN 'checked_out'
          ELSE 'available'
        END as status,
        emp.first_name || ' ' || emp.last_name as checked_out_to
      FROM bundles b
      LEFT JOIN bundle_contents bc ON b.id = bc.bundle_id
      LEFT JOIN (
        SELECT DISTINCT bundle_id, employee_id, returned_date
        FROM bundle_transactions 
        WHERE transaction_type = 'checkout' AND returned_date IS NULL
      ) bt ON b.id = bt.bundle_id
      LEFT JOIN employees emp ON bt.employee_id = emp.id
    `;

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' GROUP BY b.id ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const bundles = await db.query(query, queryParams);

    res.json({ bundles });
  } catch (error) {
    console.error('Bundles fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single bundle
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const bundle = await db.get(`
      SELECT 
        b.*,
        CASE 
          WHEN bt.bundle_id IS NOT NULL AND bt.returned_date IS NULL THEN 'checked_out'
          ELSE 'available'
        END as status,
        emp.first_name || ' ' || emp.last_name as checked_out_to,
        bt.location as current_location,
        bt.due_date
      FROM bundles b
      LEFT JOIN (
        SELECT DISTINCT bundle_id, employee_id, location, due_date, returned_date
        FROM bundle_transactions 
        WHERE transaction_type = 'checkout' AND returned_date IS NULL
      ) bt ON b.id = bt.bundle_id
      LEFT JOIN employees emp ON bt.employee_id = emp.id
      WHERE b.id = ?
    `, [id]);

    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // Get bundle contents
    const contents = await db.query(`
      SELECT 
        bc.*,
        e.asset_tag,
        e.manufacturer,
        e.make,
        e.model,
        e.serial_number,
        c.name as category_name,
        CASE 
          WHEN et.equipment_id IS NOT NULL AND et.returned_date IS NULL THEN 'checked_out'
          ELSE 'available'
        END as equipment_status
      FROM bundle_contents bc
      JOIN equipment e ON bc.equipment_id = e.id
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      LEFT JOIN (
        SELECT DISTINCT equipment_id, returned_date
        FROM equipment_transactions 
        WHERE transaction_type = 'checkout' AND returned_date IS NULL
      ) et ON e.id = et.equipment_id
      WHERE bc.bundle_id = ?
      ORDER BY e.asset_tag
    `, [id]);

    res.json({ bundle, contents });
  } catch (error) {
    console.error('Bundle fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create bundle
router.post('/', authenticateToken, logActivity('bundle_created', 'bundle'), async (req, res) => {
  try {
    const { name, description, bundle_type, equipment_ids = [] } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Bundle name is required' });
    }

    // Create bundle
    const result = await db.insert(`
      INSERT INTO bundles (name, description, bundle_type)
      VALUES (?, ?, ?)
    `, [name, description, bundle_type]);

    // Add equipment to bundle
    for (const equipmentId of equipment_ids) {
      await db.insert(`
        INSERT INTO bundle_contents (bundle_id, equipment_id)
        VALUES (?, ?)
      `, [result.id, equipmentId]);
    }

    // Get created bundle
    const bundle = await db.get('SELECT * FROM bundles WHERE id = ?', [result.id]);

    res.status(201).json({
      message: 'Bundle created successfully',
      bundle
    });
  } catch (error) {
    console.error('Bundle creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update bundle
router.put('/:id', authenticateToken, logActivity('bundle_updated', 'bundle'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, bundle_type, equipment_ids = [] } = req.body;

    const existingBundle = await db.get('SELECT * FROM bundles WHERE id = ?', [id]);
    if (!existingBundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    req.body.oldValues = existingBundle;

    // Update bundle
    await db.run(`
      UPDATE bundles 
      SET name = ?, description = ?, bundle_type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description, bundle_type, id]);

    // Update bundle contents
    await db.run('DELETE FROM bundle_contents WHERE bundle_id = ?', [id]);
    
    for (const equipmentId of equipment_ids) {
      await db.insert(`
        INSERT INTO bundle_contents (bundle_id, equipment_id)
        VALUES (?, ?)
      `, [id, equipmentId]);
    }

    const bundle = await db.get('SELECT * FROM bundles WHERE id = ?', [id]);

    res.json({
      message: 'Bundle updated successfully',
      bundle
    });
  } catch (error) {
    console.error('Bundle update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete bundle
router.delete('/:id', authenticateToken, logActivity('bundle_deleted', 'bundle'), async (req, res) => {
  try {
    const { id } = req.params;

    const bundle = await db.get('SELECT * FROM bundles WHERE id = ?', [id]);
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // Check if bundle is checked out
    const checkedOut = await db.get(`
      SELECT id FROM bundle_transactions 
      WHERE bundle_id = ? AND transaction_type = 'checkout' AND returned_date IS NULL
    `, [id]);

    if (checkedOut) {
      return res.status(400).json({ error: 'Cannot delete bundle that is currently checked out' });
    }

    // Soft delete
    await db.run('UPDATE bundles SET active = 0 WHERE id = ?', [id]);

    res.json({ message: 'Bundle deleted successfully' });
  } catch (error) {
    console.error('Bundle deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;