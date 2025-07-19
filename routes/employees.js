const express = require('express');
const db = require('../database/db');
const { authenticateToken, logActivity } = require('../middleware/auth');
const csv = require('csv-parser');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

// Configure multer for CSV uploads
const upload = multer({
  dest: 'uploads/temp/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// Get all employees with pagination and search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      department = '',
      active = '1'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];

    // Build WHERE clause
    if (search) {
      whereConditions.push(`(
        first_name LIKE ? OR 
        last_name LIKE ? OR 
        email LIKE ? OR 
        employee_id LIKE ?
      )`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (department) {
      whereConditions.push('department = ?');
      queryParams.push(department);
    }

    if (active !== 'all') {
      whereConditions.push('active = ?');
      queryParams.push(active);
    }

    let query = `
      SELECT 
        e.*,
        COUNT(DISTINCT t.id) as equipment_count,
        COUNT(DISTINCT CASE WHEN t.returned_date IS NULL THEN t.id END) as checked_out_count
      FROM employees e
      LEFT JOIN equipment_transactions t ON e.id = t.employee_id
    `;

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += ' GROUP BY e.id ORDER BY e.last_name, e.first_name';

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const employees = await db.query(query, queryParams);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM employees';
    if (whereConditions.length > 0) {
      countQuery += ' WHERE ' + whereConditions.join(' AND ');
    }

    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await db.get(countQuery, countParams);
    const total = countResult.total;

    res.json({
      employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Employees fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single employee
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [id]);
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get current equipment checked out
    const currentEquipment = await db.query(`
      SELECT 
        e.*,
        c.name as category_name,
        t.location,
        t.due_date,
        t.processed_at as checkout_date
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      WHERE t.employee_id = ? AND t.transaction_type = 'checkout' AND t.returned_date IS NULL
      ORDER BY t.processed_at DESC
    `, [id]);

    // Get equipment history
    const equipmentHistory = await db.query(`
      SELECT 
        e.*,
        c.name as category_name,
        t.transaction_type,
        t.location,
        t.due_date,
        t.returned_date,
        t.processed_at,
        t.notes,
        adm.name as processed_by_name
      FROM equipment_transactions t
      JOIN equipment e ON t.equipment_id = e.id
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      LEFT JOIN admins adm ON t.processed_by = adm.id
      WHERE t.employee_id = ?
      ORDER BY t.processed_at DESC
      LIMIT 50
    `, [id]);

    res.json({
      employee,
      currentEquipment,
      equipmentHistory
    });
  } catch (error) {
    console.error('Employee fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new employee
router.post('/', authenticateToken, logActivity('employee_created', 'employee'), async (req, res) => {
  try {
    const {
      employee_id,
      email,
      first_name,
      last_name,
      department,
      job_title,
      phone
    } = req.body;

    // Validate required fields
    if (!employee_id || !email || !first_name || !last_name) {
      return res.status(400).json({ error: 'Employee ID, email, first name, and last name are required' });
    }

    // Check for duplicate employee ID or email
    const existingEmployee = await db.get(
      'SELECT id FROM employees WHERE employee_id = ? OR email = ?',
      [employee_id, email]
    );

    if (existingEmployee) {
      return res.status(400).json({ error: 'Employee with this ID or email already exists' });
    }

    // Create employee
    const result = await db.insert(`
      INSERT INTO employees (employee_id, email, first_name, last_name, department, job_title, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [employee_id, email, first_name, last_name, department, job_title, phone]);

    // Get the created employee
    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [result.id]);

    res.status(201).json({
      message: 'Employee created successfully',
      employee
    });
  } catch (error) {
    console.error('Employee creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update employee
router.put('/:id', authenticateToken, logActivity('employee_updated', 'employee'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_id,
      email,
      first_name,
      last_name,
      department,
      job_title,
      phone
    } = req.body;

    // Check if employee exists
    const existingEmployee = await db.get('SELECT * FROM employees WHERE id = ?', [id]);
    if (!existingEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check for duplicate employee ID or email (excluding current employee)
    const duplicateEmployee = await db.get(
      'SELECT id FROM employees WHERE (employee_id = ? OR email = ?) AND id != ?',
      [employee_id, email, id]
    );

    if (duplicateEmployee) {
      return res.status(400).json({ error: 'Employee with this ID or email already exists' });
    }

    // Store old values for audit log
    req.body.oldValues = existingEmployee;

    // Update employee
    await db.run(`
      UPDATE employees SET
        employee_id = ?, email = ?, first_name = ?, last_name = ?,
        department = ?, job_title = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [employee_id, email, first_name, last_name, department, job_title, phone, id]);

    // Get updated employee
    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [id]);

    res.json({
      message: 'Employee updated successfully',
      employee
    });
  } catch (error) {
    console.error('Employee update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate employee
router.put('/:id/deactivate', authenticateToken, logActivity('employee_deactivated', 'employee'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if employee exists
    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [id]);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Check if employee has equipment checked out
    const checkedOutEquipment = await db.query(`
      SELECT COUNT(*) as count
      FROM equipment_transactions
      WHERE employee_id = ? AND transaction_type = 'checkout' AND returned_date IS NULL
    `, [id]);

    if (checkedOutEquipment[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot deactivate employee with equipment checked out. Please check in all equipment first.' 
      });
    }

    // Deactivate employee
    await db.run('UPDATE employees SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    res.json({ message: 'Employee deactivated successfully' });
  } catch (error) {
    console.error('Employee deactivation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import employees from CSV
router.post('/import', authenticateToken, upload.single('csvFile'), logActivity('employees_imported', 'employee'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const results = [];
    const errors = [];
    let rowNumber = 0;

    // Parse CSV file
    const parseCSV = new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
          rowNumber++;
          
          // Expected CSV columns: employee_id, email, first_name, last_name, department, job_title, phone
          const employee = {
            employee_id: data.employee_id || data.EmployeeID || data['Employee ID'],
            email: data.email || data.Email,
            first_name: data.first_name || data.FirstName || data['First Name'],
            last_name: data.last_name || data.LastName || data['Last Name'],
            department: data.department || data.Department,
            job_title: data.job_title || data.JobTitle || data['Job Title'],
            phone: data.phone || data.Phone
          };

          // Validate required fields
          if (!employee.employee_id || !employee.email || !employee.first_name || !employee.last_name) {
            errors.push({
              row: rowNumber,
              error: 'Missing required fields (employee_id, email, first_name, last_name)'
            });
            return;
          }

          results.push(employee);
        })
        .on('end', () => {
          resolve();
        })
        .on('error', reject);
    });

    await parseCSV;

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'CSV validation errors',
        errors,
        parsedCount: results.length
      });
    }

    // Import employees
    const imported = [];
    const importErrors = [];

    for (const employee of results) {
      try {
        // Check for existing employee
        const existing = await db.get(
          'SELECT id FROM employees WHERE employee_id = ? OR email = ?',
          [employee.employee_id, employee.email]
        );

        if (existing) {
          importErrors.push({
            employee_id: employee.employee_id,
            email: employee.email,
            error: 'Employee already exists'
          });
          continue;
        }

        // Insert employee
        const result = await db.insert(`
          INSERT INTO employees (employee_id, email, first_name, last_name, department, job_title, phone)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          employee.employee_id,
          employee.email,
          employee.first_name,
          employee.last_name,
          employee.department,
          employee.job_title,
          employee.phone
        ]);

        imported.push({
          id: result.id,
          employee_id: employee.employee_id,
          email: employee.email,
          name: `${employee.first_name} ${employee.last_name}`
        });
      } catch (error) {
        importErrors.push({
          employee_id: employee.employee_id,
          email: employee.email,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Import completed',
      imported: imported.length,
      errors: importErrors.length,
      importedEmployees: imported,
      importErrors
    });
  } catch (error) {
    console.error('Employee import error:', error);
    
    // Clean up temp file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get departments list
router.get('/departments/all', authenticateToken, async (req, res) => {
  try {
    const departments = await db.query(`
      SELECT DISTINCT department
      FROM employees
      WHERE department IS NOT NULL AND department != ''
      ORDER BY department
    `);

    res.json({ departments: departments.map(d => d.department) });
  } catch (error) {
    console.error('Departments fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search employees for checkout/checkin
router.get('/search/:term', authenticateToken, async (req, res) => {
  try {
    const { term } = req.params;
    
    const employees = await db.query(`
      SELECT id, employee_id, email, first_name, last_name, department, job_title
      FROM employees
      WHERE active = 1 AND (
        first_name LIKE ? OR 
        last_name LIKE ? OR 
        email LIKE ? OR 
        employee_id LIKE ?
      )
      ORDER BY last_name, first_name
      LIMIT 20
    `, [`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]);

    res.json({ employees });
  } catch (error) {
    console.error('Employee search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;