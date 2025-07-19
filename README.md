# IT Equipment Tracking System

A comprehensive IT equipment tracking and management application built with Node.js, React, and SQLite. This system allows organizations to efficiently track, manage, and monitor their IT equipment inventory with features like QR code generation, employee management, transaction tracking, and detailed reporting.

## Features

### Core Functionality
- **Equipment Management**: Track laptops, monitors, phones, tablets, and other IT equipment
- **Employee Management**: Manage employee profiles with Entra ID integration support
- **Check-in/Check-out System**: Track equipment assignments and returns
- **Bundle Management**: Create and manage equipment kits (e.g., mobile networking kits)
- **QR Code Generation**: Generate QR codes for easy equipment identification
- **Dymo Label Printing**: Print labels for 19mm D1 tape
- **File Management**: Upload and manage warranties, receipts, manuals, and photos
- **Audit Trail**: Comprehensive logging of all system activities
- **Advanced Reporting**: Generate detailed reports with filtering and export options

### Technical Features
- **Secure Authentication**: JWT-based admin authentication
- **Real-time Dashboard**: Live statistics and recent activity
- **Mobile-Responsive UI**: Works on desktop, tablet, and mobile devices
- **REST API**: Comprehensive API for all operations
- **Database**: SQLite for easy deployment and maintenance
- **File Upload**: Support for documents, images, and other file types

## Technology Stack

### Backend
- **Node.js** with Express.js
- **SQLite** database
- **JWT** for authentication
- **Multer** for file uploads
- **QRCode** library for QR code generation
- **bcryptjs** for password hashing
- **Helmet** for security headers
- **Rate limiting** for API protection

### Frontend
- **React 18** with TypeScript
- **React Router** for navigation
- **TanStack Query** for state management
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **React Hook Form** with Yup validation
- **Axios** for API calls

## Installation

### Prerequisites
- Node.js 16 or higher
- npm or yarn

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/hds-deacon/it-equipment-tracker.git
cd it-equipment-tracker
```

2. **Install backend dependencies**
```bash
npm install
```

3. **Install frontend dependencies**
```bash
cd client
npm install
cd ..
```

4. **Initialize the database**
```bash
node scripts/init-database.js
```

5. **Start the backend server**
```bash
npm run dev
```

6. **Start the frontend development server**
```bash
npm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Default Admin Credentials
- Email: `admin@company.com`
- Password: `admin123`

**⚠️ Important: Change these credentials immediately after first login!**

## Configuration

### Environment Variables

**Backend (.env)**
```
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:3000
JWT_SECRET=your-super-secret-jwt-key-please-change-this-in-production-2024
```

**Frontend (client/.env)**
```
REACT_APP_API_URL=http://localhost:3001/api
```

## Database Schema

The application uses SQLite with the following main tables:

- **admins**: System administrators
- **employees**: Organization employees
- **equipment**: IT equipment inventory
- **equipment_categories**: Equipment categories
- **equipment_tags**: Flexible tagging system
- **bundles**: Equipment bundles/kits
- **equipment_transactions**: Check-in/out history
- **equipment_files**: File attachments
- **activity_log**: Audit trail

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - Register new admin (requires auth)
- `GET /api/auth/profile` - Get current admin profile
- `PUT /api/auth/profile` - Update admin profile
- `POST /api/auth/logout` - Logout

### Equipment
- `GET /api/equipment` - List equipment with filters
- `POST /api/equipment` - Create new equipment
- `GET /api/equipment/:id` - Get equipment details
- `PUT /api/equipment/:id` - Update equipment
- `DELETE /api/equipment/:id` - Delete equipment

### Employees
- `GET /api/employees` - List employees
- `POST /api/employees` - Create new employee
- `GET /api/employees/:id` - Get employee details
- `PUT /api/employees/:id` - Update employee
- `POST /api/employees/import` - Import employees from CSV

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions/checkout` - Check out equipment
- `POST /api/transactions/checkin` - Check in equipment
- `POST /api/transactions/quick-checkout` - Quick checkout by QR scan
- `POST /api/transactions/quick-checkin` - Quick checkin by QR scan

### QR Codes & Labels
- `GET /api/qr/equipment/:id` - Generate QR code for equipment
- `GET /api/qr/label/equipment/:id` - Generate label data
- `GET /api/qr/dymo-template/equipment/:id` - Generate Dymo XML template
- `POST /api/qr/bulk-generate` - Bulk generate QR codes

### Reports
- `GET /api/reports/dashboard` - Dashboard statistics
- `POST /api/reports/equipment` - Generate equipment report
- `POST /api/reports/transactions` - Generate transaction report
- `POST /api/reports/audit-log` - Generate audit log report

## Equipment Types Supported

The system supports various types of IT equipment:

- **Laptops**: Portable computers and notebooks
- **Monitors**: Display screens and monitors
- **Keyboards & Mice**: Input devices
- **Mobile Routers**: Portable internet connectivity devices
- **Switches**: Network switching equipment
- **Chargers**: Power adapters and charging cables
- **Docks**: Laptop docking stations
- **Cameras**: 360-degree cameras and recording equipment
- **Tripods**: Camera mounting and support equipment
- **Phones**: Mobile phones and smartphones
- **Tablets**: iPads and other tablet devices
- **Accessories**: Various equipment accessories

## Bundle/Kit Management

Create and manage equipment bundles for:
- Mobile networking kits
- Laptop packages (laptop + charger + dock)
- Job site equipment sets
- Any custom equipment groupings

## QR Code & Label Printing

### QR Code Features
- Generate QR codes for individual equipment
- QR codes contain asset tags for easy scanning
- Support for SVG and PNG formats
- Bulk QR code generation

### Dymo Label Printing
- Optimized for 19mm D1 tape
- XML templates for Dymo Label Web Service
- Include QR code and equipment information
- Print-ready label generation

## File Management

Upload and manage various file types:
- **Warranty Documents**: PDF, Word, etc.
- **Receipts/Invoices**: Scanned receipts and purchase orders
- **Manuals**: Equipment manuals and instructions
- **Photos**: Equipment photos and condition documentation
- **Certificates**: Compliance certificates and documentation

## Reporting & Analytics

### Dashboard Statistics
- Total equipment count
- Currently checked out equipment
- Available equipment
- Overdue equipment
- Equipment by category breakdown
- Recent activity feed

### Custom Reports
- **Equipment Report**: Detailed equipment inventory
- **Transaction Report**: Check-in/out history
- **Audit Log**: System activity tracking
- **Overdue Report**: Equipment past due dates

### Export Options
- CSV export for all reports
- Customizable columns and filters
- Date range filtering
- Advanced filtering options

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS configuration
- Security headers with Helmet
- File upload restrictions
- Audit logging for all actions

## Mobile Support

The application is fully responsive and supports:
- Mobile browsers for quick access
- QR code scanning on mobile devices
- Touch-friendly interface
- Offline-capable design patterns

## Development

### Project Structure
```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   ├── api/            # API client
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   └── public/             # Static assets
├── database/               # Database files
│   ├── db.js              # Database connection
│   └── schema.sql         # Database schema
├── routes/                 # API routes
├── middleware/             # Express middleware
├── uploads/                # File upload directory
└── scripts/               # Utility scripts
```

### Available Scripts

**Backend:**
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run server` - Start backend only

**Frontend:**
- `npm run client` - Start frontend development server
- `npm run build` - Build frontend for production
- `npm run install-client` - Install frontend dependencies

**Database:**
- `node scripts/init-database.js` - Initialize database with sample data

## Deployment

### Production Deployment

1. **Set environment variables**
```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-production-secret-key
CLIENT_URL=https://your-domain.com
```

2. **Build frontend**
```bash
cd client
npm run build
cd ..
```

3. **Start production server**
```bash
npm start
```

### Docker Deployment

A Dockerfile and docker-compose.yml can be created for containerized deployment.

## Support & Maintenance

### Database Backup
The SQLite database file is located at `database/equipment_tracker.db`. Regular backups are recommended.

### Log Files
Application logs are output to console. Configure log rotation for production environments.

### File Storage
Uploaded files are stored in the `uploads/` directory. Ensure proper backup and permissions.

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure database file has proper permissions
   - Run `node scripts/init-database.js` to initialize

2. **Login Issues**
   - Check JWT_SECRET is set correctly
   - Verify admin user exists in database
   - Clear browser localStorage if needed

3. **File Upload Issues**
   - Check `uploads/` directory permissions
   - Verify file size limits
   - Ensure MIME type restrictions

4. **QR Code Generation Issues**
   - Verify QR code library is installed
   - Check image generation permissions
   - Ensure proper SVG/PNG handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Changelog

### Version 1.0.0
- Initial release
- Equipment tracking and management
- Employee management
- Transaction tracking
- QR code generation
- Dymo label printing support
- File management
- Reporting system
- Dashboard analytics
- Mobile-responsive design

---

For additional support or questions, please contact the development team or create an issue in the repository.