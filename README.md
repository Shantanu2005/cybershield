<div align="center">
  <h1>🛡️ CyberShield</h1>
  <p><strong>Intelligent Cybercrime Reporting & Investigation Management System</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-22.x-339933?style=flat-square&logo=node.js&logoColor=white"/>
    <img src="https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white"/>
    <img src="https://img.shields.io/badge/MongoDB-7.x-47A248?style=flat-square&logo=mongodb&logoColor=white"/>
    <img src="https://img.shields.io/badge/Vanilla_JS-ES2022-F7DF1E?style=flat-square&logo=javascript&logoColor=black"/>
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square"/>
  </p>
</div>

---

## 📋 Overview

CyberShield is a full-stack web application that allows Indian citizens to report cybercrimes online, while administrators and investigators can manage, assign, and resolve cases through a unified dashboard.

Built with a **dark glassmorphism UI**, a **Node.js + Express REST API**, and a **MongoDB** database.

---

## ✨ Features

### 👤 Citizens
- Register & login securely
- Submit detailed cybercrime reports (Financial Fraud, Phishing, Cyberbullying, Hacking, Identity Theft, etc.)
- Upload evidence file names
- Track real-time case status with a visual phase tracker
- View full case timeline and investigator notes

### 🔍 Investigators
- Dashboard with assigned case overview
- Update case status with investigation notes
- Full case history visible

### 🛡️ Administrators
- System-wide statistics dashboard
- View and manage all submitted cases
- Assign investigators to cases
- Override case status at any time
- Manage citizens and investigator registry

---

## 🗂️ Project Structure

```
cybershield/
├── index.html              ← Frontend HTML (semantic, ARIA-accessible)
├── style.css               ← Organized CSS (design tokens → components → responsive)
├── app.js                  ← Frontend JS (API client, auth, renderers, helpers)
├── .gitignore
├── README.md
└── server/
    ├── server.js           ← Express app + Mongoose models + all API routes
    ├── package.json        ← Node dependencies
    └── .env                ← Environment variables (MongoDB URI, PORT)
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [MongoDB](https://www.mongodb.com/try/download/community) running locally **or** a [MongoDB Atlas](https://cloud.mongodb.com) URI

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/cybershield.git
cd cybershield
```

### 2. Install backend dependencies
```bash
cd server
npm install
```

### 3. Configure environment
The `server/.env` file is already included:
```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/cybershield
```
Edit `MONGO_URI` if you're using MongoDB Atlas:
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/cybershield
```

### 4. Start the server
```bash
# From the server/ directory:
node server.js

# Or with auto-reload during development:
npm run dev
```

You'll see:
```
✅ MongoDB connected → mongodb://localhost:27017/cybershield
⏳ Seeding database with sample data...
✅ Seeded: 6 users, 5 cases.

🛡️  CyberShield server running
   Frontend : http://localhost:3000/
   API base : http://localhost:3000/api
```

### 5. Open the app
> 🌐 **http://localhost:3000**

---

## 🔑 Sample Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Administrator | `admin` | `admin@123` |
| Investigator | `inv_raj` | `inv@123` |
| Investigator | `inv_priya` | `inv@123` |
| Citizen | `rahul` | `rahul@123` |
| Citizen | `sneha` | `sneha@123` |
| Citizen | `arjun` | `arjun@123` |

---

## 🔌 REST API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login with username/email + password |
| `POST` | `/api/auth/register` | Register a new citizen account |

### Cases
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cases` | Get all cases (admin) |
| `GET` | `/api/cases/user/:userId` | Get cases for a user or investigator |
| `POST` | `/api/cases` | Submit a new case |
| `PUT` | `/api/cases/:id` | Update case status / assign investigator |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users` | Get all users (admin) |
| `GET` | `/api/users/investigators` | Get all investigators |

---

## 🗄️ Database Schema

### `users` collection
| Field | Type | Description |
|-------|------|-------------|
| `username` | String | Unique login name |
| `password` | String | Plain-text (upgrade to bcrypt for production) |
| `role` | String | `user` \| `admin` \| `investigator` |
| `name`, `email`, `phone` | String | Contact details |
| `city`, `address` | String | Location |
| `department` | String | For investigators only |

### `cases` collection
| Field | Type | Description |
|-------|------|-------------|
| `caseNum` | Number | Auto-incremented from 1001 |
| `userId` | String | Submitting citizen's ID |
| `type` | String | Crime category |
| `description` | String | Full incident description |
| `status` | String | `Submitted` → `Under Review` → `Investigation` → `Resolved` |
| `assignedTo` | String | Investigator ID |
| `statusHistory` | Array | Timeline of all status changes with notes |
| `evidenceFiles` | Array | List of uploaded file names |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES2022) |
| Fonts | Google Fonts — Syne + DM Sans |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Dev Tools | nodemon |

---

## ⚠️ Troubleshooting

**Port already in use (EADDRINUSE)**
```powershell
# Free port 3000 (PowerShell):
Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**MongoDB connection failed**
- Make sure MongoDB service is running: `Get-Service MongoDB`
- Or start it: `net start MongoDB`

---

## 📄 License

MIT © 2024 CyberShield
