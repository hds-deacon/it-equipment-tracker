const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'equipment');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    const filename = `${uniqueId}${extension}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and common document formats
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'), false);
    }
  }
});

// Upload file for equipment
router.post('/upload/:equipment_id', authenticateToken, upload.single('file'), logActivity('file_uploaded', 'file'), async (req, res) => {
  try {
    const { equipment_id } = req.params;
    const { file_type, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if equipment exists
    const equipment = await db.get('SELECT id FROM equipment WHERE id = ? AND active = 1', [equipment_id]);
    if (!equipment) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Save file information to database
    const result = await db.insert(`
      INSERT INTO equipment_files (
        equipment_id, file_name, file_path, file_type, file_size, mime_type, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      equipment_id,
      req.file.originalname,
      req.file.path,
      file_type || 'other',
      req.file.size,
      req.file.mimetype,
      req.admin.id
    ]);

    // Get the created file record
    const fileRecord = await db.get('SELECT * FROM equipment_files WHERE id = ?', [result.id]);

    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        id: fileRecord.id,
        file_name: fileRecord.file_name,
        file_type: fileRecord.file_type,
        file_size: fileRecord.file_size,
        mime_type: fileRecord.mime_type,
        uploaded_at: fileRecord.uploaded_at
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get files for equipment
router.get('/equipment/:equipment_id', authenticateToken, async (req, res) => {
  try {
    const { equipment_id } = req.params;

    const files = await db.query(`
      SELECT 
        f.*,
        a.name as uploaded_by_name
      FROM equipment_files f
      LEFT JOIN admins a ON f.uploaded_by = a.id
      WHERE f.equipment_id = ?
      ORDER BY f.uploaded_at DESC
    `, [equipment_id]);

    res.json({ files });
  } catch (error) {
    console.error('Files fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download file
router.get('/download/:file_id', authenticateToken, async (req, res) => {
  try {
    const { file_id } = req.params;

    const file = await db.get('SELECT * FROM equipment_files WHERE id = ?', [file_id]);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    res.setHeader('Content-Type', file.mime_type);

    // Stream the file
    const fileStream = fs.createReadStream(file.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// View file (for images and PDFs)
router.get('/view/:file_id', authenticateToken, async (req, res) => {
  try {
    const { file_id } = req.params;

    const file = await db.get('SELECT * FROM equipment_files WHERE id = ?', [file_id]);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set appropriate headers for inline viewing
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);

    // Stream the file
    const fileStream = fs.createReadStream(file.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('File view error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete file
router.delete('/:file_id', authenticateToken, logActivity('file_deleted', 'file'), async (req, res) => {
  try {
    const { file_id } = req.params;

    const file = await db.get('SELECT * FROM equipment_files WHERE id = ?', [file_id]);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete file from disk
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }

    // Delete file record from database
    await db.run('DELETE FROM equipment_files WHERE id = ?', [file_id]);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update file information
router.put('/:file_id', authenticateToken, logActivity('file_updated', 'file'), async (req, res) => {
  try {
    const { file_id } = req.params;
    const { file_type, description } = req.body;

    const file = await db.get('SELECT * FROM equipment_files WHERE id = ?', [file_id]);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Update file information
    await db.run(`
      UPDATE equipment_files 
      SET file_type = ?
      WHERE id = ?
    `, [file_type || file.file_type, file_id]);

    // Get updated file record
    const updatedFile = await db.get('SELECT * FROM equipment_files WHERE id = ?', [file_id]);

    res.json({
      message: 'File updated successfully',
      file: updatedFile
    });
  } catch (error) {
    console.error('File update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get file types
router.get('/types/all', authenticateToken, async (req, res) => {
  try {
    const fileTypes = [
      { value: 'warranty', label: 'Warranty Document' },
      { value: 'receipt', label: 'Receipt/Invoice' },
      { value: 'manual', label: 'Manual/Instructions' },
      { value: 'photo', label: 'Photo' },
      { value: 'certificate', label: 'Certificate' },
      { value: 'other', label: 'Other' }
    ];

    res.json({ fileTypes });
  } catch (error) {
    console.error('File types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk upload files
router.post('/bulk-upload/:equipment_id', authenticateToken, upload.array('files', 10), logActivity('files_bulk_uploaded', 'file'), async (req, res) => {
  try {
    const { equipment_id } = req.params;
    const { file_types = [] } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Check if equipment exists
    const equipment = await db.get('SELECT id FROM equipment WHERE id = ? AND active = 1', [equipment_id]);
    if (!equipment) {
      // Clean up uploaded files
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const uploadedFiles = [];
    const errors = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const fileType = file_types[i] || 'other';

      try {
        // Save file information to database
        const result = await db.insert(`
          INSERT INTO equipment_files (
            equipment_id, file_name, file_path, file_type, file_size, mime_type, uploaded_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          equipment_id,
          file.originalname,
          file.path,
          fileType,
          file.size,
          file.mimetype,
          req.admin.id
        ]);

        uploadedFiles.push({
          id: result.id,
          file_name: file.originalname,
          file_type: fileType,
          file_size: file.size,
          mime_type: file.mimetype
        });
      } catch (error) {
        errors.push({
          file_name: file.originalname,
          error: error.message
        });
        
        // Clean up this file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    res.json({
      message: 'Bulk upload completed',
      uploaded: uploadedFiles.length,
      errors: errors.length,
      files: uploadedFiles,
      upload_errors: errors
    });
  } catch (error) {
    console.error('Bulk file upload error:', error);
    
    // Clean up uploaded files if there was an error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;