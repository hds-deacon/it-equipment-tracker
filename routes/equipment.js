const express = require('express');
const db = require('../database/db');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all equipment with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      category = '',
      condition = '',
      active = '1',
      tags = ''
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];

    // Build WHERE clause
    if (search) {
      whereConditions.push(`(
        e.asset_tag LIKE ? OR 
        e.manufacturer LIKE ? OR 
        e.make LIKE ? OR 
        e.model LIKE ? OR 
        e.serial_number LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (category) {
      whereConditions.push('e.category_id = ?');
      queryParams.push(category);
    }

    if (condition) {
      whereConditions.push('e.condition = ?');
      queryParams.push(condition);
    }

    if (active !== 'all') {
      whereConditions.push('e.active = ?');
      queryParams.push(active);
    }

    let query = `
      SELECT DISTINCT
        e.*,
        c.name as category_name,
        GROUP_CONCAT(t.name) as tags,
        CASE 
          WHEN et.equipment_id IS NOT NULL AND et.returned_date IS NULL THEN 'checked_out'
          ELSE 'available'
        END as status,
        emp.first_name || ' ' || emp.last_name as checked_out_to,
        et.location as current_location,
        et.due_date
      FROM equipment e
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      LEFT JOIN equipment_tag_assignments eta ON e.id = eta.equipment_id
      LEFT JOIN equipment_tags t ON eta.tag_id = t.id
      LEFT JOIN (
        SELECT DISTINCT equipment_id, employee_id, location, due_date, returned_date
        FROM equipment_transactions 
        WHERE transaction_type = 'checkout' AND returned_date IS NULL
      ) et ON e.id = et.equipment_id
      LEFT JOIN employees emp ON et.employee_id = emp.id
    `;

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Handle tag filtering
    if (tags) {
      const tagList = tags.split(',').map(tag => tag.trim());
      query += whereConditions.length > 0 ? ' AND ' : ' WHERE ';
      query += `e.id IN (
        SELECT equipment_id 
        FROM equipment_tag_assignments eta
        JOIN equipment_tags t ON eta.tag_id = t.id
        WHERE t.name IN (${tagList.map(() => '?').join(',')})
      )`;
      queryParams.push(...tagList);
    }

    query += ' GROUP BY e.id ORDER BY e.created_at DESC';

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const equipment = await db.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM equipment e
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      LEFT JOIN equipment_tag_assignments eta ON e.id = eta.equipment_id
      LEFT JOIN equipment_tags t ON eta.tag_id = t.id
    `;

    if (whereConditions.length > 0) {
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await db.get(countQuery, countParams);
    const total = countResult.total;

    res.json({
      equipment,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Equipment fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single equipment item
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const equipment = await db.get(`
      SELECT 
        e.*,
        c.name as category_name,
        GROUP_CONCAT(t.name) as tags,
        CASE 
          WHEN et.equipment_id IS NOT NULL AND et.returned_date IS NULL THEN 'checked_out'
          ELSE 'available'
        END as status,
        emp.first_name || ' ' || emp.last_name as checked_out_to,
        et.location as current_location,
        et.due_date
      FROM equipment e
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      LEFT JOIN equipment_tag_assignments eta ON e.id = eta.equipment_id
      LEFT JOIN equipment_tags t ON eta.tag_id = t.id
      LEFT JOIN (
        SELECT DISTINCT equipment_id, employee_id, location, due_date, returned_date
        FROM equipment_transactions 
        WHERE transaction_type = 'checkout' AND returned_date IS NULL
      ) et ON e.id = et.equipment_id
      LEFT JOIN employees emp ON et.employee_id = emp.id
      WHERE e.id = ?
      GROUP BY e.id
    `, [id]);

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Get equipment files
    const files = await db.query(`
      SELECT id, file_name, file_type, file_size, uploaded_at
      FROM equipment_files
      WHERE equipment_id = ?
      ORDER BY uploaded_at DESC
    `, [id]);

    // Get transaction history
    const transactions = await db.query(`
      SELECT 
        t.*,
        emp.first_name || ' ' || emp.last_name as employee_name,
        emp.email as employee_email,
        adm.name as processed_by_name
      FROM equipment_transactions t
      LEFT JOIN employees emp ON t.employee_id = emp.id
      LEFT JOIN admins adm ON t.processed_by = adm.id
      WHERE t.equipment_id = ?
      ORDER BY t.processed_at DESC
    `, [id]);

    res.json({
      equipment,
      files,
      transactions
    });
  } catch (error) {
    console.error('Equipment fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new equipment
router.post('/', authenticateToken, logActivity('equipment_created', 'equipment'), async (req, res) => {
  try {
    const {
      category_id,
      manufacturer,
      make,
      model,
      serial_number,
      purchase_date,
      purchase_cost,
      job_code,
      cost_code,
      condition,
      warranty_start_date,
      warranty_end_date,
      warranty_provider,
      notes,
      tags = []
    } = req.body;

    // Validate required fields
    if (!manufacturer || !make || !model || !serial_number) {
      return res.status(400).json({ error: 'Manufacturer, make, model, and serial number are required' });
    }

    // Check for duplicate serial number
    const existingEquipment = await db.get(
      'SELECT id FROM equipment WHERE serial_number = ?',
      [serial_number]
    );

    if (existingEquipment) {
      return res.status(400).json({ error: 'Equipment with this serial number already exists' });
    }

    // Generate unique asset tag
    const assetTag = await db.generateAssetTag();

    // Create equipment
    const result = await db.insert(`
      INSERT INTO equipment (
        asset_tag, category_id, manufacturer, make, model, serial_number,
        purchase_date, purchase_cost, job_code, cost_code, condition,
        warranty_start_date, warranty_end_date, warranty_provider, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      assetTag, category_id, manufacturer, make, model, serial_number,
      purchase_date, purchase_cost, job_code, cost_code, condition,
      warranty_start_date, warranty_end_date, warranty_provider, notes
    ]);

    // Add tags if provided
    if (tags.length > 0) {
      for (const tagId of tags) {
        await db.insert(
          'INSERT INTO equipment_tag_assignments (equipment_id, tag_id) VALUES (?, ?)',
          [result.id, tagId]
        );
      }
    }

    // Get the created equipment with related data
    const equipment = await db.get(`
      SELECT 
        e.*,
        c.name as category_name,
        GROUP_CONCAT(t.name) as tags
      FROM equipment e
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      LEFT JOIN equipment_tag_assignments eta ON e.id = eta.equipment_id
      LEFT JOIN equipment_tags t ON eta.tag_id = t.id
      WHERE e.id = ?
      GROUP BY e.id
    `, [result.id]);

    res.status(201).json({
      message: 'Equipment created successfully',
      equipment
    });
  } catch (error) {
    console.error('Equipment creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update equipment
router.put('/:id', authenticateToken, logActivity('equipment_updated', 'equipment'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      manufacturer,
      make,
      model,
      serial_number,
      purchase_date,
      purchase_cost,
      job_code,
      cost_code,
      condition,
      warranty_start_date,
      warranty_end_date,
      warranty_provider,
      notes,
      tags = []
    } = req.body;

    // Check if equipment exists
    const existingEquipment = await db.get('SELECT * FROM equipment WHERE id = ?', [id]);
    if (!existingEquipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Check for duplicate serial number (excluding current equipment)
    const duplicateSerial = await db.get(
      'SELECT id FROM equipment WHERE serial_number = ? AND id != ?',
      [serial_number, id]
    );

    if (duplicateSerial) {
      return res.status(400).json({ error: 'Equipment with this serial number already exists' });
    }

    // Store old values for audit log
    req.body.oldValues = existingEquipment;

    // Update equipment
    await db.run(`
      UPDATE equipment SET
        category_id = ?, manufacturer = ?, make = ?, model = ?, serial_number = ?,
        purchase_date = ?, purchase_cost = ?, job_code = ?, cost_code = ?, condition = ?,
        warranty_start_date = ?, warranty_end_date = ?, warranty_provider = ?, notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      category_id, manufacturer, make, model, serial_number,
      purchase_date, purchase_cost, job_code, cost_code, condition,
      warranty_start_date, warranty_end_date, warranty_provider, notes, id
    ]);

    // Update tags - remove existing and add new ones
    await db.run('DELETE FROM equipment_tag_assignments WHERE equipment_id = ?', [id]);
    
    if (tags.length > 0) {
      for (const tagId of tags) {
        await db.insert(
          'INSERT INTO equipment_tag_assignments (equipment_id, tag_id) VALUES (?, ?)',
          [id, tagId]
        );
      }
    }

    // Get updated equipment
    const equipment = await db.get(`
      SELECT 
        e.*,
        c.name as category_name,
        GROUP_CONCAT(t.name) as tags
      FROM equipment e
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      LEFT JOIN equipment_tag_assignments eta ON e.id = eta.equipment_id
      LEFT JOIN equipment_tags t ON eta.tag_id = t.id
      WHERE e.id = ?
      GROUP BY e.id
    `, [id]);

    res.json({
      message: 'Equipment updated successfully',
      equipment
    });
  } catch (error) {
    console.error('Equipment update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete equipment (soft delete)
router.delete('/:id', authenticateToken, logActivity('equipment_deleted', 'equipment'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if equipment exists
    const equipment = await db.get('SELECT * FROM equipment WHERE id = ?', [id]);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Check if equipment is currently checked out
    const checkedOut = await db.get(`
      SELECT id FROM equipment_transactions 
      WHERE equipment_id = ? AND transaction_type = 'checkout' AND returned_date IS NULL
    `, [id]);

    if (checkedOut) {
      return res.status(400).json({ error: 'Cannot delete equipment that is currently checked out' });
    }

    // Soft delete - set active to 0
    await db.run('UPDATE equipment SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    res.json({ message: 'Equipment deleted successfully' });
  } catch (error) {
    console.error('Equipment deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get equipment categories
router.get('/categories/all', authenticateToken, async (req, res) => {
  try {
    const categories = await db.query('SELECT * FROM equipment_categories ORDER BY name');
    res.json({ categories });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get equipment tags
router.get('/tags/all', authenticateToken, async (req, res) => {
  try {
    const tags = await db.query('SELECT * FROM equipment_tags ORDER BY name');
    res.json({ tags });
  } catch (error) {
    console.error('Tags fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;