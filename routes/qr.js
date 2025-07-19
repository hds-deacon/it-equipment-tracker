const express = require('express');
const QRCode = require('qrcode');
const db = require('../database/db');
const { authenticateToken, logActivity } = require('../middleware/auth');

const router = express.Router();

// Generate QR code for equipment
router.get('/equipment/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'svg' } = req.query;

    // Get equipment
    const equipment = await db.get('SELECT * FROM equipment WHERE id = ? AND active = 1', [id]);
    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // QR code data - just the asset tag for scanning
    const qrData = equipment.asset_tag;

    // Generate QR code
    const qrCodeOptions = {
      errorCorrectionLevel: 'M',
      type: 'svg',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };

    if (format === 'png') {
      qrCodeOptions.type = 'png';
      qrCodeOptions.width = 200;
    }

    const qrCodeData = await QRCode.toString(qrData, qrCodeOptions);

    // Mark QR code as generated
    await db.run('UPDATE equipment SET qr_code_generated = 1 WHERE id = ?', [id]);

    if (format === 'png') {
      res.setHeader('Content-Type', 'image/png');
      res.send(Buffer.from(qrCodeData, 'base64'));
    } else {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(qrCodeData);
    }
  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate QR code for bundle
router.get('/bundle/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'svg' } = req.query;

    // Get bundle
    const bundle = await db.get('SELECT * FROM bundles WHERE id = ? AND active = 1', [id]);
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // QR code data - bundle identifier
    const qrData = `BUNDLE-${bundle.id}`;

    // Generate QR code
    const qrCodeOptions = {
      errorCorrectionLevel: 'M',
      type: 'svg',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };

    if (format === 'png') {
      qrCodeOptions.type = 'png';
      qrCodeOptions.width = 200;
    }

    const qrCodeData = await QRCode.toString(qrData, qrCodeOptions);

    if (format === 'png') {
      res.setHeader('Content-Type', 'image/png');
      res.send(Buffer.from(qrCodeData, 'base64'));
    } else {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(qrCodeData);
    }
  } catch (error) {
    console.error('QR code generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate label data for Dymo printer
router.get('/label/equipment/:id', authenticateToken, logActivity('label_generated', 'equipment'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get equipment
    const equipment = await db.get(`
      SELECT e.*, c.name as category_name
      FROM equipment e
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      WHERE e.id = ? AND e.active = 1
    `, [id]);

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Generate QR code as data URL for embedding in label
    const qrData = equipment.asset_tag;
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      width: 150,
      margin: 1
    });

    // Label data for Dymo D1 19mm tape
    const labelData = {
      equipment: {
        asset_tag: equipment.asset_tag,
        manufacturer: equipment.manufacturer,
        make: equipment.make,
        model: equipment.model,
        category: equipment.category_name
      },
      qr_code: qrCodeDataUrl,
      generated_at: new Date().toISOString()
    };

    // Mark QR code as generated
    await db.run('UPDATE equipment SET qr_code_generated = 1 WHERE id = ?', [id]);

    res.json({
      message: 'Label data generated successfully',
      labelData
    });
  } catch (error) {
    console.error('Label generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dymo label XML template for equipment
router.get('/dymo-template/equipment/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get equipment
    const equipment = await db.get(`
      SELECT e.*, c.name as category_name
      FROM equipment e
      LEFT JOIN equipment_categories c ON e.category_id = c.id
      WHERE e.id = ? AND e.active = 1
    `, [id]);

    if (!equipment) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    // Generate QR code as base64 PNG
    const qrData = equipment.asset_tag;
    const qrCodeBase64 = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      width: 100,
      margin: 1,
      format: 'png'
    });

    // Dymo label XML template for 19mm D1 tape
    const labelXml = `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>19mm x 89mm</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="1260" Height="270" Rx="40" Ry="40" />
  </DrawCommands>
  <ObjectInfo>
    <TextObject>
      <Name>TEXT</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>True</IsVariable>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${equipment.asset_tag}</String>
          <Attributes>
            <Font Family="Arial" Size="8" Bold="True" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="200" Y="50" Width="800" Height="170" />
  </ObjectInfo>
  <ObjectInfo>
    <ImageObject>
      <Name>QR</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <Image>${qrCodeBase64}</Image>
    </ImageObject>
    <Bounds X="20" Y="20" Width="160" Height="160" />
  </ObjectInfo>
</DieCutLabel>`;

    res.setHeader('Content-Type', 'application/xml');
    res.send(labelXml);
  } catch (error) {
    console.error('Dymo template generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk generate QR codes for multiple equipment
router.post('/bulk-generate', authenticateToken, logActivity('bulk_qr_generated', 'equipment'), async (req, res) => {
  try {
    const { equipment_ids } = req.body;

    if (!equipment_ids || !Array.isArray(equipment_ids)) {
      return res.status(400).json({ error: 'Equipment IDs array is required' });
    }

    const results = [];
    const errors = [];

    for (const id of equipment_ids) {
      try {
        // Get equipment
        const equipment = await db.get('SELECT * FROM equipment WHERE id = ? AND active = 1', [id]);
        if (!equipment) {
          errors.push({ id, error: 'Equipment not found' });
          continue;
        }

        // Generate QR code
        const qrData = equipment.asset_tag;
        const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
          errorCorrectionLevel: 'M',
          width: 150,
          margin: 1
        });

        // Mark QR code as generated
        await db.run('UPDATE equipment SET qr_code_generated = 1 WHERE id = ?', [id]);

        results.push({
          id: equipment.id,
          asset_tag: equipment.asset_tag,
          manufacturer: equipment.manufacturer,
          make: equipment.make,
          model: equipment.model,
          qr_code: qrCodeDataUrl
        });
      } catch (error) {
        errors.push({ id, error: error.message });
      }
    }

    res.json({
      message: 'Bulk QR code generation completed',
      generated: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Bulk QR generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;