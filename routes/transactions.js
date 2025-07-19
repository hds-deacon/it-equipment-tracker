const express = require('express');
const db = require('../database/db');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get all transactions with filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      type = 'all',
      status = 'all',
      employee_id = '',
      equipment_id = '',
      start_date = '',
      end_date = ''
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];

    // Build WHERE clause
    if (type !== 'all') {
      whereConditions.push('t.transaction_type = ?');
      queryParams.push(type);
    }

    if (status === 'active') {
      whereConditions.push('t.transaction_type = "checkout" AND t.returned_date IS NULL');
    } else if (status === 'returned') {
      whereConditions.push('t.transaction_type = "checkin" OR t.returned_date IS NOT NULL');
    }

    if (employee_id) {
      whereConditions.push('t.employee_id = ?');
      queryParams.push(employee_id);
    }

    if (equipment_id) {
      whereConditions.push('t.equipment_id = ?');
      queryParams.push(equipment_id);
    }

    if (start_date) {
      whereConditions.push('DATE(t.processed_at) >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('DATE(t.processed_at) <= ?');
      queryParams.push(end_date);
    }

    let query = `
      SELECT 
        t.*,
        e.asset_tag,
        e.manufacturer,
        e.make,
        e.model,
        e.serial_number,
        c.name as category_name,
        emp.first_name || ' ' || emp.last_name as employee_name,
        emp.email as employee_email,
        emp.department,
        adm.name as processed_by_name
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      JOIN employees emp ON t.employee_id = emp.id
      LEFT JOIN admins adm ON t.processed_by = adm.id
    `;

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' ORDER BY t.processed_at DESC';

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const transactions = await db.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      JOIN employees emp ON t.employee_id = emp.id
    `;

    if (whereConditions.length > 0) {
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await db.get(countQuery, countParams);
    const total = countResult.total;

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Checkout equipment
router.post('/checkout', authenticateToken, logActivity('equipment_checkout', 'transaction'), async (req, res) => {
  try {
    const {
      equipment_id,
      employee_id,
      location,
      due_date,
      condition_out,
      notes
    } = req.body;

    // Validate required fields
    if (!equipment_id || !employee_id) {
      return res.status(400).json({ error: 'Equipment ID and Employee ID are required' });
    }

    // Check if equipment exists and is available
    const equipment = await db.get(`
      SELECT e.*, 
        CASE 
          WHEN t.equipment_id IS NOT NULL AND t.returned_date IS NULL THEN 'checked_out'
          ELSE 'available'
        END as status
      FROM equipment e
      LEFT JOIN equipment_transactions t ON e.id = t.equipment_id 
        AND t.transaction_type = 'checkout' AND t.returned_date IS NULL
      WHERE e.id = ? AND e.active = 1
    `, [equipment_id]);

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found or inactive' });
    }

    if (equipment.status === 'checked_out') {
      return res.status(400).json({ error: 'Equipment is already checked out' });
    }

    // Check if employee exists and is active
    const employee = await db.get('SELECT * FROM employees WHERE id = ? AND active = 1', [employee_id]);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found or inactive' });
    }

    // Create checkout transaction
    const result = await db.insert(`
      INSERT INTO equipment_transactions (
        equipment_id, employee_id, transaction_type, location, due_date, 
        condition_out, notes, processed_by
      ) VALUES (?, ?, 'checkout', ?, ?, ?, ?, ?)
    `, [equipment_id, employee_id, location, due_date, condition_out, notes, req.admin.id]);

    // Get the created transaction with related data
    const transaction = await db.get(`
      SELECT 
        t.*,
        e.asset_tag,
        e.manufacturer,
        e.make,
        e.model,
        emp.first_name || ' ' || emp.last_name as employee_name,
        emp.email as employee_email
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      JOIN employees emp ON t.employee_id = emp.id
      WHERE t.id = ?
    `, [result.id]);

    res.status(201).json({
      message: 'Equipment checked out successfully',
      transaction
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check in equipment
router.post('/checkin', authenticateToken, logActivity('equipment_checkin', 'transaction'), async (req, res) => {
  try {
    const {
      equipment_id,
      employee_id,
      condition_in,
      notes
    } = req.body;

    // Validate required fields
    if (!equipment_id || !employee_id) {
      return res.status(400).json({ error: 'Equipment ID and Employee ID are required' });
    }

    // Find the active checkout transaction
    const checkoutTransaction = await db.get(`
      SELECT t.*, e.asset_tag, e.manufacturer, e.make, e.model
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      WHERE t.equipment_id = ? AND t.employee_id = ? 
        AND t.transaction_type = 'checkout' AND t.returned_date IS NULL
      ORDER BY t.processed_at DESC
      LIMIT 1
    `, [equipment_id, employee_id]);

    if (!checkoutTransaction) {
      return res.status(400).json({ error: 'No active checkout found for this equipment and employee' });
    }

    // Update the checkout transaction with return information
    await db.run(`
      UPDATE equipment_transactions 
      SET returned_date = CURRENT_TIMESTAMP, condition_in = ?, notes = ?
      WHERE id = ?
    `, [condition_in, notes, checkoutTransaction.id]);

    // Create a checkin transaction record
    const result = await db.insert(`
      INSERT INTO equipment_transactions (
        equipment_id, employee_id, transaction_type, condition_in, notes, processed_by
      ) VALUES (?, ?, 'checkin', ?, ?, ?)
    `, [equipment_id, employee_id, condition_in, notes, req.admin.id]);

    // Update equipment condition if provided
    if (condition_in) {
      await db.run('UPDATE equipment SET condition = ? WHERE id = ?', [condition_in, equipment_id]);
    }

    // Get the created transaction with related data
    const transaction = await db.get(`
      SELECT 
        t.*,
        e.asset_tag,
        e.manufacturer,
        e.make,
        e.model,
        emp.first_name || ' ' || emp.last_name as employee_name,
        emp.email as employee_email
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      JOIN employees emp ON t.employee_id = emp.id
      WHERE t.id = ?
    `, [result.id]);

    res.json({
      message: 'Equipment checked in successfully',
      transaction
    });
  } catch (error) {
    console.error('Checkin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Quick checkout by scanning QR code
router.post('/quick-checkout', authenticateToken, logActivity('equipment_quick_checkout', 'transaction'), async (req, res) => {
  try {
    const {
      asset_tag,
      employee_search,
      location,
      due_date,
      notes
    } = req.body;

    // Find equipment by asset tag
    const equipment = await db.get(`
      SELECT e.*, 
        CASE 
          WHEN t.equipment_id IS NOT NULL AND t.returned_date IS NULL THEN 'checked_out'
          ELSE 'available'
        END as status
      FROM equipment e
      LEFT JOIN equipment_transactions t ON e.id = t.equipment_id 
        AND t.transaction_type = 'checkout' AND t.returned_date IS NULL
      WHERE e.asset_tag = ? AND e.active = 1
    `, [asset_tag]);

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    if (equipment.status === 'checked_out') {
      return res.status(400).json({ error: 'Equipment is already checked out' });
    }

    // Find employee by search term (employee_id, email, or name)
    const employee = await db.get(`
      SELECT * FROM employees 
      WHERE active = 1 AND (
        employee_id = ? OR 
        email = ? OR 
        (first_name || ' ' || last_name) LIKE ?
      )
      LIMIT 1
    `, [employee_search, employee_search, `%${employee_search}%`]);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Create checkout transaction
    const result = await db.insert(`
      INSERT INTO equipment_transactions (
        equipment_id, employee_id, transaction_type, location, due_date, 
        condition_out, notes, processed_by
      ) VALUES (?, ?, 'checkout', ?, ?, ?, ?, ?)
    `, [equipment.id, employee.id, location, due_date, equipment.condition, notes, req.admin.id]);

    // Get the created transaction with related data
    const transaction = await db.get(`
      SELECT 
        t.*,
        e.asset_tag,
        e.manufacturer,
        e.make,
        e.model,
        emp.first_name || ' ' || emp.last_name as employee_name,
        emp.email as employee_email
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      JOIN employees emp ON t.employee_id = emp.id
      WHERE t.id = ?
    `, [result.id]);

    res.json({
      message: 'Equipment checked out successfully',
      transaction,
      equipment: {
        id: equipment.id,
        asset_tag: equipment.asset_tag,
        manufacturer: equipment.manufacturer,
        make: equipment.make,
        model: equipment.model
      },
      employee: {
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
        email: employee.email,
        employee_id: employee.employee_id
      }
    });
  } catch (error) {
    console.error('Quick checkout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Quick checkin by scanning QR code
router.post('/quick-checkin', authenticateToken, logActivity('equipment_quick_checkin', 'transaction'), async (req, res) => {
  try {
    const {
      asset_tag,
      condition_in,
      notes
    } = req.body;

    // Find equipment by asset tag
    const equipment = await db.get('SELECT * FROM equipment WHERE asset_tag = ? AND active = 1', [asset_tag]);

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Find the active checkout transaction
    const checkoutTransaction = await db.get(`
      SELECT t.*, emp.first_name || ' ' || emp.last_name as employee_name
      FROM equipment_transactions t
      JOIN employees emp ON t.employee_id = emp.id
      WHERE t.equipment_id = ? AND t.transaction_type = 'checkout' AND t.returned_date IS NULL
      ORDER BY t.processed_at DESC
      LIMIT 1
    `, [equipment.id]);

    if (!checkoutTransaction) {
      return res.status(400).json({ error: 'Equipment is not currently checked out' });
    }

    // Update the checkout transaction with return information
    await db.run(`
      UPDATE equipment_transactions 
      SET returned_date = CURRENT_TIMESTAMP, condition_in = ?, notes = ?
      WHERE id = ?
    `, [condition_in, notes, checkoutTransaction.id]);

    // Create a checkin transaction record
    const result = await db.insert(`
      INSERT INTO equipment_transactions (
        equipment_id, employee_id, transaction_type, condition_in, notes, processed_by
      ) VALUES (?, ?, 'checkin', ?, ?, ?)
    `, [equipment.id, checkoutTransaction.employee_id, condition_in, notes, req.admin.id]);

    // Update equipment condition if provided
    if (condition_in) {
      await db.run('UPDATE equipment SET condition = ? WHERE id = ?', [condition_in, equipment.id]);
    }

    res.json({
      message: 'Equipment checked in successfully',
      equipment: {
        id: equipment.id,
        asset_tag: equipment.asset_tag,
        manufacturer: equipment.manufacturer,
        make: equipment.make,
        model: equipment.model
      },
      employee: {
        name: checkoutTransaction.employee_name
      },
      checkout_date: checkoutTransaction.processed_at
    });
  } catch (error) {
    console.error('Quick checkin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get transaction by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await db.get(`
      SELECT 
        t.*,
        e.asset_tag,
        e.manufacturer,
        e.make,
        e.model,
        e.serial_number,
        c.name as category_name,
        emp.first_name || ' ' || emp.last_name as employee_name,
        emp.email as employee_email,
        emp.department,
        emp.employee_id,
        adm.name as processed_by_name
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      JOIN employees emp ON t.employee_id = emp.id
      LEFT JOIN admins adm ON t.processed_by = adm.id
      WHERE t.id = ?
    `, [id]);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction });
  } catch (error) {
    console.error('Transaction fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get overdue equipment
router.get('/overdue/all', authenticateToken, async (req, res) => {
  try {
    const overdueTransactions = await db.query(`
      SELECT 
        t.*,
        e.asset_tag,
        e.manufacturer,
        e.make,
        e.model,
        c.name as category_name,
        emp.first_name || ' ' || emp.last_name as employee_name,
        emp.email as employee_email,
        emp.department,
        julianday('now') - julianday(t.due_date) as days_overdue
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      JOIN employees emp ON t.employee_id = emp.id
      WHERE t.transaction_type = 'checkout' 
        AND t.returned_date IS NULL 
        AND t.due_date < date('now')
      ORDER BY t.due_date ASC
    `);

    res.json({ overdueTransactions });
  } catch (error) {
    console.error('Overdue transactions fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;