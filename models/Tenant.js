const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  fin: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  passportNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  isRegistered: {
    type: Boolean,
    default: false
  },
  isMainTenant: {
    type: Boolean,
    default: false
  },
  properties: [{
    type: String,
    ref: 'Property',
    trim: true,
    uppercase: true
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Tenant', tenantSchema);