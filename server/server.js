/* ══════════════════════════════════════════════════════════════
   CYBERSHIELD — EXPRESS + MONGODB SERVER
   ══════════════════════════════════════════════════════════════
   Sections:
     1. Bootstrap & Config
     2. Mongoose Models  — User, Case
     3. Auth Routes      — POST /api/auth/login, /register
     4. Case Routes      — GET/POST/PUT /api/cases
     5. User Routes      — GET /api/users, /users/investigators
     6. Seed Data        — only runs on empty DB
     7. Start server
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   1. BOOTSTRAP & CONFIG
   ══════════════════════════════════════════════════════════════ */
require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

const app      = express();
const PORT     = process.env.PORT     || 3000;
const MONGO_URI= process.env.MONGO_URI|| 'mongodb://localhost:27017/cybershield';

/* Middleware */
app.use(cors());
app.use(express.json());

/* Serve the frontend (index.html, style.css, app.js) from the parent directory */
app.use(express.static(path.join(__dirname, '..')));

/* ══════════════════════════════════════════════════════════════
   2. MONGOOSE MODELS
   ══════════════════════════════════════════════════════════════ */

/* ── User Schema ── */
const userSchema = new mongoose.Schema({
  username:   { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['user','admin','investigator'], default: 'user' },
  name:       { type: String, required: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:      { type: String, default: '' },
  address:    { type: String, default: '' },
  city:       { type: String, default: '' },
  department: { type: String, default: '' },   // for investigators
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

/* ── Status History Sub-Schema ── */
const statusHistorySchema = new mongoose.Schema({
  status: String,
  date:   { type: Date, default: Date.now },
  note:   String,
}, { _id: false });

/* ── Case Schema ── */
const caseSchema = new mongoose.Schema({
  caseNum:       { type: Number, index: true },
  userId:        { type: String, required: true },    // string ID of the citizen
  userName:      { type: String, required: true },
  userEmail:     { type: String, default: '' },
  userPhone:     { type: String, default: '' },
  type:          { type: String, required: true },
  description:   { type: String, required: true },
  incidentDate:  { type: String, default: '' },
  incidentTime:  { type: String, default: '' },
  location:      { type: String, required: true },
  transactionId: { type: String, default: '' },
  bankName:      { type: String, default: '' },
  amount:        { type: String, default: '' },
  websiteUrl:    { type: String, default: '' },
  ipAddress:     { type: String, default: '' },
  deviceInfo:    { type: String, default: '' },
  evidenceFiles: [String],
  status:        { type: String, enum: ['Submitted','Under Review','Investigation','Resolved'], default: 'Submitted' },
  assignedTo:    { type: String, default: '' },       // investigator _id string
  assignedName:  { type: String, default: '' },
  statusHistory: [statusHistorySchema],
  submittedAt:   { type: Date, default: Date.now },
  updatedAt:     { type: Date, default: Date.now },
}, { timestamps: true });

/* Auto-increment caseNum before saving */
caseSchema.pre('save', async function (next) {
  if (this.isNew) {
    const last = await Case.findOne().sort({ caseNum: -1 }).select('caseNum');
    this.caseNum = last ? last.caseNum + 1 : 1001;
  }
  next();
});

const Case = mongoose.model('Case', caseSchema);

/* ══════════════════════════════════════════════════════════════
   3. AUTH ROUTES
   ══════════════════════════════════════════════════════════════ */
const authRouter = express.Router();

/* POST /api/auth/login */
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password are required.' });

  try {
    const user = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
    });
    if (!user || user.password !== password)
      return res.status(401).json({ message: 'Invalid credentials. Please try again.' });

    // Return user without password
    const { password: _, ...safe } = user.toObject();
    res.json(safe);
  } catch (err) {
    res.status(500).json({ message: 'Server error during login.' });
  }
});

/* POST /api/auth/register */
authRouter.post('/register', async (req, res) => {
  const { name, username, email, phone, city, address, password } = req.body;
  if (!name || !username || !email || !password)
    return res.status(400).json({ message: 'All required fields must be provided.' });
  if (password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });

  try {
    const exists = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] });
    if (exists) {
      const field = exists.username === username.toLowerCase() ? 'Username' : 'Email';
      return res.status(409).json({ message: `${field} is already taken.` });
    }
    const user = await User.create({ name, username, email, phone, city, address, password, role: 'user' });
    const { password: _, ...safe } = user.toObject();
    res.status(201).json(safe);
  } catch (err) {
    res.status(500).json({ message: 'Could not create account. Try again.' });
  }
});

app.use('/api/auth', authRouter);

/* ══════════════════════════════════════════════════════════════
   4. CASE ROUTES
   ══════════════════════════════════════════════════════════════ */
const caseRouter = express.Router();

/* GET /api/cases — all cases (admin) */
caseRouter.get('/', async (req, res) => {
  try {
    const cases = await Case.find().sort({ submittedAt: -1 });
    res.json(cases);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch cases.' });
  }
});

/* GET /api/cases/user/:userId — cases for a specific user OR investigator */
caseRouter.get('/user/:userId', async (req, res) => {
  try {
    // First find user to determine role
    const user = await User.findById(req.params.userId).catch(() => null);
    let filter = {};
    if (user && user.role === 'investigator') {
      filter = { assignedTo: req.params.userId };
    } else {
      filter = { userId: req.params.userId };
    }
    const cases = await Case.find(filter).sort({ submittedAt: -1 });
    res.json(cases);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user cases.' });
  }
});

/* POST /api/cases — submit new case */
caseRouter.post('/', async (req, res) => {
  const { userId, userName, userEmail, userPhone, type, description, location } = req.body;
  if (!userId || !type || !description || !location)
    return res.status(400).json({ message: 'Missing required case fields.' });

  try {
    const newCase = await Case.create({
      ...req.body,
      status: 'Submitted',
      submittedAt: new Date(),
      updatedAt:   new Date(),
      statusHistory: [{
        status: 'Submitted',
        date:   new Date(),
        note:   'Your complaint has been received and logged in the system.',
      }],
    });
    res.status(201).json(newCase);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to submit case. ' + err.message });
  }
});

/* PUT /api/cases/:id — update case (admin or investigator) */
caseRouter.put('/:id', async (req, res) => {
  const { invId, status, note, updatedBy } = req.body;
  try {
    const c = await Case.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Case not found.' });

    /* Admin: optionally reassign investigator */
    if (updatedBy === 'admin' && invId !== undefined) {
      if (invId) {
        const inv = await User.findById(invId);
        c.assignedTo   = invId;
        c.assignedName = inv ? inv.name : '';
      } else {
        c.assignedTo   = '';
        c.assignedName = '';
      }
    }

    /* Update status + push to history */
    if (status && status !== c.status) {
      c.status = status;
      c.statusHistory.push({
        status,
        date: new Date(),
        note: note || (updatedBy === 'admin' ? 'Status updated by administrator.' : 'Status updated by investigator.'),
      });
    } else if (note) {
      c.statusHistory.push({ status: c.status, date: new Date(), note });
    }

    c.updatedAt = new Date();
    await c.save();
    res.json(c);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update case. ' + err.message });
  }
});

app.use('/api/cases', caseRouter);

/* ══════════════════════════════════════════════════════════════
   5. USER ROUTES
   ══════════════════════════════════════════════════════════════ */
const userRouter = express.Router();

/* GET /api/users — all users (safe, no passwords) */
userRouter.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

/* GET /api/users/investigators */
userRouter.get('/investigators', async (req, res) => {
  try {
    const invs = await User.find({ role: 'investigator' }).select('-password');
    res.json(invs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch investigators.' });
  }
});

app.use('/api/users', userRouter);

/* ══════════════════════════════════════════════════════════════
   6. SEED DATA
   Seeds users & cases only if the DB is empty — runs once.
   ══════════════════════════════════════════════════════════════ */
async function seedDatabase() {
  const count = await User.countDocuments();
  if (count > 0) {
    console.log('  ✔ Database already seeded — skipping.');
    return;
  }

  console.log('  ⏳ Seeding database with sample data...');

  /* Users */
  const users = await User.create([
    {
      username: 'admin', password: 'admin@123', role: 'admin',
      name: 'System Admin', email: 'admin@cybershield.gov',
      phone: '9800000001', address: 'HQ, New Delhi', city: 'New Delhi',
    },
    {
      username: 'inv_raj', password: 'inv@123', role: 'investigator',
      name: 'Rajesh Kumar', email: 'raj.kumar@cybershield.gov',
      phone: '9800000002', address: 'Cyber Cell, Mumbai', city: 'Mumbai',
      department: 'Financial Crimes Unit',
    },
    {
      username: 'inv_priya', password: 'inv@123', role: 'investigator',
      name: 'Priya Sharma', email: 'priya.sharma@cybershield.gov',
      phone: '9800000003', address: 'Cyber Cell, Pune', city: 'Pune',
      department: 'Cyber-Forensics Cell',
    },
    {
      username: 'rahul', password: 'rahul@123', role: 'user',
      name: 'Rahul Mehta', email: 'rahul.mehta@gmail.com',
      phone: '9876543210', address: '23, Andheri West, Mumbai', city: 'Mumbai',
    },
    {
      username: 'sneha', password: 'sneha@123', role: 'user',
      name: 'Sneha Patel', email: 'sneha.patel@gmail.com',
      phone: '9876543211', address: '45, Baner, Pune', city: 'Pune',
    },
    {
      username: 'arjun', password: 'arjun@123', role: 'user',
      name: 'Arjun Singh', email: 'arjun.singh@gmail.com',
      phone: '9876543212', address: '78, Koregaon Park, Pune', city: 'Pune',
    },
  ]);

  const [admin, raj, priya, rahul, sneha, arjun] = users;
  const dAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

  /* Cases */
  await Case.create([
    {
      caseNum: 1001,
      userId: rahul._id.toString(), userName: rahul.name,
      userEmail: rahul.email, userPhone: rahul.phone,
      type: 'Financial Fraud',
      description: 'Received a call from someone claiming to be from SBI bank. They convinced me to share OTP and deducted ₹85,000 from my account.',
      incidentDate: dAgo(20).toISOString().slice(0,10), incidentTime: '14:30',
      location: 'Mumbai', transactionId: 'TXN20240202085123',
      bankName: 'SBI Bank', amount: '85000',
      evidenceFiles: ['screenshot_sms.jpg','bank_statement.pdf'],
      status: 'Investigation', assignedTo: raj._id.toString(), assignedName: raj.name,
      submittedAt: dAgo(18), updatedAt: dAgo(5),
      statusHistory: [
        { status: 'Submitted',     date: dAgo(18), note: 'Case received and logged.' },
        { status: 'Under Review',  date: dAgo(15), note: 'Case reviewed and assigned to Financial Crimes Unit.' },
        { status: 'Investigation', date: dAgo(5),  note: 'Active investigation underway. Contact with bank initiated.' },
      ],
    },
    {
      caseNum: 1002,
      userId: sneha._id.toString(), userName: sneha.name,
      userEmail: sneha.email, userPhone: sneha.phone,
      type: 'Phishing',
      description: 'I received an email claiming to be from HDFC bank asking me to update my KYC. I clicked the link and entered my details before realising it was fake.',
      incidentDate: dAgo(30).toISOString().slice(0,10), incidentTime: '09:15',
      location: 'Pune', bankName: 'HDFC Bank', amount: '0',
      websiteUrl: 'http://hdfc-kyc-update.fakesite.com',
      evidenceFiles: ['phishing_email.pdf','fake_website_screenshot.png'],
      status: 'Resolved', assignedTo: priya._id.toString(), assignedName: priya.name,
      submittedAt: dAgo(28), updatedAt: dAgo(10),
      statusHistory: [
        { status: 'Submitted',    date: dAgo(28), note: 'Complaint received.' },
        { status: 'Under Review', date: dAgo(25), note: 'Phishing URL identified and reported to CERT-In.' },
        { status: 'Investigation',date: dAgo(20), note: 'Forensic analysis of email headers completed.' },
        { status: 'Resolved',     date: dAgo(10), note: 'Website taken down. User credentials secured. Case closed.' },
      ],
    },
    {
      caseNum: 1003,
      userId: arjun._id.toString(), userName: arjun.name,
      userEmail: arjun.email, userPhone: arjun.phone,
      type: 'Cyberbullying',
      description: 'Unknown person is sending threatening messages on Instagram and has posted my personal photos without consent. Account: @bully_anon_2024',
      incidentDate: dAgo(10).toISOString().slice(0,10), incidentTime: '20:00',
      location: 'Pune', websiteUrl: 'https://instagram.com/bully_anon_2024',
      evidenceFiles: ['chat_screenshots.jpg','instagram_profile.png'],
      status: 'Under Review', assignedTo: priya._id.toString(), assignedName: priya.name,
      submittedAt: dAgo(9), updatedAt: dAgo(7),
      statusHistory: [
        { status: 'Submitted',    date: dAgo(9), note: 'Case registered.' },
        { status: 'Under Review', date: dAgo(7), note: 'Assigned to Cyber-Forensics Cell. Social media account flagged.' },
      ],
    },
    {
      caseNum: 1004,
      userId: rahul._id.toString(), userName: rahul.name,
      userEmail: rahul.email, userPhone: rahul.phone,
      type: 'Identity Theft',
      description: 'Someone created a fake profile on Facebook using my photos and is impersonating me to scam my contacts.',
      incidentDate: dAgo(5).toISOString().slice(0,10), incidentTime: '11:00',
      location: 'Mumbai', websiteUrl: 'https://facebook.com/fake_rahul',
      evidenceFiles: ['fake_profile.png'],
      status: 'Submitted', assignedTo: '', assignedName: '',
      submittedAt: dAgo(4), updatedAt: dAgo(4),
      statusHistory: [
        { status: 'Submitted', date: dAgo(4), note: 'Complaint received and awaiting review.' },
      ],
    },
    {
      caseNum: 1005,
      userId: sneha._id.toString(), userName: sneha.name,
      userEmail: sneha.email, userPhone: sneha.phone,
      type: 'Hacking',
      description: 'My Gmail account was hacked. I noticed suspicious login activity from an unknown location (Russia). All my important emails and files were accessed.',
      incidentDate: dAgo(3).toISOString().slice(0,10), incidentTime: '03:45',
      location: 'Pune', ipAddress: '192.0.2.45',
      evidenceFiles: ['google_security_alert.png','login_history.pdf'],
      status: 'Submitted', assignedTo: '', assignedName: '',
      submittedAt: dAgo(2), updatedAt: dAgo(2),
      statusHistory: [
        { status: 'Submitted', date: dAgo(2), note: 'Case submitted and pending assignment.' },
      ],
    },
  ]);

  console.log('  ✅ Seeded: 6 users, 5 cases.');
}

/* ══════════════════════════════════════════════════════════════
   7. START SERVER
   ══════════════════════════════════════════════════════════════ */
async function start() {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected → ${MONGO_URI}`);

    await seedDatabase();

    const server = app.listen(PORT, () => {
      console.log(`\n🛡️  CyberShield server running`);
      console.log(`   Frontend : http://localhost:${PORT}/`);
      console.log(`   API base : http://localhost:${PORT}/api\n`);
      console.log('   Sample credentials:');
      console.log('     Admin       → admin / admin@123');
      console.log('     Investigator→ inv_raj / inv@123');
      console.log('     Citizen     → rahul / rahul@123\n');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error(`   Run this to free it (PowerShell):`);
        console.error(`   Get-NetTCPConnection -LocalPort ${PORT} | Select-Object OwningProcess | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n`);
      } else {
        console.error('❌ Server error:', err.message);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
