const bcrypt = require('bcryptjs');
const db = require('../database/db');

async function initDatabase() {
  console.log('Initializing database...');
  
  try {
    // Initialize database connection
    await db.initialize();
    
    // Create default admin user
    const defaultEmail = 'admin@company.com';
    const defaultPassword = 'admin123';
    const defaultName = 'System Administrator';
    
    // Check if admin already exists
    const existingAdmin = await db.get('SELECT id FROM admins WHERE email = ?', [defaultEmail]);
    
    if (!existingAdmin) {
      console.log('Creating default admin user...');
      const passwordHash = await bcrypt.hash(defaultPassword, 12);
      
      await db.insert(
        'INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)',
        [defaultEmail, passwordHash, defaultName]
      );
      
      console.log('Default admin user created:');
      console.log(`Email: ${defaultEmail}`);
      console.log(`Password: ${defaultPassword}`);
      console.log('⚠️  Please change this password after first login!');
    } else {
      console.log('Admin user already exists');
    }
    
    // Add sample employees
    const sampleEmployees = [
      {
        employee_id: 'EMP001',
        email: 'john.doe@company.com',
        first_name: 'John',
        last_name: 'Doe',
        department: 'IT',
        job_title: 'Software Developer',
        phone: '555-0101'
      },
      {
        employee_id: 'EMP002',
        email: 'jane.smith@company.com',
        first_name: 'Jane',
        last_name: 'Smith',
        department: 'Marketing',
        job_title: 'Marketing Manager',
        phone: '555-0102'
      },
      {
        employee_id: 'EMP003',
        email: 'bob.johnson@company.com',
        first_name: 'Bob',
        last_name: 'Johnson',
        department: 'Sales',
        job_title: 'Sales Representative',
        phone: '555-0103'
      }
    ];
    
    console.log('Adding sample employees...');
    for (const employee of sampleEmployees) {
      const existing = await db.get('SELECT id FROM employees WHERE employee_id = ?', [employee.employee_id]);
      if (!existing) {
        await db.insert(`
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
        console.log(`Added employee: ${employee.first_name} ${employee.last_name}`);
      }
    }
    
    // Add sample equipment
    const sampleEquipment = [
      {
        category_id: 1, // Laptops
        manufacturer: 'Dell',
        make: 'Dell',
        model: 'Latitude 5420',
        serial_number: 'DL5420001',
        condition: 'Good',
        purchase_date: '2023-01-15',
        purchase_cost: 1200.00,
        warranty_end_date: '2026-01-15'
      },
      {
        category_id: 1, // Laptops
        manufacturer: 'HP',
        make: 'HP',
        model: 'EliteBook 840',
        serial_number: 'HP840001',
        condition: 'New',
        purchase_date: '2023-06-10',
        purchase_cost: 1350.00,
        warranty_end_date: '2026-06-10'
      },
      {
        category_id: 2, // Monitors
        manufacturer: 'Dell',
        make: 'Dell',
        model: 'U2719D',
        serial_number: 'DU2719001',
        condition: 'Good',
        purchase_date: '2023-02-20',
        purchase_cost: 300.00,
        warranty_end_date: '2026-02-20'
      },
      {
        category_id: 10, // Phones
        manufacturer: 'Apple',
        make: 'Apple',
        model: 'iPhone 14',
        serial_number: 'IP14001',
        condition: 'New',
        purchase_date: '2023-09-01',
        purchase_cost: 999.00,
        warranty_end_date: '2024-09-01'
      }
    ];
    
    console.log('Adding sample equipment...');
    for (const equipment of sampleEquipment) {
      const existing = await db.get('SELECT id FROM equipment WHERE serial_number = ?', [equipment.serial_number]);
      if (!existing) {
        const assetTag = await db.generateAssetTag();
        await db.insert(`
          INSERT INTO equipment (
            asset_tag, category_id, manufacturer, make, model, serial_number,
            condition, purchase_date, purchase_cost, warranty_end_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          assetTag,
          equipment.category_id,
          equipment.manufacturer,
          equipment.make,
          equipment.model,
          equipment.serial_number,
          equipment.condition,
          equipment.purchase_date,
          equipment.purchase_cost,
          equipment.warranty_end_date
        ]);
        console.log(`Added equipment: ${equipment.manufacturer} ${equipment.model} (${assetTag})`);
      }
    }
    
    console.log('Database initialization completed successfully!');
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run initialization
initDatabase();