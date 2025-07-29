const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  propertyId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  maxPax: {
    type: Number,
    default: 1,
    min: 1
  },
  moveInDate: {
    type: Date,
    default: Date.now
  },
  rentPaymentDate: {
    type: Number,
    default: 1,
    min: 1,
    max: 31
  },
  rent: {
    type: Number,
    default: 0,
    min: 0
  },
  agentName: {
    type: String,
    trim: true,
    default: ''
  },
  agentPhone: {
    type: String,
    trim: true,
    default: ''
  },
  landlordBankAccount: {
    type: String,
    trim: true,
    default: ''
  },
  landlordBankName: {
    type: String,
    trim: true,
    default: ''
  },
  landlordAccountName: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Property', propertySchema);