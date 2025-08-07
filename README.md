# Rental Management Platform

[![Netlify Status](https://api.netlify.com/api/v1/badges/2f11dcaf-ac86-4f62-b962-9a090b858c28/deploy-status)](https://app.netlify.com/projects/rental-management-platform/deploys)

🏠 AI-powered rental management platform with tenancy agreement analysis and business utilities

## 🚀 Quick Start

```bash
git clone https://github.com/ngochangjelly/rental-management-platform.git
cd rental-management-platform
npm install
cp .env.example .env
npm start
```

Visit http://localhost:3000 and login with your credential

## ✨ Features

### ✅ Available Now

- **Contract Analysis**: AI-powered detection of unfavorable tenancy terms
- **Risk Assessment**: Categorizes issues by severity (High/Medium/Low)
- **Detailed Reports**: Generate downloadable analysis reports
- **Secure Authentication**: Session-based login system

### 🚧 Coming Soon

- Property Management
- Tenant Portal
- Payment Processing
- Maintenance Tracking

## 📋 Analysis Criteria

The system automatically detects:

| Issue Type                  | Risk Level | Description                              |
| --------------------------- | ---------- | ---------------------------------------- |
| Mandatory AC Service        | Medium     | Forces tenant to use specific contractor |
| Excessive Deposits          | High       | Security deposit > 2 months rent         |
| Subletting Restrictions     | Medium     | Prohibits subletting/assignment          |
| Early Termination Penalties | High       | Excessive penalties for breaking lease   |

## 🛠️ Installation

### Prerequisites

- Node.js v16+
- npm or yarn
- MongoDB Atlas account (or local MongoDB)

### Development Setup

```bash
# Clone repository
git clone https://github.com/ngochangjelly/rental-management-platform.git
cd rental-management-platform

# Install dependencies
npm install

# Set up environment
cp .env.example .env
```

#### Configure Environment Variables

Edit `.env` file with your settings:

```bash
# Authentication
APP_USERNAME=admin
APP_PASSWORD="your_secure_password_here"

# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority&appName=YourApp
DATABASE_NAME=your_database_name

# Claude AI Configuration (optional)
CLAUDE_API_KEY=your_claude_api_key_here

# Session Configuration
APP_SECRET=your_super_secret_session_key_here

# Server Configuration
PORT=3000
NODE_ENV=your_environment_here
```

```bash
# Start development server
npm run dev
```

### Production Deployment

```bash
# Using Docker
docker-compose up -d

# Or manual deployment
npm start
```

## 🔒 Security

⚠️ **Important**: Change default credentials before production:

- Update `ADMIN_PASSWORD` in `.env`
- Set strong `SESSION_SECRET`
- Enable HTTPS
- Configure firewall

## 📖 Documentation

- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Contributing Guide](docs/CONTRIBUTING.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

## 🎯 Example Analysis

When you upload a tenancy agreement, you might see:

```
🔴 HIGH RISK ISSUES (2)
• Excessive Security Deposit: 3 months required
• Early Termination Penalty: Full deposit forfeiture

🟡 MEDIUM RISK ISSUES (1)
• Mandatory AC Service: Must use landlord's contractor

🟢 LOW RISK ISSUES (2)
• No Pets Policy: Standard restrictions
• No Smoking: Standard prohibition
```

---

**Built with ❤️ for property managers and landlords**
