const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');

// Get all properties
router.get('/', async (req, res) => {
  try {
    const properties = await Property.find().sort({ createdAt: -1 });
    res.json({ success: true, properties });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch properties' });
  }
});

// Get single property by ID
router.get('/:propertyId', async (req, res) => {
  try {
    const property = await Property.findOne({ propertyId: req.params.propertyId.toUpperCase() });
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }
    res.json({ success: true, property });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch property' });
  }
});

// Get tenants for a specific property
router.get('/:propertyId/tenants', async (req, res) => {
  try {
    const tenants = await Tenant.find({ properties: req.params.propertyId.toUpperCase() });
    res.json({ success: true, tenants });
  } catch (error) {
    console.error('Error fetching property tenants:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch property tenants' });
  }
});

// Create new property
router.post('/', async (req, res) => {
  try {
    const { 
      propertyId, 
      address, 
      unit, 
      maxPax, 
      moveInDate, 
      rentPaymentDate, 
      rent, 
      agentName, 
      agentPhone, 
      landlordBankAccount,
      landlordBankName,
      landlordAccountName
    } = req.body;

    // Validate required fields (only propertyId, address, and unit are mandatory)
    if (!propertyId || !address || !unit) {
      return res.status(400).json({ 
        success: false, 
        error: 'Property ID, address, and unit are required' 
      });
    }

    // Check if property with same ID already exists
    const existingProperty = await Property.findOne({ propertyId: propertyId.toUpperCase() });
    if (existingProperty) {
      return res.status(400).json({ 
        success: false, 
        error: 'Property with this ID already exists' 
      });
    }

    const property = new Property({
      propertyId: propertyId.toUpperCase().trim(),
      address: address.trim(),
      unit: unit.trim(),
      maxPax: maxPax ? parseInt(maxPax) : 1,
      moveInDate: moveInDate ? new Date(moveInDate) : new Date(),
      rentPaymentDate: rentPaymentDate ? parseInt(rentPaymentDate) : 1,
      rent: rent ? parseFloat(rent) : 0,
      agentName: agentName ? agentName.trim() : '',
      agentPhone: agentPhone ? agentPhone.trim() : '',
      landlordBankAccount: landlordBankAccount ? landlordBankAccount.trim() : '',
      landlordBankName: landlordBankName ? landlordBankName.trim() : '',
      landlordAccountName: landlordAccountName ? landlordAccountName.trim() : ''
    });

    await property.save();
    res.status(201).json({ success: true, property });
  } catch (error) {
    console.error('Error creating property:', error);
    if (error.code === 11000) {
      res.status(400).json({ success: false, error: 'Property with this ID already exists' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to create property' });
    }
  }
});

// Update property
router.put('/:propertyId', async (req, res) => {
  try {
    const { 
      address, 
      unit, 
      maxPax, 
      moveInDate, 
      rentPaymentDate, 
      rent, 
      agentName, 
      agentPhone, 
      landlordBankAccount,
      landlordBankName,
      landlordAccountName
    } = req.body;
    
    const property = await Property.findOne({ propertyId: req.params.propertyId.toUpperCase() });
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Update fields if provided
    if (address) property.address = address.trim();
    if (unit) property.unit = unit.trim();
    if (maxPax) property.maxPax = parseInt(maxPax);
    if (moveInDate) property.moveInDate = new Date(moveInDate);
    if (rentPaymentDate) property.rentPaymentDate = parseInt(rentPaymentDate);
    if (rent) property.rent = parseFloat(rent);
    if (agentName) property.agentName = agentName.trim();
    if (agentPhone) property.agentPhone = agentPhone.trim();
    if (landlordBankAccount) property.landlordBankAccount = landlordBankAccount.trim();
    if (landlordBankName) property.landlordBankName = landlordBankName.trim();
    if (landlordAccountName) property.landlordAccountName = landlordAccountName.trim();

    await property.save();
    res.json({ success: true, property });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ success: false, error: 'Failed to update property' });
  }
});

// Delete property
router.delete('/:propertyId', async (req, res) => {
  try {
    const propertyId = req.params.propertyId.toUpperCase();
    
    // Check if there are tenants associated with this property
    const tenants = await Tenant.find({ properties: propertyId });
    if (tenants.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot delete property. There are ${tenants.length} tenant(s) still associated with this property.` 
      });
    }

    const property = await Property.findOneAndDelete({ propertyId: propertyId });
    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }
    
    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ success: false, error: 'Failed to delete property' });
  }
});

module.exports = router;