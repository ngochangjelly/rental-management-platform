const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');

// Get all tenants
router.get('/', async (req, res) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 });
    res.json({ success: true, tenants });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tenants' });
  }
});

// Get single tenant by FIN
router.get('/:fin', async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ fin: req.params.fin.toUpperCase() });
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }
    res.json({ success: true, tenant });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tenant' });
  }
});

// Create new tenant
router.post('/', async (req, res) => {
  try {
    const { name, fin, passportNumber, isRegistered, isMainTenant, properties } = req.body;

    // Validate required fields
    if (!name || !fin || !passportNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, FIN, and passport number are required' 
      });
    }

    // Check if tenant with same FIN already exists
    const existingTenant = await Tenant.findOne({ fin: fin.toUpperCase() });
    if (existingTenant) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tenant with this FIN already exists' 
      });
    }

    const tenant = new Tenant({
      name: name.trim(),
      fin: fin.toUpperCase().trim(),
      passportNumber: passportNumber.toUpperCase().trim(),
      isRegistered: isRegistered || false,
      isMainTenant: isMainTenant || false,
      properties: properties ? properties.map(p => p.toUpperCase().trim()).filter(p => p) : []
    });

    await tenant.save();
    res.status(201).json({ success: true, tenant });
  } catch (error) {
    console.error('Error creating tenant:', error);
    if (error.code === 11000) {
      res.status(400).json({ success: false, error: 'Tenant with this FIN already exists' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to create tenant' });
    }
  }
});

// Update tenant
router.put('/:fin', async (req, res) => {
  try {
    const { name, passportNumber, isRegistered, isMainTenant, properties } = req.body;
    
    const tenant = await Tenant.findOne({ fin: req.params.fin.toUpperCase() });
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    // Update fields if provided
    if (name) tenant.name = name.trim();
    if (passportNumber) tenant.passportNumber = passportNumber.toUpperCase().trim();
    if (typeof isRegistered === 'boolean') tenant.isRegistered = isRegistered;
    if (typeof isMainTenant === 'boolean') tenant.isMainTenant = isMainTenant;
    if (properties !== undefined) tenant.properties = properties ? properties.map(p => p.toUpperCase().trim()).filter(p => p) : [];

    await tenant.save();
    res.json({ success: true, tenant });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ success: false, error: 'Failed to update tenant' });
  }
});

// Delete tenant
router.delete('/:fin', async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndDelete({ fin: req.params.fin.toUpperCase() });
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }
    res.json({ success: true, message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ success: false, error: 'Failed to delete tenant' });
  }
});

module.exports = router;