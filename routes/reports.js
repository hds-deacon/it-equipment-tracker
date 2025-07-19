const express = require('express');
const { Parser } = require('@json2csv/plainjs');
const db = require('../database/db');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Total equipment
    const totalEquipment = await db.get('SELECT COUNT(*) as count FROM equipment WHERE active = 1');
    
    // Checked out equipment
    const checkedOutEquipment = await db.get(`
      SELECT COUNT(*) as count 
      FROM equipment_transactions 
      WHERE transaction_type = 'checkout' AND returned_date IS NULL
    `);

    // Available equipment
    const availableEquipment = {
      count: totalEquipment.count - checkedOutEquipment.count
    };

    // Overdue equipment
    const overdueEquipment = await db.get(`
      SELECT COUNT(*) as count 
      FROM equipment_transactions 
      WHERE transaction_type = 'checkout' 
        AND returned_date IS NULL 
        AND due_date < date('now')
    `);

    // Total employees
    const totalEmployees = await db.get('SELECT COUNT(*) as count FROM employees WHERE active = 1');

    // Recent transactions (last 7 days)
    const recentTransactions = await db.get(`
      SELECT COUNT(*) as count 
      FROM equipment_transactions 
      WHERE processed_at >= date('now', '-7 days')
    `);

    // Equipment by category
    const equipmentByCategory = await db.query(`
      SELECT 
        c.name as category,
        COUNT(e.id) as count,
        COUNT(CASE WHEN t.equipment_id IS NOT NULL AND t.returned_date IS NULL THEN 1 END) as checked_out
      FROM equipment_categories c
      LEFT JOIN equipment e ON c.id = e.category_id AND e.active = 1
      LEFT JOIN equipment_transactions t ON e.id = t.equipment_id 
        AND t.transaction_type = 'checkout' AND t.returned_date IS NULL
      GROUP BY c.id, c.name
      ORDER BY count DESC
    `);

    // Recent activity
    const recentActivity = await db.query(`
      SELECT 
        t.*,
        e.asset_tag,
        e.manufacturer,
        e.make,
        e.model,
        emp.first_name || ' ' || emp.last_name as employee_name,
        adm.name as admin_name
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      JOIN employees emp ON t.employee_id = emp.id
      LEFT JOIN admins adm ON t.processed_by = adm.id
      ORDER BY t.processed_at DESC
      LIMIT 10
    `);

    res.json({
      statistics: {
        total_equipment: totalEquipment.count,
        checked_out_equipment: checkedOutEquipment.count,
        available_equipment: availableEquipment.count,
        overdue_equipment: overdueEquipment.count,
        total_employees: totalEmployees.count,
        recent_transactions: recentTransactions.count
      },
      equipmentByCategory,
      recentActivity
    });
  } catch (error) {
    console.error('Dashboard statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate equipment report
router.post('/equipment', authenticateToken, logActivity('equipment_report_generated', 'report'), async (req, res) => {
  try {
    const {
      format = 'json',
      columns = ['asset_tag', 'manufacturer', 'make', 'model', 'serial_number', 'category', 'condition', 'status'],
      filters = {}
    } = req.body;

    let whereConditions = ['e.active = 1'];
    let queryParams = [];

    // Apply filters
    if (filters.category) {
      whereConditions.push('e.category_id = ?');
      queryParams.push(filters.category);
    }

    if (filters.condition) {
      whereConditions.push('e.condition = ?');
      queryParams.push(filters.condition);
    }

    if (filters.status) {
      if (filters.status === 'checked_out') {
        whereConditions.push('t.equipment_id IS NOT NULL AND t.returned_date IS NULL');
      } else if (filters.status === 'available') {
        whereConditions.push('(t.equipment_id IS NULL OR t.returned_date IS NOT NULL)');
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      whereConditions.push(`e.id IN (
        SELECT equipment_id 
        FROM equipment_tag_assignments eta
        JOIN equipment_tags et ON eta.tag_id = et.id
        WHERE et.name IN (${filters.tags.map(() => '?').join(',')})
      )`);
      queryParams.push(...filters.tags);
    }

    if (filters.search) {
      whereConditions.push(`(
        e.asset_tag LIKE ? OR 
        e.manufacturer LIKE ? OR 
        e.make LIKE ? OR 
        e.model LIKE ? OR 
        e.serial_number LIKE ?
      )`);
      const searchTerm = `%${filters.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Build query based on selected columns
    let selectColumns = [];
    if (columns.includes('asset_tag')) selectColumns.push('e.asset_tag');
    if (columns.includes('manufacturer')) selectColumns.push('e.manufacturer');
    if (columns.includes('make')) selectColumns.push('e.make');
    if (columns.includes('model')) selectColumns.push('e.model');
    if (columns.includes('serial_number')) selectColumns.push('e.serial_number');
    if (columns.includes('category')) selectColumns.push('c.name as category');
    if (columns.includes('condition')) selectColumns.push('e.condition');
    if (columns.includes('purchase_date')) selectColumns.push('e.purchase_date');
    if (columns.includes('purchase_cost')) selectColumns.push('e.purchase_cost');
    if (columns.includes('warranty_end_date')) selectColumns.push('e.warranty_end_date');
    if (columns.includes('status')) {
      selectColumns.push(`CASE 
        WHEN t.equipment_id IS NOT NULL AND t.returned_date IS NULL THEN 'checked_out'
        ELSE 'available'
      END as status`);
    }
    if (columns.includes('checked_out_to')) {
      selectColumns.push(`emp.first_name || ' ' || emp.last_name as checked_out_to`);
    }
    if (columns.includes('location')) selectColumns.push('t.location');
    if (columns.includes('due_date')) selectColumns.push('t.due_date');

    const query = `
      SELECT ${selectColumns.join(', ')}
      FROM equipment e
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      LEFT JOIN (
        SELECT DISTINCT equipment_id, employee_id, location, due_date, returned_date
        FROM equipment_transactions 
        WHERE transaction_type = 'checkout' AND returned_date IS NULL
      ) t ON e.id = t.equipment_id
      LEFT JOIN employees emp ON t.employee_id = emp.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY e.asset_tag
    `;

    const equipment = await db.query(query, queryParams);

    if (format === 'csv') {
      // Convert to CSV
      const parser = new Parser();
      const csv = parser.parse(equipment);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="equipment_report_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      res.json({
        report: 'equipment',
        generated_at: new Date().toISOString(),
        filters,
        columns,
        total_records: equipment.length,
        data: equipment
      });
    }
  } catch (error) {
    console.error('Equipment report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate transactions report
router.post('/transactions', authenticateToken, logActivity('transactions_report_generated', 'report'), async (req, res) => {
  try {
    const {
      format = 'json',
      columns = ['asset_tag', 'employee_name', 'transaction_type', 'processed_at', 'location'],
      filters = {}
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    // Apply filters
    if (filters.transaction_type) {
      whereConditions.push('t.transaction_type = ?');
      queryParams.push(filters.transaction_type);
    }

    if (filters.employee_id) {
      whereConditions.push('t.employee_id = ?');
      queryParams.push(filters.employee_id);
    }

    if (filters.start_date) {
      whereConditions.push('DATE(t.processed_at) >= ?');
      queryParams.push(filters.start_date);
    }

    if (filters.end_date) {
      whereConditions.push('DATE(t.processed_at) <= ?');
      queryParams.push(filters.end_date);
    }

    if (filters.category) {
      whereConditions.push('c.id = ?');
      queryParams.push(filters.category);
    }

    if (filters.status) {
      if (filters.status === 'active') {
        whereConditions.push('t.transaction_type = "checkout" AND t.returned_date IS NULL');
      } else if (filters.status === 'returned') {
        whereConditions.push('t.transaction_type = "checkin" OR t.returned_date IS NOT NULL');
      }
    }

    // Build query based on selected columns
    let selectColumns = [];
    if (columns.includes('asset_tag')) selectColumns.push('e.asset_tag');
    if (columns.includes('equipment_name')) selectColumns.push('e.manufacturer || " " || e.make || " " || e.model as equipment_name');
    if (columns.includes('employee_name')) selectColumns.push('emp.first_name || " " || emp.last_name as employee_name');
    if (columns.includes('employee_email')) selectColumns.push('emp.email as employee_email');
    if (columns.includes('employee_id')) selectColumns.push('emp.employee_id');
    if (columns.includes('department')) selectColumns.push('emp.department');
    if (columns.includes('transaction_type')) selectColumns.push('t.transaction_type');
    if (columns.includes('processed_at')) selectColumns.push('t.processed_at');
    if (columns.includes('location')) selectColumns.push('t.location');
    if (columns.includes('due_date')) selectColumns.push('t.due_date');
    if (columns.includes('returned_date')) selectColumns.push('t.returned_date');
    if (columns.includes('condition_out')) selectColumns.push('t.condition_out');
    if (columns.includes('condition_in')) selectColumns.push('t.condition_in');
    if (columns.includes('processed_by')) selectColumns.push('adm.name as processed_by');
    if (columns.includes('category')) selectColumns.push('c.name as category');

    const query = `
      SELECT ${selectColumns.join(', ')}
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      JOIN employees emp ON t.employee_id = emp.id
      LEFT JOIN admins adm ON t.processed_by = adm.id
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
      ORDER BY t.processed_at DESC
    `;

    const transactions = await db.query(query, queryParams);

    if (format === 'csv') {
      // Convert to CSV
      const parser = new Parser();
      const csv = parser.parse(transactions);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="transactions_report_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      res.json({
        report: 'transactions',
        generated_at: new Date().toISOString(),
        filters,
        columns,
        total_records: transactions.length,
        data: transactions
      });
    }
  } catch (error) {
    console.error('Transactions report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate audit log report
router.post('/audit-log', authenticateToken, logActivity('audit_log_report_generated', 'report'), async (req, res) => {
  try {
    const {
      format = 'json',
      filters = {},
      limit = 1000
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    // Apply filters
    if (filters.admin_id) {
      whereConditions.push('a.admin_id = ?');
      queryParams.push(filters.admin_id);
    }

    if (filters.action) {
      whereConditions.push('a.action = ?');
      queryParams.push(filters.action);
    }

    if (filters.entity_type) {
      whereConditions.push('a.entity_type = ?');
      queryParams.push(filters.entity_type);
    }

    if (filters.start_date) {
      whereConditions.push('DATE(a.timestamp) >= ?');
      queryParams.push(filters.start_date);
    }

    if (filters.end_date) {
      whereConditions.push('DATE(a.timestamp) <= ?');
      queryParams.push(filters.end_date);
    }

    const query = `
      SELECT 
        a.*,
        adm.name as admin_name,
        emp.first_name || ' ' || emp.last_name as employee_name
      FROM activity_log a
      LEFT JOIN admins adm ON a.admin_id = adm.id
      LEFT JOIN employees emp ON a.employee_id = emp.id
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
      ORDER BY a.timestamp DESC
      LIMIT ?
    `;

    queryParams.push(limit);

    const auditLog = await db.query(query, queryParams);

    if (format === 'csv') {
      // Convert to CSV
      const parser = new Parser();
      const csv = parser.parse(auditLog);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_log_report_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      res.json({
        report: 'audit_log',
        generated_at: new Date().toISOString(),
        filters,
        total_records: auditLog.length,
        data: auditLog
      });
    }
  } catch (error) {
    console.error('Audit log report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available report columns
router.get('/columns/:reportType', authenticateToken, async (req, res) => {
  try {
    const { reportType } = req.params;

    const columnDefinitions = {
      equipment: [
        { key: 'asset_tag', label: 'Asset Tag', type: 'text' },
        { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
        { key: 'make', label: 'Make', type: 'text' },
        { key: 'model', label: 'Model', type: 'text' },
        { key: 'serial_number', label: 'Serial Number', type: 'text' },
        { key: 'category', label: 'Category', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' },
        { key: 'purchase_date', label: 'Purchase Date', type: 'date' },
        { key: 'purchase_cost', label: 'Purchase Cost', type: 'currency' },
        { key: 'warranty_end_date', label: 'Warranty End Date', type: 'date' },
        { key: 'status', label: 'Status', type: 'text' },
        { key: 'checked_out_to', label: 'Checked Out To', type: 'text' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'due_date', label: 'Due Date', type: 'date' }
      ],
      transactions: [
        { key: 'asset_tag', label: 'Asset Tag', type: 'text' },
        { key: 'equipment_name', label: 'Equipment Name', type: 'text' },
        { key: 'employee_name', label: 'Employee Name', type: 'text' },
        { key: 'employee_email', label: 'Employee Email', type: 'text' },
        { key: 'employee_id', label: 'Employee ID', type: 'text' },
        { key: 'department', label: 'Department', type: 'text' },
        { key: 'transaction_type', label: 'Transaction Type', type: 'text' },
        { key: 'processed_at', label: 'Processed At', type: 'datetime' },
        { key: 'location', label: 'Location', type: 'text' },
        { key: 'due_date', label: 'Due Date', type: 'date' },
        { key: 'returned_date', label: 'Returned Date', type: 'datetime' },
        { key: 'condition_out', label: 'Condition Out', type: 'text' },
        { key: 'condition_in', label: 'Condition In', type: 'text' },
        { key: 'processed_by', label: 'Processed By', type: 'text' },
        { key: 'category', label: 'Category', type: 'text' }
      ]
    };

    const columns = columnDefinitions[reportType];
    if (!columns) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    res.json({ columns });
  } catch (error) {
    console.error('Report columns error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;