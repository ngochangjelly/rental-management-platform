# Rental Management Platform - Skills & Features

## Overview
This document outlines the skills, features, and capabilities of the Rental Management Platform frontend application.

## Core Features

### 1. Property Management
- **Add/Edit/Delete Properties**
  - Property ID, address, unit information
  - Maximum occupancy (pax)
  - Rent amount and payment date
  - Move-in dates
  - Agent information (name, phone)
  - Landlord banking details
  - WiFi account information
  - AC service scheduling and company tracking
  - Property images (upload or URL)
  - WiFi images gallery
  - Room types (Master, Common, Store, etc.)

- **Property Cards Display**
  - Grid layout with 260px max-width cards
  - Property images or gradient placeholders
  - Quick view of rent, unit, and payment info
  - Investor-based filtering

### 2. Tenant Management
- **Tenant CRUD Operations**
  - Personal information (name, phone, email)
  - FIN and passport numbers
  - Avatar images
  - Registration status tracking
  - Main tenant designation
  - Roommate relationships
  - Multiple property assignments

- **Property-Based View**
  - Select property to view tenants
  - Unassigned tenants view
  - Occupancy timeline calendar
  - Registered tenants badge counter

- **Tenant Cards**
  - 260px max-width responsive cards
  - Avatar display (upload or generated initials)
  - Room type and rent information
  - Move-in/out dates
  - Registration and Facebook status
  - Roommate grouping with special styling

- **Advanced Features**
  - Excel import/export
  - Copy tenant data (all, registered, outdated)
  - Search and filter
  - TODO items per tenant
  - Document management (passport, visa images)
  - Signature collection for main tenants

### 3. Contract Management
- **Contract Operations**
  - Create and manage rental contracts
  - Associate tenants with properties
  - Contract start/end dates
  - Deposit and cleaning fee tracking
  - Document uploads

- **Contract Analysis**
  - AI-powered contract analysis
  - Extract key information
  - Identify risks and obligations

### 4. Bill Management
- **Electricity Bills**
  - Upload and track electricity bills
  - Property-based organization
  - Bill amount and period tracking
  - Image attachments

- **Bill Calculations**
  - Automatic per-tenant calculations
  - Proration based on occupancy
  - Historical tracking

### 5. Financial Reports
- **Rent Collection Reports**
  - Property-wise rent tracking
  - Monthly/yearly overviews
  - Payment status
  - Outstanding amounts

- **Expense Tracking**
  - Property expenses
  - Maintenance costs
  - Utility bills

- **Profit/Loss Analysis**
  - Revenue vs expenses
  - Property-wise profitability
  - Time-period comparisons

### 6. Investor Management
- **Investor Portal**
  - Dedicated login for investors
  - Property access control
  - Financial overview
  - Document access

- **Property Assignment**
  - Link properties to investors
  - Multi-property support
  - Access restrictions

### 7. User Interface Features
- **Responsive Design**
  - Mobile-optimized layouts
  - Touch-friendly interactions
  - Adaptive card grids (260px max-width)
  - Minimal gaps (2px) for compact layout

- **Visual Enhancements**
  - Property and tenant images
  - Gradient backgrounds
  - Status badges (registered, unregistered)
  - Color-coded information
  - Hover effects and transitions

- **Navigation**
  - Sidebar navigation
  - Breadcrumbs
  - Quick actions
  - Dashboard overview

### 8. Data Management
- **Import/Export**
  - Excel bulk operations
  - Template downloads
  - Data validation

- **Search & Filter**
  - Property search
  - Tenant search
  - Advanced filtering options

- **Clipboard Operations**
  - Copy formatted tenant data
  - Quick data sharing
  - Multiple format support

### 9. Calendar & Timeline
- **Tenant Occupancy Timeline**
  - Visual calendar view
  - Year navigation
  - Move-in/out tracking
  - Overlap detection

- **AC Service Calendar**
  - Quarterly service scheduling
  - Year-round view
  - Service date tracking

### 10. Integration Features
- **Telegram Integration**
  - Bot token configuration
  - Channel notifications
  - Property-specific channels

- **Facebook Integration**
  - Tenant Facebook profiles
  - Quick contact links

- **API Integration**
  - Backend API connectivity
  - Real-time data sync
  - Image uploads (Cloudinary)

## Technical Skills

### Frontend Technologies
- **Framework**: Vanilla JavaScript (ES6+)
- **UI Library**: Bootstrap 5
- **Build Tool**: Webpack 5
- **Icons**: Bootstrap Icons
- **Excel**: SheetJS (xlsx)

### Key Capabilities
- **Progressive Web App (PWA)**
  - Service Worker
  - Offline support
  - App manifest
  - Installable

- **Authentication**
  - JWT token management
  - Role-based access (Admin, Investor)
  - Secure storage

- **Image Handling**
  - Cloudinary integration
  - Clipboard paste upload
  - Image optimization
  - Avatar generation

- **State Management**
  - Component-based architecture
  - Event-driven updates
  - Cache management

## API Endpoints Used

### Properties
- `GET /api/properties` - List all properties
- `POST /api/properties` - Create property
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property
- `GET /api/properties/:id/tenants` - Get property tenants

### Tenants
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create tenant
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Delete tenant

### Bills
- `GET /api/bills` - List bills
- `POST /api/bills` - Upload bill
- `GET /api/bills/:propertyId` - Property bills

### Contracts
- `GET /api/contracts` - List contracts
- `POST /api/contracts` - Create contract

### Investors
- `GET /api/investors/properties` - Get investor properties
- `POST /api/auth/login/investor` - Investor login

### Documents
- `POST /api/upload` - Upload images/documents

## Deployment

### Build Process
```bash
npm run build
```

### Deployment Targets
- Netlify (Frontend hosting)
- Custom domains support
- Automated CI/CD

## Future Skills & Enhancements

### Planned Features
- Multi-language support
- Advanced analytics
- Automated rent reminders
- Maintenance request tracking
- Lease renewal automation
- Document e-signing
- Mobile native apps
- Real-time notifications
- Payment gateway integration

### Performance Optimizations
- Code splitting
- Lazy loading
- Image optimization
- Cache strategies
- Bundle size reduction

## Support & Documentation

For issues or feature requests:
- GitHub Issues: [Repository URL]
- Email: [Support Email]
- Documentation: [Docs URL]

---

Last Updated: January 2026
Version: 1.0.0
