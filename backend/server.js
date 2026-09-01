import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import crypto from 'crypto';

// Mongoose Models
import User from './models/User.js';
import Campaign from './models/Campaign.js';
import Proposal from './models/Proposal.js';
import Payout from './models/Payout.js';
import Dispute from './models/Dispute.js';
import AuditLog from './models/AuditLog.js';
import Message from './models/Message.js';
import CampaignUpdate from './models/CampaignUpdate.js';
import Notification from './models/Notification.js';
import bcrypt from 'bcryptjs';

dotenv.config();

// Supabase Integration
import { supabase, isSupabaseConfigured } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Enable socket.io integration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('Notice: Could not create uploads directory:', err.message);
}

// Serve uploaded documents statically
app.use('/uploads', express.static(uploadDir));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, PNG, and PDF files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

const cpUpload = upload.fields([
  { name: 'studentIdCardImage', maxCount: 1 },
  { name: 'nidCardImage', maxCount: 1 },
  { name: 'nidOrPassportImage', maxCount: 1 },
  { name: 'credentialsImage', maxCount: 1 }
]);

// IN-MEMORY FALLBACK STORE
const fallbackUsers = [];

// Populate generated 30 investors and 100 student founders into fallback store
try {
  const seedPath = path.join(__dirname, 'seed_generated.json');
  if (fs.existsSync(seedPath)) {
    const rawData = fs.readFileSync(seedPath, 'utf8');
    const parsedSeed = JSON.parse(rawData);
    if (Array.isArray(parsedSeed.founders)) fallbackUsers.push(...parsedSeed.founders);
    if (Array.isArray(parsedSeed.investors)) fallbackUsers.push(...parsedSeed.investors);
  }
} catch (e) {
  console.warn('Seed generated JSON read warning:', e.message);
}

// Add Default Admin User if missing
if (!fallbackUsers.some(u => u.email === 'admin@fundbridge.com')) {
  fallbackUsers.unshift({
    _id: 'usr_admin_1',
    id: 'usr_admin_1',
    name: 'ADMIN_PRITOM',
    email: 'admin@fundbridge.com',
    password: 'admin123',
    role: 'admin',
    vettingStatus: 'verified',
    vetting_status: 'verified',
    mfsNumber: '01799999999'
  });
}

const fallbackCampaigns = [];

// Populate 50 generated campaigns into fallback store
try {
  const seedPath = path.join(__dirname, 'seed_generated.json');
  if (fs.existsSync(seedPath)) {
    const rawData = fs.readFileSync(seedPath, 'utf8');
    const parsedSeed = JSON.parse(rawData);
    if (Array.isArray(parsedSeed.campaigns)) fallbackCampaigns.push(...parsedSeed.campaigns);
  }
} catch (e) {
  console.warn('Seed campaigns read warning:', e.message);
}

// S3: persist investment campaigns so create/edit/milestones survive backend restarts
const S3_CAMPAIGN_STORE_PATH = path.join(__dirname, 's3_campaign_store.json');

// S3
const loadS3CampaignStore = () => {
  try {
    if (!fs.existsSync(S3_CAMPAIGN_STORE_PATH)) return;
    const raw = fs.readFileSync(S3_CAMPAIGN_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const camp of parsed) {
      if (!camp || !(camp.id || camp._id)) continue;
      const id = camp.id || camp._id;
      const idx = fallbackCampaigns.findIndex((c) => c.id === id || c._id === id);
      if (idx >= 0) fallbackCampaigns[idx] = camp;
      else fallbackCampaigns.unshift(camp);
    }
  } catch (e) {
    console.warn('S3 campaign store load warning:', e.message);
  }
};

// S3
const persistS3CampaignStore = () => {
  try {
    fs.writeFileSync(S3_CAMPAIGN_STORE_PATH, JSON.stringify(fallbackCampaigns, null, 2), 'utf8');
  } catch (e) {
    console.warn('S3 campaign store save warning:', e.message);
  }
};

loadS3CampaignStore(); // S3

// S3: login id may be a Supabase uuid while persisted rows use usr_founder_1
const S3_DEMO_FOUNDER_EMAIL = 'ashraf.khan1@univ.edu.bd';
const s3FounderOwnerKeys = async (founderId) => {
  const keys = new Set([String(founderId || '')]);
  const fb = fallbackUsers.find((u) => String(u.id || u._id) === String(founderId));
  if (fb) {
    keys.add(String(fb.id || fb._id));
    if (String(fb.email || '').toLowerCase() === S3_DEMO_FOUNDER_EMAIL) keys.add('usr_founder_1');
  }
  if (String(founderId) === 'usr_founder_1') keys.add('usr_founder_1');
  return keys;
};
const s3CampaignOwnedBy = (c, keys) => {
  const owners = [c.founder?._id, c.founder?.id, c.founder_id, c.founderId, typeof c.founder === 'string' ? c.founder : null]
    .filter(Boolean)
    .map((x) => String(x));
  return owners.some((o) => keys.has(o));
};

// S3: post-approval edit requests (max 2 working days; BD weekend Fri+Sat)
const S3_EDIT_REQUEST_STORE_PATH = path.join(__dirname, 's3_edit_requests.json');
const fallbackEditRequests = [];

// S3
const addWorkingDaysBD = (fromDate, days) => {
  const d = new Date(fromDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 5 && wd !== 6) added++; // skip Friday & Saturday
  }
  return d.toISOString();
};

// S3
const loadS3EditRequestStore = () => {
  try {
    if (!fs.existsSync(S3_EDIT_REQUEST_STORE_PATH)) return;
    const raw = fs.readFileSync(S3_EDIT_REQUEST_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      fallbackEditRequests.length = 0;
      fallbackEditRequests.push(...parsed);
    }
  } catch (e) {
    console.warn('S3 edit-request store load warning:', e.message);
  }
};

// S3
const persistS3EditRequestStore = () => {
  try {
    fs.writeFileSync(S3_EDIT_REQUEST_STORE_PATH, JSON.stringify(fallbackEditRequests, null, 2), 'utf8');
  } catch (e) {
    console.warn('S3 edit-request store save warning:', e.message);
  }
};

loadS3EditRequestStore(); // S3

const fallbackProposals = [];

// S3: persist proposals so founder Investors tab survives restart
const S3_PROPOSAL_STORE_PATH = path.join(__dirname, 's3_proposals.json');
const loadS3ProposalStore = () => {
  try {
    if (!fs.existsSync(S3_PROPOSAL_STORE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(S3_PROPOSAL_STORE_PATH, 'utf8'));
    if (Array.isArray(parsed) && parsed.length > 0) {
      const byId = new Map(fallbackProposals.map((p) => [p.id || p._id, p]));
      parsed.forEach((p) => {
        const id = p && (p.id || p._id);
        if (id) byId.set(id, p);
      });
      fallbackProposals.length = 0;
      fallbackProposals.push(...byId.values());
    }
  } catch (e) {
    console.warn('S3 proposal store load warning:', e.message);
  }
};
const persistS3ProposalStore = () => {
  try {
    fs.writeFileSync(S3_PROPOSAL_STORE_PATH, JSON.stringify(fallbackProposals, null, 2), 'utf8');
  } catch (e) {
    console.warn('S3 proposal store save warning:', e.message);
  }
};
loadS3ProposalStore(); // S3
const fallbackPayouts = [];
const fallbackMessages = [];
const fallbackUpdates = [];
const fallbackProgressTags = {}; // S3: { [campaignId]: string[] }

// S3: persist chat so two-way threads survive restart (Supabase + local file)
const S3_MESSAGE_STORE_PATH = path.join(__dirname, 's3_messages.json');
const loadS3MessageStore = () => {
  try {
    if (!fs.existsSync(S3_MESSAGE_STORE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(S3_MESSAGE_STORE_PATH, 'utf8'));
    if (Array.isArray(parsed) && parsed.length > 0) {
      const byId = new Map(fallbackMessages.map((m) => [m.id, m]));
      parsed.forEach((m) => {
        if (m && m.id) byId.set(m.id, m);
      });
      fallbackMessages.length = 0;
      fallbackMessages.push(...byId.values());
    }
  } catch (e) {
    console.warn('S3 message store load warning:', e.message);
  }
};
const persistS3MessageStore = () => {
  try {
    fs.writeFileSync(S3_MESSAGE_STORE_PATH, JSON.stringify(fallbackMessages, null, 2), 'utf8');
  } catch (e) {
    console.warn('S3 message store save warning:', e.message);
  }
};
loadS3MessageStore(); // S3
const hydrateChatFromSupabase = async () => {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (error || !Array.isArray(data)) {
      if (error) console.warn('S3 supabase chat hydrate:', error.message);
      return;
    }
    const byId = new Map(fallbackMessages.map((m) => [m.id, m]));
    data.forEach((m) => {
      if (m && m.id) byId.set(m.id, m);
    });
    fallbackMessages.length = 0;
    fallbackMessages.push(...byId.values());
    persistS3MessageStore();
  } catch (e) {
    console.warn('S3 supabase chat hydrate warning:', e.message);
  }
};
hydrateChatFromSupabase(); // S3

const persistChatMessageS3 = async (msgObj) => {
  if (!msgObj) return;
  if (!fallbackMessages.some((m) => m.id === msgObj.id)) fallbackMessages.push(msgObj);
  persistS3MessageStore();
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('messages').insert([msgObj]);
    if (error && !String(error.message || '').toLowerCase().includes('duplicate')) {
      console.warn('S3 supabase chat insert:', error.message);
    }
  }
};

// S3: founder audit log (Supabase audit_logs + file). Does not change GET /api/audit-logs
const fallbackAuditLogs = [];
const S3_AUDIT_STORE_PATH = path.join(__dirname, 's3_audit_logs.json');
const loadS3AuditStore = () => {
  try {
    if (!fs.existsSync(S3_AUDIT_STORE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(S3_AUDIT_STORE_PATH, 'utf8'));
    if (Array.isArray(parsed) && parsed.length > 0) {
      const byId = new Map(fallbackAuditLogs.map((r) => [r.id, r]));
      parsed.forEach((r) => { if (r && r.id) byId.set(r.id, r); });
      fallbackAuditLogs.length = 0;
      fallbackAuditLogs.push(...byId.values());
    }
  } catch (e) {
    console.warn('S3 audit store load warning:', e.message);
  }
};
const persistS3AuditStore = () => {
  try {
    fs.writeFileSync(S3_AUDIT_STORE_PATH, JSON.stringify(fallbackAuditLogs, null, 2), 'utf8');
  } catch (e) {
    console.warn('S3 audit store save warning:', e.message);
  }
};
loadS3AuditStore(); // S3
const founderIdFromAuditId = (id) => {
  const s = String(id || '');
  const m = s.match(/^aud::(.+)::\d+$/);
  return m ? m[1] : '';
};
const hydrateAuditFromSupabase = async () => {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return;
    const byId = new Map(fallbackAuditLogs.map((r) => [r.id, r]));
    data.forEach((r) => {
      if (!r || !r.id) return;
      const founder_id = r.founder_id || founderIdFromAuditId(r.id);
      byId.set(r.id, { ...r, founder_id });
    });
    fallbackAuditLogs.length = 0;
    fallbackAuditLogs.push(...byId.values());
    persistS3AuditStore();
  } catch (e) {
    console.warn('S3 supabase audit hydrate warning:', e.message);
  }
};
hydrateAuditFromSupabase(); // S3
const writeFounderAuditLog = async ({ founderId, category, title, status = 'RECORDED' }) => {
  if (!founderId || !title) return;
  const created_at = new Date().toISOString();
  const payload = JSON.stringify({ founderId, category, title, status, created_at });
  const hash = '0x' + crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  const row = {
    id: `aud::${founderId}::${Date.now()}`,
    hash,
    category: String(category || 'FOUNDER').toUpperCase(),
    title: String(title),
    status: String(status || 'RECORDED').toUpperCase(),
    latency: '<1s',
    created_at,
    founder_id: String(founderId)
  };
  fallbackAuditLogs.unshift(row);
  persistS3AuditStore();
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('audit_logs').insert([{
      id: row.id,
      hash: row.hash,
      category: row.category,
      title: row.title,
      status: row.status,
      latency: row.latency,
      created_at: row.created_at
    }]);
    if (error) console.warn('S3 supabase audit insert:', error.message);
  }
};

// S3: persist progress announcements so they survive server restart
const S3_UPDATE_STORE_PATH = path.join(__dirname, 's3_campaign_updates.json');
const loadS3UpdateStore = () => {
  try {
    if (!fs.existsSync(S3_UPDATE_STORE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(S3_UPDATE_STORE_PATH, 'utf8'));
    if (Array.isArray(parsed)) {
      fallbackUpdates.length = 0;
      fallbackUpdates.push(...parsed);
    }
  } catch (e) {
    console.warn('S3 campaign-update store load warning:', e.message);
  }
};
const persistS3UpdateStore = () => {
  try {
    fs.writeFileSync(S3_UPDATE_STORE_PATH, JSON.stringify(fallbackUpdates, null, 2), 'utf8');
  } catch (e) {
    console.warn('S3 campaign-update store save warning:', e.message);
  }
};
loadS3UpdateStore(); // S3

// S3: persist custom progress tags
const S3_PROGRESS_TAG_STORE_PATH = path.join(__dirname, 's3_progress_tags.json');
const loadS3ProgressTagStore = () => {
  try {
    if (!fs.existsSync(S3_PROGRESS_TAG_STORE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(S3_PROGRESS_TAG_STORE_PATH, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.keys(fallbackProgressTags).forEach((k) => delete fallbackProgressTags[k]);
      Object.assign(fallbackProgressTags, parsed);
    }
  } catch (e) {
    console.warn('S3 progress-tag store load warning:', e.message);
  }
};
const persistS3ProgressTagStore = () => {
  try {
    fs.writeFileSync(S3_PROGRESS_TAG_STORE_PATH, JSON.stringify(fallbackProgressTags, null, 2), 'utf8');
  } catch (e) {
    console.warn('S3 progress-tag store save warning:', e.message);
  }
};
loadS3ProgressTagStore(); // S3

// S3: persist payout requests
const S3_PAYOUT_STORE_PATH = path.join(__dirname, 's3_payouts.json');
const loadS3PayoutStore = () => {
  try {
    if (!fs.existsSync(S3_PAYOUT_STORE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(S3_PAYOUT_STORE_PATH, 'utf8'));
    if (Array.isArray(parsed)) {
      fallbackPayouts.length = 0;
      fallbackPayouts.push(...parsed);
    }
  } catch (e) {
    console.warn('S3 payout store load warning:', e.message);
  }
};
const persistS3PayoutStore = () => {
  try {
    fs.writeFileSync(S3_PAYOUT_STORE_PATH, JSON.stringify(fallbackPayouts, null, 2), 'utf8');
  } catch (e) {
    console.warn('S3 payout store save warning:', e.message);
  }
};
loadS3PayoutStore(); // S3

// S3: founder security deposit ledger (recorded amount; not a payment gateway)
const S3_DEPOSIT_STORE_PATH = path.join(__dirname, 's3_security_deposits.json');
const fallbackSecurityDeposits = {};
const loadS3DepositStore = () => {
  try {
    if (!fs.existsSync(S3_DEPOSIT_STORE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(S3_DEPOSIT_STORE_PATH, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.keys(fallbackSecurityDeposits).forEach((k) => delete fallbackSecurityDeposits[k]);
      Object.assign(fallbackSecurityDeposits, parsed);
    }
  } catch (e) {
    console.warn('S3 security-deposit store load warning:', e.message);
  }
};
const persistS3DepositStore = () => {
  try {
    fs.writeFileSync(S3_DEPOSIT_STORE_PATH, JSON.stringify(fallbackSecurityDeposits, null, 2), 'utf8');
  } catch (e) {
    console.warn('S3 security-deposit store save warning:', e.message);
  }
};
loadS3DepositStore(); // S3
const fallbackWatchlist = [];
const fallbackConnections = [];
const fallbackBookmarkedFounders = [];
const fallbackNotifications = [
  { id: 'notif_1', user_id: 'usr_founder_1', title: 'New Proposal Received', message: 'Angel Backer Zaman submitted an 8% Rev. Share proposal for CampusBites.', type: 'info', is_read: false, created_at: new Date().toISOString() },
  { id: 'notif_2', user_id: 'usr_investor_1', title: 'Vetting Verified', message: 'Your investor identity vetting has been approved by platform administration.', type: 'success', is_read: true, created_at: new Date().toISOString() }
];

// NORMALIZATION HELPERS
const normalizeUser = (u) => {
  if (!u) return null;
  const status = u.vetting_status || u.vettingStatus || (u.role === 'admin' ? 'verified' : 'pending');
  return {
    _id: u.id || u._id,
    id: u.id || u._id,
    name: u.name,
    email: u.email,
    role: u.role || 'founder',
    vettingStatus: status,
    vetting_status: status,
    mfsNumber: u.mfs_number || u.mfsNumber || '',
    mfs_number: u.mfs_number || u.mfsNumber || '',
    university: u.university || '',
    studentId: u.student_id || u.studentId || '',
    studentIdCardImage: u.student_id_card_image || u.studentIdCardImage || '',
    nidCardImage: u.nid_card_image || u.nidCardImage || '',
    department: u.department || '',
    nid: u.nid || '',
    institution: u.institution || '',
    affiliationStatus: u.affiliation_status || u.affiliationStatus || '',
    passingYear: u.passing_year || u.passingYear || '',
    bio: u.bio || ''
  };
};

const normalizeCampaign = (c) => {
  if (!c) return null;
  const fId = c.founder_id || c.founderId || (typeof c.founder === 'object' ? (c.founder?._id || c.founder?.id) : c.founder);
  const foundUser = fallbackUsers.find(u => u.id === fId || u._id === fId);
  const status = c.status || (c.verified === true ? 'verified' : 'pending');
  const isVerified = c.verified !== undefined ? Boolean(c.verified) : (status === 'verified');
  const founderObj = (typeof c.founder === 'object' && c.founder?.name && c.founder?.university) ? c.founder : (foundUser ? {
    _id: foundUser.id || foundUser._id,
    id: foundUser.id || foundUser._id,
    name: foundUser.name,
    email: foundUser.email,
    university: foundUser.university,
    department: foundUser.department,
    studentId: foundUser.studentId || foundUser.student_id,
    mfsNumber: foundUser.mfsNumber || foundUser.mfs_number,
    vettingStatus: foundUser.vettingStatus || foundUser.vetting_status || 'verified',
    bio: foundUser.bio || ''
  } : {
    _id: fId || 'usr_founder_1',
    id: fId || 'usr_founder_1',
    name: 'Anika Rahman',
    email: 'anika@brac.edu.bd',
    university: c.university || 'BRAC University',
    department: 'Computer Science & Engineering',
    studentId: '20101452',
    mfsNumber: '01711223344',
    vettingStatus: 'verified'
  });

  return {
    _id: c.id || c._id,
    id: c.id || c._id,
    title: c.title,
    founderId: fId,
    founder_id: fId,
    founder: founderObj,
    university: c.university || founderObj.university || '',
    location: c.location || 'Dhaka, Bangladesh',
    category: c.category || 'Startup Venture',
    stage: c.stage || 'MVP Stage',
    goal: Number(c.goal || 0),
    raised: Number(c.raised || 0),
    equityOffer: c.equity_offer || c.equityOffer || '8% Revenue Share',
    equity_offer: c.equity_offer || c.equityOffer || '8% Revenue Share',
    tagline: c.tagline || '',
    coverPhoto: c.cover_photo || c.coverPhoto || '',
    pitchVideoUrl: c.pitch_video_url || c.pitchVideoUrl || '',
    description: c.description || '',
    milestones: c.milestones || [],
    verified: isVerified,
    status: status,
    escrowFrozen: c.escrow_frozen || c.escrowFrozen || false,
    escrow_frozen: c.escrow_frozen || c.escrowFrozen || false
  };
};

const normalizeProposal = (p) => {
  if (!p) return null;
  return {
    _id: p.id || p._id,
    id: p.id || p._id,
    campaign_id: p.campaign_id || p.campaignId || (typeof p.campaign === 'object' ? p.campaign?.id : p.campaign),
    campaignId: p.campaign_id || p.campaignId || (typeof p.campaign === 'object' ? p.campaign?.id : p.campaign),
    investor_id: p.investor_id || p.investorId || (typeof p.investor === 'object' ? p.investor?._id : p.investor),
    investorId: p.investor_id || p.investorId || (typeof p.investor === 'object' ? p.investor?._id : p.investor),
    amount: Number(p.amount || 0),
    terms: p.terms || p.return_structure || 'Standard Terms',
    return_structure: p.return_structure || p.terms || 'Standard Terms',
    custom_notes: p.custom_notes || p.customNotes || '',
    status: p.status || 'pending',
    created_at: p.created_at || p.createdAt || new Date().toISOString()
  };
};

// Helper function to create and broadcast real-time notifications
async function createAndDispatchNotification(userId, title, message, type = 'info') {
  const notifObj = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    user_id: userId,
    title,
    message,
    type,
    is_read: false,
    created_at: new Date().toISOString()
  };
  fallbackNotifications.unshift(notifObj);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('notifications').insert([notifObj]);
    } catch (e) {}
  }

  // Socket.io real-time broadcast
  if (typeof io !== 'undefined' && io) {
    io.to(userId).emit('receive_notification', notifObj);
    io.emit('new_notification_broadcast', notifObj);
  }
  return notifObj;
}

// Health Check API
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let provider = 'none';
  if (isSupabaseConfigured && supabase) {
    dbStatus = 'connected';
    provider = 'supabase';
  } else if (mongoose.connection.readyState === 1) {
    dbStatus = 'connected';
    provider = 'mongodb';
  } else {
    dbStatus = 'in_memory_fallback';
  }

  res.status(200).json({ 
    status: 'healthy', 
    database: dbStatus,
    provider,
    supabaseConfigured: isSupabaseConfigured
  });
});

// AUTHENTICATION & USER MANAGEMENT APIS
app.post('/api/users/register', cpUpload, async (req, res) => {
  try {
    const { name, email, password, role, university, studentId, department, nid, dob, affiliationStatus, institution, passingYear, nidOrPassport, bankOrMfs, credentialsLink, mfsNumber } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `usr_${Date.now()}`;

    const newUserObj = {
      id: userId,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      vetting_status: 'pending',
      vettingStatus: 'pending',
      mfs_number: mfsNumber || '01700000000',
      mfsNumber: mfsNumber || '01700000000',
      university: university || '',
      student_id: studentId || '',
      department: department || '',
      nid: nid || '',
      institution: institution || '',
      affiliation_status: affiliationStatus || '',
      passing_year: passingYear || ''
    };

    let createdUser = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: supaUser } = await supabase.from('users').insert([{
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          role,
          vetting_status: 'pending',
          mfs_number: mfsNumber || '01700000000',
          university: university || '',
          student_id: studentId || '',
          department: department || '',
          nid: nid || '',
          institution: institution || '',
          affiliation_status: affiliationStatus || '',
          passing_year: passingYear || ''
        }]).select().single();

        if (supaUser) createdUser = normalizeUser(supaUser);
      } catch (e) {
        console.warn('Supabase register insert warning:', e.message);
      }
    }

    if (!createdUser && mongoose.connection.readyState === 1) {
      try {
        const mongoUser = await User.create({
          name,
          email: email.toLowerCase(),
          password: hashedPassword,
          role,
          mfsNumber: mfsNumber || '01700000000',
          university,
          studentId,
          department,
          nid,
          institution,
          affiliationStatus,
          passingYear
        });
        createdUser = normalizeUser(mongoUser);
      } catch (e) {
        console.warn('Mongo register warning:', e.message);
      }
    }

    const fallbackUser = normalizeUser(newUserObj);
    fallbackUsers.push(fallbackUser);

    const userToReturn = createdUser || fallbackUser;

    res.status(201).json({
      message: 'Registration successful.',
      user: userToReturn,
      token: 'jwt-auth-token-db'
    });
  } catch (err) {
    console.error('Error during register:', err);
    res.status(500).json({ error: 'Server error during user registration.' });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    let user = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: supaUser } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
        if (supaUser) {
          user = normalizeUser(supaUser);
          user.password = supaUser.password;
        }
      } catch (e) {
        user = null;
      }
    }

    if (!user && mongoose.connection.readyState === 1) {
      try {
        const mongoUser = await User.findOne({ email: email.toLowerCase() });
        if (mongoUser) {
          user = normalizeUser(mongoUser);
          user.password = mongoUser.password;
        }
      } catch (e) {
        user = null;
      }
    }

    if (!user) {
      const fb = fallbackUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (fb) {
        user = normalizeUser(fb);
        user.password = fb.password;
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    let matches = false;
    if (user.password === password) {
      matches = true;
    } else if (user.password) {
      try {
        matches = await bcrypt.compare(password, user.password);
      } catch (e) {
        matches = false;
      }
    }

    if (!matches) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    res.status(200).json({
      message: 'Authentication successful.',
      token: user.role === 'admin' ? 'jwt-admin-token-db-active' : 'jwt-user-token-db-active',
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vettingStatus: user.vettingStatus,
        mfsNumber: user.mfsNumber,
        university: user.university,
        nid: user.nid,
        institution: user.institution,
        designation: user.passingYear
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: supaUser } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).eq('role', 'admin').single();
        if (supaUser) user = normalizeUser(supaUser);
      } catch (e) {}
    }

    if (!user && mongoose.connection.readyState === 1) {
      try {
        user = await User.findOne({ email, role: 'admin' });
      } catch (e) {}
    }

    if (!user) {
      user = fallbackUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.role === 'admin');
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    res.status(200).json({
      message: 'Admin authentication successful.',
      token: 'jwt-admin-token-db-active',
      user: { name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during administrator login.' });
  }
});

// VETTING QUEUE & USER CONTROL APIS
app.get('/api/vetting/applicants', async (req, res) => {
  try {
    let pendingUsers = [];
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('vetting_status', 'pending');
      if (!error && data) pendingUsers = data.map(normalizeUser);
    } else if (mongoose.connection.readyState === 1) {
      const users = await User.find({ vettingStatus: 'pending' });
      if (users) pendingUsers = users.map(normalizeUser);
    } else {
      pendingUsers = fallbackUsers.filter(u => u.role !== 'admin' && (u.vettingStatus === 'pending' || u.vetting_status === 'pending')).map(normalizeUser);
    }

    // Fallback seed if queue empty for demo testing
    if (pendingUsers.length === 0 && fallbackUsers.length > 0) {
      const demoApplicant = fallbackUsers.find(u => u.email === 'anika@brac.edu.bd') || fallbackUsers.find(u => u.role === 'founder');
      if (demoApplicant) {
        demoApplicant.vettingStatus = 'pending';
        demoApplicant.vetting_status = 'pending';
        pendingUsers.push(normalizeUser(demoApplicant));
      }
    }
    res.status(200).json(pendingUsers);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching vetting applicants.' });
  }
});

app.post('/api/vetting/status', async (req, res) => {
  try {
    const { userId, status } = req.body;
    if (!userId || !status) return res.status(400).json({ error: 'User ID and status are required.' });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('users').update({ vetting_status: status, vetting_date: new Date().toISOString() }).eq('id', userId);
      } catch (e) {}
    }
    if (mongoose.connection.readyState === 1) {
      try {
        await User.findByIdAndUpdate(userId, { vettingStatus: status });
      } catch (e) {}
    }

    const fu = fallbackUsers.find(u => u.id === userId || u._id === userId);
    if (fu) {
      fu.vettingStatus = status;
      fu.vetting_status = status;
      fu.vettingDate = new Date().toISOString();
    }

    await createAndDispatchNotification(
      userId,
      `Trust Vetting Status Updated! 🛡️`,
      `Your FundBridge user profile vetting status has been updated to "${status.toUpperCase()}".`,
      status === 'verified' ? 'success' : 'warning'
    );

    res.status(200).json({ message: `Applicant status updated to ${status}.`, user: fu ? normalizeUser(fu) : { id: userId, vettingStatus: status } });
  } catch (err) {
    res.status(500).json({ error: 'Error updating vetting status.' });
  }
});

app.post('/api/admin/users/:userId/hold', async (req, res) => {
  try {
    const { userId } = req.params;
    const fu = fallbackUsers.find(u => u.id === userId || u._id === userId);
    let newStatus = 'hold';
    if (fu) {
      newStatus = (fu.vettingStatus === 'hold' || fu.vetting_status === 'hold') ? 'verified' : 'hold';
      fu.vettingStatus = newStatus;
      fu.vetting_status = newStatus;
    }

    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('users').update({ vetting_status: newStatus }).eq('id', userId); } catch (e) {}
    }

    res.status(200).json({ message: `User hold status toggled to ${newStatus}.`, vettingStatus: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Error toggling user hold status.' });
  }
});

app.post('/api/admin/users/:userId/block', async (req, res) => {
  try {
    const { userId } = req.params;
    const fu = fallbackUsers.find(u => u.id === userId || u._id === userId);
    let newStatus = 'blocked';
    if (fu) {
      newStatus = (fu.vettingStatus === 'blocked' || fu.vetting_status === 'blocked') ? 'verified' : 'blocked';
      fu.vettingStatus = newStatus;
      fu.vetting_status = newStatus;
    }

    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('users').update({ vetting_status: newStatus }).eq('id', userId); } catch (e) {}
    }

    res.status(200).json({ message: `User status set to ${newStatus}.`, user: fu ? normalizeUser(fu) : { id: userId, vettingStatus: newStatus } });
  } catch (err) {
    res.status(500).json({ error: 'Error blocking user.' });
  }
});

app.put('/api/admin/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const fu = fallbackUsers.find(u => u.id === userId || u._id === userId);
    if (fu) {
      Object.assign(fu, updates);
    }
    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('users').update(updates).eq('id', userId); } catch (e) {}
    }
    res.status(200).json({ message: 'User profile updated by admin.', user: fu ? normalizeUser(fu) : { id: userId } });
  } catch (err) {
    res.status(500).json({ error: 'Error updating user profile.' });
  }
});

app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const idx = fallbackUsers.findIndex(u => u.id === userId || u._id === userId);
    if (idx >= 0) fallbackUsers.splice(idx, 1);

    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('users').delete().eq('id', userId); } catch (e) {}
    }
    res.status(200).json({ message: 'User deleted from database.' });
  } catch (err) {
    res.status(500).json({ error: 'Error removing user.' });
  }
});

app.get('/api/admin/users/founders', async (req, res) => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('role', 'founder');
      if (!error && data) return res.status(200).json(data.map(normalizeUser));
    }
    if (mongoose.connection.readyState === 1) {
      const founders = await User.find({ role: 'founder' });
      if (founders) return res.status(200).json(founders.map(normalizeUser));
    }
    res.status(200).json(fallbackUsers.filter(u => u.role === 'founder').map(normalizeUser));
  } catch (err) {
    res.status(200).json(fallbackUsers.filter(u => u.role === 'founder').map(normalizeUser));
  }
});

app.get('/api/users/founders', async (req, res) => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('role', 'founder');
      if (!error && data) return res.status(200).json(data.map(normalizeUser));
    }
    if (mongoose.connection.readyState === 1) {
      const founders = await User.find({ role: 'founder' });
      if (founders) return res.status(200).json(founders.map(normalizeUser));
    }
    res.status(200).json(fallbackUsers.filter(u => u.role === 'founder').map(normalizeUser));
  } catch (err) {
    res.status(200).json(fallbackUsers.filter(u => u.role === 'founder').map(normalizeUser));
  }
});

app.get('/api/admin/users/investors', async (req, res) => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('role', 'investor');
      if (!error && data) return res.status(200).json(data.map(normalizeUser));
    }
    if (mongoose.connection.readyState === 1) {
      const investors = await User.find({ role: 'investor' });
      if (investors) return res.status(200).json(investors.map(normalizeUser));
    }
    res.status(200).json(fallbackUsers.filter(u => u.role === 'investor').map(normalizeUser));
  } catch (err) {
    res.status(200).json(fallbackUsers.filter(u => u.role === 'investor').map(normalizeUser));
  }
});

// S3: investor directory for founder UI — seed/local always included (does not change GET /api/admin/users/investors)
app.get('/api/investors/directory', async (req, res) => {
  try {
    const byId = new Map();
    fallbackUsers.filter((u) => u.role === 'investor').map(normalizeUser).forEach((u) => {
      if (u && (u.id || u._id)) byId.set(u.id || u._id, u);
    });
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*').eq('role', 'investor');
        if (!error && Array.isArray(data)) {
          data.map(normalizeUser).forEach((u) => {
            const id = u && (u.id || u._id);
            if (id && !byId.has(id)) byId.set(id, u);
          });
        }
      } catch (e) {}
    }
    res.status(200).json([...byId.values()]);
  } catch (err) {
    res.status(200).json(fallbackUsers.filter((u) => u.role === 'investor').map(normalizeUser));
  }
});

// S3: one investor profile for founder detail panel (does not change normalizeUser or admin routes)
app.get('/api/investors/:investorId/profile', async (req, res) => {
  try {
    const { investorId } = req.params;
    const raw = fallbackUsers.find(
      (u) => u.role === 'investor' && String(u.id || u._id) === String(investorId)
    );
    let extra = raw || null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('users').select('*').eq('id', investorId).maybeSingle();
        if (!error && data && (data.role === 'investor' || !data.role)) extra = { ...(raw || {}), ...data };
      } catch (e) {}
    }
    if (!extra) return res.status(404).json({ error: 'Investor not found.' });
    const n = normalizeUser(extra);
    res.status(200).json({
      ...n,
      bank_or_mfs: extra.bank_or_mfs || extra.bankOrMfs || '',
      phone: extra.mfs_number || extra.mfsNumber || n.mfsNumber || '',
      affiliationStatus: extra.affiliation_status || extra.affiliationStatus || n.affiliationStatus || '',
      passingYear: extra.passing_year || extra.passingYear || n.passingYear || ''
    });
  } catch (err) {
    res.status(404).json({ error: 'Investor not found.' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    let fc = fallbackUsers.filter(u => u.role === 'founder').length;
    let ic = fallbackUsers.filter(u => u.role === 'investor').length;
    if (isSupabaseConfigured && supabase) {
      const { data: usersData } = await supabase.from('users').select('role');
      if (usersData) {
        fc = usersData.filter(u => u.role === 'founder').length;
        ic = usersData.filter(u => u.role === 'investor').length;
      }
    }
    res.status(200).json({ totalFounders: fc, totalInvestors: ic });
  } catch (err) {
    res.status(200).json({ totalFounders: 1, totalInvestors: 1 });
  }
});

app.get('/api/disputes', async (req, res) => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('disputes').select('*').order('created_at', { ascending: false });
      if (!error && data) return res.status(200).json(data);
    }
    res.status(200).json([]);
  } catch (err) {
    res.status(200).json([]);
  }
});


// CAMPAIGN MANAGEMENT & ADMIN AUDIT APIS
app.get('/api/campaigns', async (req, res) => {
  try {
    let rawList = [];
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('campaigns').select('*');
      if (!error && data) rawList = data.map(normalizeCampaign);
    } else if (mongoose.connection.readyState === 1) {
      const campaigns = await Campaign.find();
      if (campaigns) rawList = campaigns.map(normalizeCampaign);
    } else {
      rawList = fallbackCampaigns.map(normalizeCampaign);
    }
    // Filter public listing to verified campaigns only
    const verifiedPublic = rawList.filter(c => c && (c.status === 'verified' || c.verified === true));
    res.status(200).json(verifiedPublic);
  } catch (err) {
    const verifiedPublic = fallbackCampaigns.map(normalizeCampaign).filter(c => c && (c.status === 'verified' || c.verified === true));
    res.status(200).json(verifiedPublic);
  }
});

// S3: live campaigns a founder can watch (verified), including persisted local store — does not change GET /api/campaigns
app.get('/api/campaigns/watchable', async (req, res) => {
  try {
    const byId = new Map();
    const takeVerified = (list) => {
      for (const c of list) {
        if (!c) continue;
        const live = c.verified === true || ['verified', 'open', 'live'].includes(String(c.status || '').toLowerCase());
        if (!live) continue;
        const id = c.id || c._id;
        if (id) byId.set(id, c);
      }
    };
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('campaigns').select('*');
        if (!error && Array.isArray(data)) takeVerified(data.map(normalizeCampaign));
      } catch (e) {}
    }
    if (mongoose.connection.readyState === 1) {
      try {
        const campaigns = await Campaign.find();
        if (Array.isArray(campaigns)) takeVerified(campaigns.map(normalizeCampaign));
      } catch (e) {}
    }
    takeVerified(fallbackCampaigns.map(normalizeCampaign)); // S3: local wins
    res.status(200).json([...byId.values()]);
  } catch (err) {
    res.status(200).json([]);
  }
});

app.get('/api/admin/campaigns/pending', async (req, res) => {
  try {
    let allCampaigns = [];
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('campaigns').select('*');
      if (!error && data) allCampaigns = data.map(normalizeCampaign);
    } else if (mongoose.connection.readyState === 1) {
      const campaigns = await Campaign.find();
      if (campaigns) allCampaigns = campaigns.map(normalizeCampaign);
    } else {
      allCampaigns = fallbackCampaigns.map(normalizeCampaign);
    }

    const pending = allCampaigns.filter(c => c && (c.status === 'pending' || c.status === 'revisions' || !c.verified));
    
    // Ensure demo pending campaign exists for testing if queue is empty
    if (pending.length === 0 && fallbackCampaigns.length > 0) {
      const firstCamp = fallbackCampaigns[0];
      firstCamp.status = 'pending';
      firstCamp.verified = false;
      pending.push(normalizeCampaign(firstCamp));
    }
    
    res.status(200).json(pending);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching pending campaigns.' });
  }
});

app.post('/api/admin/campaigns/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('campaigns').update({ status: 'verified', verified: true }).eq('id', id);
      } catch (e) {}
    }
    if (mongoose.connection.readyState === 1) {
      try {
        await Campaign.findOneAndUpdate({ id }, { status: 'verified', verified: true });
      } catch (e) {}
    }

    const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
    if (cmp) {
      cmp.status = 'verified';
      cmp.verified = true;
    }

    const founderId = cmp?.founder_id || cmp?.founder?._id || 'usr_founder_1';
    await createAndDispatchNotification(
      founderId,
      `Startup Pitch Approved! 🚀`,
      `Your campaign "${cmp?.title || 'pitch'}" has passed Super Admin verification and is now LIVE in the public investment directory.`,
      'success'
    );

    res.status(200).json({ message: 'Campaign verified and published successfully.', campaign: cmp ? normalizeCampaign(cmp) : null });
  } catch (err) {
    res.status(500).json({ error: 'Error verifying campaign.' });
  }
});

app.post('/api/admin/campaigns/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('campaigns').update({ status: 'rejected', verified: false }).eq('id', id);
      } catch (e) {}
    }

    const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
    if (cmp) {
      cmp.status = 'rejected';
      cmp.verified = false;
      cmp.rejectionReason = reason;
    }

    const founderId = cmp?.founder_id || cmp?.founder?._id || 'usr_founder_1';
    await createAndDispatchNotification(
      founderId,
      `Campaign Audit Status: Rejected ❌`,
      `Your pitch "${cmp?.title || 'campaign'}" was not approved by Admin. Reason: ${reason || 'Compliance threshold mismatch'}.`,
      'warning'
    );

    res.status(200).json({ message: 'Campaign rejected.', campaign: cmp ? normalizeCampaign(cmp) : null });
  } catch (err) {
    res.status(500).json({ error: 'Error rejecting campaign.' });
  }
});

app.post('/api/admin/campaigns/:id/reupload', async (req, res) => {
  try {
    const { id } = req.params;
    const { feedbackNotes } = req.body;

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('campaigns').update({ status: 'revisions', verified: false }).eq('id', id);
      } catch (e) {}
    }

    const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
    if (cmp) {
      cmp.status = 'revisions';
      cmp.verified = false;
      cmp.feedbackNotes = feedbackNotes;
    }

    const founderId = cmp?.founder_id || cmp?.founder?._id || 'usr_founder_1';
    await createAndDispatchNotification(
      founderId,
      `Campaign Revisions Requested 📝`,
      `Admin requested document revisions for "${cmp?.title || 'pitch'}": ${feedbackNotes || 'Please update milestone targets'}.`,
      'info'
    );

    res.status(200).json({ message: 'Revision request logged.', campaign: cmp ? normalizeCampaign(cmp) : null });
  } catch (err) {
    res.status(500).json({ error: 'Error requesting revisions.' });
  }
});

app.post('/api/admin/campaigns/:id/pause-funding', async (req, res) => {
  try {
    const { id } = req.params;
    const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
    let newStatus = 'funding_paused';
    if (cmp) {
      newStatus = cmp.status === 'funding_paused' ? 'verified' : 'funding_paused';
      cmp.status = newStatus;
    }
    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('campaigns').update({ status: newStatus }).eq('id', id); } catch (e) {}
    }
    res.status(200).json({ message: `Funding status toggled to ${newStatus}`, campaign: cmp ? normalizeCampaign(cmp) : null });
  } catch (err) {
    res.status(500).json({ error: 'Error pausing funding.' });
  }
});

app.post('/api/admin/campaigns/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
    if (cmp) {
      cmp.status = 'blocked';
      cmp.verified = false;
    }
    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('campaigns').update({ status: 'blocked', verified: false }).eq('id', id); } catch (e) {}
    }
    res.status(200).json({ message: 'Campaign blocked.', campaign: cmp ? normalizeCampaign(cmp) : null });
  } catch (err) {
    res.status(500).json({ error: 'Error blocking campaign.' });
  }
});

app.post('/api/admin/campaigns/:id/freeze-funds', async (req, res) => {
  try {
    const { id } = req.params;
    const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
    let frozen = true;
    if (cmp) {
      frozen = !cmp.escrowFrozen;
      cmp.escrowFrozen = frozen;
      cmp.escrow_frozen = frozen;
    }
    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('campaigns').update({ escrow_frozen: frozen }).eq('id', id); } catch (e) {}
    }
    res.status(200).json({ message: `Escrow freeze state set to ${frozen}`, campaign: cmp ? normalizeCampaign(cmp) : null });
  } catch (err) {
    res.status(500).json({ error: 'Error freezing escrow funds.' });
  }
});

app.post('/api/admin/campaigns/:id/freeze', async (req, res) => {
  try {
    const { id } = req.params;
    const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
    let frozen = true;
    if (cmp) {
      frozen = !cmp.escrowFrozen;
      cmp.escrowFrozen = frozen;
      cmp.escrow_frozen = frozen;
    }
    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('campaigns').update({ escrow_frozen: frozen }).eq('id', id); } catch (e) {}
    }
    res.status(200).json({ message: `Escrow freeze state set to ${frozen}`, campaign: cmp ? normalizeCampaign(cmp) : null });
  } catch (err) {
    res.status(500).json({ error: 'Error freezing escrow funds.' });
  }
});

app.get('/api/admin/escrow/pending', async (req, res) => {
  try {
    const escQueue = [];
    fallbackCampaigns.forEach(c => {
      if (Array.isArray(c.milestones)) {
        c.milestones.forEach((m, idx) => {
          if (m.status === 'Pending Review' || m.status === 'active') {
            escQueue.push({
              campaignId: c.id || c._id,
              milestoneId: idx.toString(),
              title: c.title,
              founderName: c.founder?.name || 'Student Founder',
              university: c.university || 'University',
              milestoneTitle: m.title || `Tranche #${idx + 1}`,
              target: m.target || 'Current Quarter',
              amount: 150000,
              escrowStatus: m.status
            });
          }
        });
      }
    });
    res.status(200).json(escQueue);
  } catch (err) {
    res.status(200).json([]);
  }
});

app.post('/api/admin/escrow/:campaignId/milestones/:milestoneId/approve', async (req, res) => {
  try {
    const { campaignId, milestoneId } = req.params;
    const cmp = fallbackCampaigns.find(c => c.id === campaignId || c._id === campaignId);
    if (cmp && Array.isArray(cmp.milestones)) {
      const idx = Number(milestoneId);
      if (cmp.milestones[idx]) {
        cmp.milestones[idx].status = 'Completed';
      }
    }
    res.status(200).json({ message: 'Milestone escrow tranche approved and released.' });
  } catch (err) {
    res.status(500).json({ error: 'Error approving milestone escrow release.' });
  }
});

app.get('/api/campaigns/founder/:founderId', async (req, res) => {
  try {
    const { founderId } = req.params;
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('campaigns').select('*').or(`founder_id.eq.${founderId},founder_id.eq.usr_founder_1`);
      if (!error && data) {
        return res.status(200).json(data.map(normalizeCampaign));
      }
    }
    if (mongoose.connection.readyState === 1) {
      try {
        const campaigns = await Campaign.find({ founder: founderId });
        if (campaigns) return res.status(200).json(campaigns.map(normalizeCampaign));
      } catch (e) {}
    }
    const fc = fallbackCampaigns.filter(c => c.founder?._id === founderId || c.founder?.id === founderId || c.founder_id === founderId || c.founder === founderId);
    res.status(200).json(fc.map(normalizeCampaign));
  } catch (err) {
    res.status(200).json([]);
  }
});

// S3: founder My Campaigns (local persist wins). Does not change GET /api/campaigns/founder/:founderId
app.get('/api/founders/:founderId/campaigns', async (req, res) => {
  try {
    const { founderId } = req.params;
    const ownerKeys = await s3FounderOwnerKeys(founderId);
    const byId = new Map();
    const fc = fallbackCampaigns.filter((c) => s3CampaignOwnedBy(c, ownerKeys));
    for (const c of fc.map(normalizeCampaign)) {
      const id = c.id || c._id;
      if (id) byId.set(id, c);
    }
    res.status(200).json([...byId.values()]);
  } catch (err) {
    res.status(200).json([]);
  }
});

app.post('/api/campaigns', async (req, res) => {
  try {
    const { id, title, founderId, university, location, category, stage, goal, equityOffer, description, milestones, tagline, coverPhoto, pitchVideoUrl, successorName, successorEmail } = req.body;

    if (!title || !founderId) {
      return res.status(400).json({ error: 'Startup Title and Founder ID are required.' });
    }

    const campaignId = id || `cmp_${Date.now()}`;
    const parsedMilestones = milestones && milestones.length > 0 ? milestones : [
      { title: 'MVP Launch', target: 'Month 1', status: 'active' },
      { title: 'First 100 Users', target: 'Month 2', status: 'locked' },
      { title: 'Revenue ৳50K', target: 'Month 4', status: 'locked' }
    ];

    const campaignData = {
      id: campaignId,
      title,
      founder_id: founderId,
      university: university || 'BRAC University',
      location: location || 'Dhaka, Bangladesh',
      category: category || 'Startup Venture',
      stage: stage || 'MVP Stage',
      goal: Number(goal) || 500000,
      raised: 0,
      equity_offer: equityOffer || '8% Revenue Share',
      tagline: tagline || '',
      cover_photo: coverPhoto || '',
      pitch_video_url: pitchVideoUrl || '',
      description: description || title,
      milestones: parsedMilestones,
      // S3: designated successor
      successor_name: successorName || '',
      successor_email: successorEmail || '',
      successorName: successorName || '',
      successorEmail: successorEmail || '',
      verified: false,
      status: 'pending',
      submitted_at: new Date().toISOString()
    };

    let resultCampaign = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: supaCmp } = await supabase.from('campaigns').upsert([campaignData]).select().single();
        if (supaCmp) resultCampaign = normalizeCampaign(supaCmp);
      } catch (e) {
        console.warn('Supabase campaign upsert error:', e.message);
      }
    }

    if (!resultCampaign && mongoose.connection.readyState === 1) {
      try {
        resultCampaign = await Campaign.findOneAndUpdate({ id: campaignId }, campaignData, { upsert: true, new: true });
        if (resultCampaign) resultCampaign = normalizeCampaign(resultCampaign);
      } catch (mErr) {}
    }

    const normLocal = normalizeCampaign(campaignData);
    const existingIdx = fallbackCampaigns.findIndex(c => c.id === campaignId || c._id === campaignId);
    if (existingIdx >= 0) {
      fallbackCampaigns[existingIdx] = normLocal;
    } else {
      fallbackCampaigns.unshift(normLocal);
    }

    res.status(201).json({ message: 'Campaign submitted for Admin vetting & approval.', campaign: resultCampaign || normLocal });
  } catch (err) {
    console.error('Error in /api/campaigns:', err);
    res.status(500).json({ error: 'Server error during campaign creation.' });
  }
});

// INVESTOR PROPOSAL & PORTFOLIO APIS
app.post('/api/campaigns/:id/proposals', async (req, res) => {
  try {
    const { id } = req.params;
    const { investorId, investorName, amount, terms, customNotes } = req.body;

    if (!investorId || !amount || !terms) {
      return res.status(400).json({ error: 'Investor ID, funding amount, and terms are required.' });
    }

    const proposalObj = {
      id: `prop_${Date.now()}`,
      campaign_id: id,
      campaignId: id,
      investor_id: investorId,
      investorId: investorId,
      amount: Number(amount),
      terms,
      return_structure: terms,
      custom_notes: customNotes || '',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    let createdProp = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: supaProp, error } = await supabase.from('proposals').insert([{
          campaign_id: id,
          investor_id: investorId,
          amount: Number(amount),
          terms,
          return_structure: terms,
          custom_notes: customNotes || '',
          status: 'pending'
        }]).select().single();
        if (supaProp) createdProp = normalizeProposal(supaProp);
        if (error) console.warn('Supabase proposal insert warning:', error.message);
      } catch (e) {
        console.warn('Supabase proposal insert warning:', e.message);
      }
    }

    if (!createdProp && mongoose.connection.readyState === 1) {
      try {
        const mongoProp = await Proposal.create({
          campaign: id,
          investor: investorId,
          amount: Number(amount),
          terms,
          status: 'pending'
        });
        if (mongoProp) createdProp = normalizeProposal(mongoProp);
      } catch (e) {
        console.warn('MongoDB proposal insert warning:', e.message);
      }
    }

    const finalProp = createdProp || normalizeProposal(proposalObj);
    const existingIdx = fallbackProposals.findIndex(p => p.id === finalProp.id || p._id === finalProp.id);
    if (existingIdx >= 0) {
      fallbackProposals[existingIdx] = finalProp;
    } else {
      fallbackProposals.unshift(finalProp);
    }

    // Send real-time notification to Founder
    const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
    const targetFounderId = cmp?.founder_id || cmp?.founder?._id || cmp?.founder?.id || 'usr_founder_1';
    await createAndDispatchNotification(
      targetFounderId,
      'New Investment Proposal Received! 💰',
      `${investorName || 'An investor'} submitted a BDT ৳${Number(amount).toLocaleString()} funding proposal for your startup.`,
      'info'
    );

    res.status(201).json({ message: 'Investment proposal submitted to Founder.', proposal: finalProp });
  } catch (err) {
    console.error('Error submitting proposal:', err);
    res.status(500).json({ error: 'Server error submitting backing proposal.' });
  }
});

app.get('/api/proposals/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    let proposalsList = [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('proposals').select('*').eq('campaign_id', campaignId);
        if (!error && Array.isArray(data)) {
          proposalsList.push(...data.map(normalizeProposal));
        }
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const dbProps = await Proposal.find({ campaign: campaignId });
        if (dbProps && dbProps.length > 0) {
          proposalsList.push(...dbProps.map(normalizeProposal));
        }
      } catch (e) {}
    }

    const fp = fallbackProposals.filter(p => p.campaign_id === campaignId || p.campaignId === campaignId);
    proposalsList.push(...fp.map(normalizeProposal));

    const uniqueMap = new Map();
    proposalsList.forEach(p => {
      if (p && p.id && !uniqueMap.has(p.id)) {
        uniqueMap.set(p.id, p);
      }
    });

    res.status(200).json(Array.from(uniqueMap.values()));
  } catch (err) {
    res.status(200).json([]);
  }
});

app.get('/api/proposals/investor/:investorId', async (req, res) => {
  try {
    const { investorId } = req.params;
    let proposalsList = [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('proposals').select('*').eq('investor_id', investorId);
        if (!error && Array.isArray(data)) {
          proposalsList.push(...data.map(normalizeProposal));
        }
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const dbProps = await Proposal.find({ investor: investorId });
        if (dbProps && dbProps.length > 0) {
          proposalsList.push(...dbProps.map(normalizeProposal));
        }
      } catch (e) {}
    }

    const fp = fallbackProposals.filter(p => p.investor_id === investorId || p.investorId === investorId);
    proposalsList.push(...fp.map(normalizeProposal));

    const uniqueMap = new Map();
    proposalsList.forEach(p => {
      if (p && p.id && !uniqueMap.has(p.id)) {
        uniqueMap.set(p.id, p);
      }
    });

    res.status(200).json(Array.from(uniqueMap.values()));
  } catch (err) {
    res.status(200).json([]);
  }
});

// S3: all proposals on this founder’s campaigns (does not change existing campaign/investor proposal routes)
app.get('/api/proposals/founder/:founderId', async (req, res) => {
  try {
    const { founderId } = req.params;
    const ownerKeys = await s3FounderOwnerKeys(founderId);
    const campIds = new Set(
      fallbackCampaigns
        .filter((c) => s3CampaignOwnedBy(c, ownerKeys))
        .map((c) => c.id || c._id)
        .filter(Boolean)
    );
    const enrich = (raw) => {
      const n = normalizeProposal(raw);
      if (!n) return null;
      const inv = fallbackUsers.find((u) => String(u.id || u._id) === String(n.investor_id));
      n.investor_name = raw.investor_name || raw.investorName || inv?.name || n.investor_name || '';
      n.maturity_period = raw.maturity_period || raw.maturityPeriod || n.maturity_period || '';
      const camp = fallbackCampaigns.find((c) => (c.id || c._id) === n.campaign_id);
      n.campaign_title = raw.campaign_title || camp?.title || n.campaign_id;
      return n;
    };
    const uniqueMap = new Map();
    fallbackProposals.forEach((p) => {
      const n = enrich(p);
      if (n && n.id && campIds.has(n.campaign_id)) uniqueMap.set(n.id, n);
    });
    res.status(200).json(Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    ));
  } catch (err) {
    res.status(200).json([]);
  }
});

// S3: founder accept/decline without editing the original status handler
app.post('/api/founder/proposals/:proposalId/status', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const status = String(req.body.status || '').toLowerCase();
    const campaignId = req.body.campaignId;
    const founderId = req.body.founderId;
    if (!['accepted', 'declined', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted or declined.' });
    }
    const cmp = fallbackCampaigns.find((c) => c.id === campaignId || c._id === campaignId);
    if (!cmp) return res.status(404).json({ error: 'Campaign not found.' });
    if (founderId && String(cmp.founder_id || cmp.founderId) !== String(founderId)) {
      return res.status(403).json({ error: 'You can only review proposals on your own campaigns.' });
    }
    let fp = fallbackProposals.find((p) => p.id === proposalId || p._id === proposalId);
    if (!fp) {
      fp = {
        id: proposalId,
        campaign_id: campaignId,
        status: 'pending',
        amount: 0
      };
      fallbackProposals.unshift(fp);
    }
    if ((fp.status || 'pending') !== 'pending') {
      return res.status(400).json({ error: 'This proposal was already reviewed.' });
    }
    fp.status = status;
    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('proposals').update({ status }).eq('id', proposalId); } catch (e) {}
    }
    if (status === 'accepted') {
      cmp.raised = Number(cmp.raised || 0) + Number(fp.amount || 0);
      persistS3CampaignStore(); // S3
    }
    persistS3ProposalStore(); // S3
    const invId = fp.investor_id || fp.investorId;
    if (invId) {
      await createAndDispatchNotification(
        invId,
        `Proposal ${status.toUpperCase()}! 📄`,
        `The founder has ${status} your investment proposal.`,
        status === 'accepted' ? 'success' : 'warning'
      );
    }
    res.status(200).json({ message: `Proposal ${status}.`, proposal: normalizeProposal(fp) });
  } catch (err) {
    res.status(500).json({ error: 'Error updating proposal.' });
  }
});

app.put('/api/campaigns/:id/proposals/:proposalId/status', async (req, res) => {
  try {
    const { id, proposalId } = req.params;
    const { status } = req.body;

    if (!['accepted', 'declined', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('proposals').update({ status }).eq('id', proposalId);
        if (status === 'accepted') {
          const { data: cmpData } = await supabase.from('campaigns').select('raised').eq('id', id).single();
          if (cmpData) {
            await supabase.from('campaigns').update({ raised: Number(cmpData.raised || 0) + 100000 }).eq('id', id);
          }
        }
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await Proposal.findByIdAndUpdate(proposalId, { status });
      } catch (e) {}
    }

    const fp = fallbackProposals.find(p => p.id === proposalId || p._id === proposalId);
    if (fp) fp.status = status;

    if (status === 'accepted') {
      const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
      if (cmp) {
        cmp.raised = Number(cmp.raised || 0) + (fp ? Number(fp.amount || 0) : 100000);
      }
    }

    if (fp && (fp.investorId || fp.investor_id)) {
      const targetInvId = fp.investorId || fp.investor_id;
      const type = status === 'accepted' ? 'success' : 'warning';
      await createAndDispatchNotification(
        targetInvId,
        `Proposal ${status.toUpperCase()}! 📄`,
        `The founder has ${status} your investment proposal.`,
        type
      );
    }

    res.status(200).json({ message: `Proposal status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating proposal status.' });
  }
});

app.post('/api/proposals/:proposalId/withdraw', async (req, res) => {
  try {
    const { proposalId } = req.params;

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('proposals').update({ status: 'withdrawn' }).eq('id', proposalId);
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await Proposal.findByIdAndUpdate(proposalId, { status: 'withdrawn' });
      } catch (e) {}
    }

    const fp = fallbackProposals.find(p => p.id === proposalId || p._id === proposalId);
    if (fp) fp.status = 'withdrawn';

    res.status(200).json({ message: 'Proposal withdrawn successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error withdrawing proposal.' });
  }
});

// PAYOUTS & AUDIT LOGS APIS
app.get('/api/payouts/founder/:founderId', async (req, res) => {
  try {
    const { founderId } = req.params;
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('payouts').select('*').eq('founder_id', founderId);
      if (!error && data) return res.status(200).json(data);
    }
    res.status(200).json(fallbackPayouts);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching payouts' });
  }
});

app.post('/api/payouts/request', async (req, res) => {
  try {
    const { founderId, amount, method, accountNumber, tranche } = req.body;
    const newPayout = {
      id: 'TRX-' + Math.floor(100 + Math.random() * 900),
      founder_id: founderId,
      tranche: tranche || 'Milestone Escrow Payout',
      amount: Number(amount),
      method: method || 'bKash Merchant',
      account_number: accountNumber || '',
      status: 'Pending Audit',
      hash: '0x' + Math.random().toString(36).substring(2, 10),
      created_at: new Date().toISOString()
    };
    if (isSupabaseConfigured && supabase) {
      await supabase.from('payouts').insert([newPayout]);
    }
    fallbackPayouts.unshift(newPayout);
    res.status(201).json(newPayout);
  } catch (err) {
    res.status(500).json({ error: 'Error requesting payout' });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) return res.status(200).json(data);
    }
    res.status(200).json([
      { id: '1', hash: '0x8f2a99c4b1d09e1a', category: 'DISBURSEMENT', title: 'Escrow Tranche #1 Release', status: 'VERIFIED', latency: '14ms', created_at: new Date().toISOString() }
    ]);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching audit logs' });
  }
});

// S3: this founder’s action log (does not change GET /api/audit-logs)
app.get('/api/founders/:founderId/audit-logs', async (req, res) => {
  try {
    const { founderId } = req.params;
    const rows = fallbackAuditLogs.filter((r) => {
      const fid = r.founder_id || founderIdFromAuditId(r.id);
      return String(fid) === String(founderId);
    });
    rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    res.status(200).json(rows);
  } catch (err) {
    res.status(200).json([]);
  }
});

// S3: founder UI records its own audit (does not patch other sprints’ handlers)
app.post('/api/founders/:founderId/audit-logs', async (req, res) => {
  try {
    const { founderId } = req.params;
    const { category, title, status } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title is required.' });
    await writeFounderAuditLog({ founderId, category, title, status });
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error writing audit log.' });
  }
});

// Socket connection
io.on('connection', (socket) => {
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('send_message', async (data) => {
    const msgObj = {
      id: 'msg_' + Date.now(),
      sender_id: data.senderId || data.sender,
      receiver_id: data.receiverId || 'all',
      sender_name: data.senderName || 'User',
      campaign_id: data.campaignId || '',
      text: data.text,
      created_at: new Date().toISOString()
    };
    fallbackMessages.push(msgObj);
    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('messages').insert([msgObj]); } catch (e) {}
    }

    const targetRoom = data.roomId || data.campaignId || 'general';
    io.to(targetRoom).emit('receive_message', msgObj);
    io.emit('new_direct_message', msgObj);
  });
});

// ============================================================================
// FR-21: AI OPTIMIZATION ENGINE API
// ============================================================================
app.post('/api/ai/generate', (req, res) => {
  try {
    const { action, title, category, stage, university, targetAudience, description } = req.body;

    if (action === 'pitch_bio' || action === 'slogan') {
      const taglines = [
        `Revolutionizing ${category || 'EdTech'} through smart university ecosystem integration.`,
        `Empowering student innovators at ${university || 'top Bangladeshi universities'} with seamless scalable tech.`,
        `Next-gen ${category || 'FinTech'} platform built by student entrepreneurs for rapid market traction.`,
        `Disrupting traditional workflows with automated milestone verification and community backing.`
      ];
      const slogan = taglines[Math.floor(Math.random() * taglines.length)];
      const bio = `${title || 'Our Venture'} is an innovative ${category || 'technology'} startup developed by founders at ${university || 'BRAC University'}. Currently in ${stage || 'MVP Stage'}, our platform addresses key operational challenges for university communities in Bangladesh by introducing digital automation, scalable infrastructure, and milestone-verified growth execution.`;
      
      return res.status(200).json({ slogan, bio });
    }

    if (action === 'business_summary') {
      const summary = `BUSINESS SUMMARY FOR ${title || 'VENTURE'}:\n1. Core Value Proposition: Streamlined ${category || 'Tech'} operations tailored for high-growth Bangladeshi markets.\n2. Milestone Execution: Clear 3-tranche roadmap focused on MVP deployment, customer acquisition, and recurring revenue.\n3. Investor Return Alignment: High alignment with alumni networks and revenue share / milestone debt models.`;
      return res.status(200).json({ summary });
    }

    if (action === 'investor_match') {
      const recommendations = fallbackCampaigns.slice(0, 3).map(c => ({
        id: c.id,
        title: c.title,
        category: c.category,
        matchScore: Math.floor(88 + Math.random() * 11) + '% Match',
        reason: `Strong alignment with your preference for ${c.category} ventures originating from ${c.university}.`
      }));
      return res.status(200).json({ recommendations });
    }

    res.status(200).json({
      slogan: `Transforming ${category || 'Education'} through verified student innovation.`,
      bio: `A high-impact startup leveraging technology to build sustainable value in Bangladesh.`
    });
  } catch (err) {
    res.status(500).json({ error: 'AI generation failed.' });
  }
});

// ============================================================================
// FR-7: DIRECT REAL-TIME CHAT APIS
// ============================================================================
app.get('/api/chat/messages', async (req, res) => {
  try {
    const { senderId, receiverId, campaignId } = req.query;
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
      if (!error && data) {
        let filtered = data;
        if (campaignId) filtered = filtered.filter(m => m.campaign_id === campaignId);
        else if (senderId && receiverId) {
          filtered = filtered.filter(m => 
            (m.sender_id === senderId && m.receiver_id === receiverId) ||
            (m.sender_id === receiverId && m.receiver_id === senderId)
          );
        }
        return res.status(200).json(filtered);
      }
    }
    
    let result = fallbackMessages;
    if (campaignId) result = result.filter(m => m.campaign_id === campaignId);
    else if (senderId && receiverId) {
      result = result.filter(m => 
        (m.sender_id === senderId && m.receiver_id === receiverId) ||
        (m.sender_id === receiverId && m.receiver_id === senderId)
      );
    }
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching messages.' });
  }
});

// S3: thread history for founder chat drawer (does not change GET /api/chat/messages)
app.get('/api/chat/thread', async (req, res) => {
  try {
    const senderId = String(req.query.senderId || '');
    const receiverId = String(req.query.receiverId || '');
    if (!senderId || !receiverId) return res.status(400).json({ error: 'senderId and receiverId are required.' });
    const inThread = (m) => {
      const s = String(m.sender_id || m.senderId || '');
      const r = String(m.receiver_id || m.receiverId || '');
      return (s === senderId && r === receiverId) || (s === receiverId && r === senderId);
    };
    const byId = new Map();
    fallbackMessages.filter(inThread).forEach((m) => {
      if (m && m.id) byId.set(m.id, m);
    });
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
        if (!error && Array.isArray(data)) {
          data.filter(inThread).forEach((m) => {
            if (m && m.id && !byId.has(m.id)) byId.set(m.id, m);
          });
        }
      } catch (e) {}
    }
    res.status(200).json([...byId.values()].sort(
      (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
    ));
  } catch (err) {
    res.status(200).json([]);
  }
});

app.post('/api/chat/messages', async (req, res) => {
  try {
    const { senderId, receiverId, campaignId, senderName, text } = req.body;
    if (!senderId || !text) return res.status(400).json({ error: 'Sender ID and text are required.' });

    const msgObj = {
      id: 'msg_' + Date.now(),
      sender_id: senderId,
      receiver_id: receiverId || 'all',
      sender_name: senderName || 'User',
      campaign_id: campaignId || '',
      text,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('messages').insert([msgObj]); } catch (e) {}
    }
    fallbackMessages.push(msgObj);

    const targetRoom = campaignId || 'general';
    io.to(targetRoom).emit('receive_message', msgObj);
    io.emit('new_direct_message', msgObj);

    res.status(201).json(msgObj);
  } catch (err) {
    res.status(500).json({ error: 'Error sending message.' });
  }
});

// ============================================================================
// FR-3: USER PROFILE MANAGEMENT API
// ============================================================================
const findFallbackUser = (userId) => fallbackUsers.find(u => u.id === userId || u._id === userId);

app.get('/api/users/profile', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    let found = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: supaUser } = await supabase.from('users').select('*').eq('id', userId).single();
        if (supaUser) found = normalizeUser(supaUser);
      } catch (e) {}
    }

    const fu = findFallbackUser(userId);
    if (!found && fu) found = normalizeUser(fu);
    if (found && fu?.bio) found.bio = fu.bio;

    if (!found) return res.status(404).json({ error: 'User not found.' });
    res.status(200).json({ user: found });
  } catch (err) {
    res.status(500).json({ error: 'Error fetching profile.' });
  }
});

app.put('/api/users/profile', async (req, res) => {
  try {
    const { userId, name, university, department, mfsNumber, bio, institution, passingYear, email, studentId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    const dbUpdates = {};
    if (name !== undefined) dbUpdates.name = name;
    if (university !== undefined) dbUpdates.university = university;
    if (department !== undefined) dbUpdates.department = department;
    if (mfsNumber !== undefined) dbUpdates.mfs_number = mfsNumber;
    if (institution !== undefined) dbUpdates.institution = institution;
    if (passingYear !== undefined) dbUpdates.passing_year = passingYear;
    if (email !== undefined) dbUpdates.email = String(email).toLowerCase();
    if (studentId !== undefined) dbUpdates.student_id = studentId;

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('users').update(dbUpdates).eq('id', userId);
      } catch (e) {}
    }

    const fu = findFallbackUser(userId);
    if (fu) {
      if (name !== undefined) fu.name = name;
      if (university !== undefined) fu.university = university;
      if (department !== undefined) fu.department = department;
      if (mfsNumber !== undefined) fu.mfs_number = fu.mfsNumber = mfsNumber;
      if (bio !== undefined) fu.bio = bio;
      if (institution !== undefined) fu.institution = institution;
      if (passingYear !== undefined) fu.passing_year = passingYear;
      if (email !== undefined) fu.email = String(email).toLowerCase();
      if (studentId !== undefined) fu.student_id = fu.studentId = studentId;
    }

    let result = fu ? normalizeUser(fu) : null;
    if (!result && isSupabaseConfigured && supabase) {
      try {
        const { data: supaUser } = await supabase.from('users').select('*').eq('id', userId).single();
        if (supaUser) result = normalizeUser(supaUser);
      } catch (e) {}
    }
    if (result && fu?.bio !== undefined) result.bio = fu.bio;

    res.status(200).json({
      message: 'Profile updated successfully.',
      user: result || { id: userId, name, email, university, department, studentId, mfsNumber, bio }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error updating profile.' });
  }
});

app.post('/api/users/profile/documents', cpUpload, async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ error: 'User ID is required.' });

    const studentPath = req.files?.studentIdCardImage?.[0] ? `/uploads/${req.files.studentIdCardImage[0].filename}` : '';
    const nidPath = req.files?.nidCardImage?.[0] ? `/uploads/${req.files.nidCardImage[0].filename}` : '';
    if (!studentPath && !nidPath) {
      return res.status(400).json({ error: 'Upload a Student ID or NID file.' });
    }

    const fu = findFallbackUser(userId);
    if (fu) {
      if (studentPath) fu.studentIdCardImage = fu.student_id_card_image = studentPath;
      if (nidPath) fu.nidCardImage = fu.nid_card_image = nidPath;
      fu.vettingStatus = fu.vetting_status = 'pending';
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const patch = { vetting_status: 'pending' };
        if (studentPath) patch.student_id_card_image = studentPath;
        if (nidPath) patch.nid_card_image = nidPath;
        await supabase.from('users').update(patch).eq('id', userId);
      } catch (e) {}
    }

    res.status(200).json({
      message: 'Documents uploaded for admin vetting.',
      user: fu ? normalizeUser(fu) : { id: userId, studentIdCardImage: studentPath, nidCardImage: nidPath, vettingStatus: 'pending' }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error uploading documents.' });
  }
});

// S3: persist relief campaigns so My Relief survives backend/nodemon restarts
const S3_RELIEF_STORE_PATH = path.join(__dirname, 's3_relief_store.json');
const fallbackReliefDrives = [];

// S3
const loadS3ReliefStore = () => {
  try {
    if (!fs.existsSync(S3_RELIEF_STORE_PATH)) return;
    const raw = fs.readFileSync(S3_RELIEF_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      fallbackReliefDrives.length = 0;
      fallbackReliefDrives.push(...parsed);
    }
  } catch (e) {
    console.warn('S3 relief store load warning:', e.message);
  }
};

// S3
const persistS3ReliefStore = () => {
  try {
    fs.writeFileSync(S3_RELIEF_STORE_PATH, JSON.stringify(fallbackReliefDrives, null, 2), 'utf8');
  } catch (e) {
    console.warn('S3 relief store save warning:', e.message);
  }
};

loadS3ReliefStore(); // S3

// Public / browse: only admin-approved relief campaigns
app.get('/api/relief-drives', async (req, res) => {
  try {
    const list = fallbackReliefDrives
      .filter(d => d.status === 'open' || d.status === 'verified')
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching relief campaigns.' });
  }
});

app.get('/api/relief-drives/founder/:founderId', async (req, res) => {
  const { founderId } = req.params;
  const list = fallbackReliefDrives.filter(d => d.founder_id === founderId);
  res.status(200).json(list);
});

// S3: founder My Relief (all statuses). Does not change GET /api/relief-drives/founder/:founderId
app.get('/api/founders/:founderId/relief-drives', async (req, res) => {
  const { founderId } = req.params;
  const ownerKeys = await s3FounderOwnerKeys(founderId);
  const list = fallbackReliefDrives.filter((d) => ownerKeys.has(String(d.founder_id || d.founderId || '')));
  res.status(200).json(list);
});

app.get('/api/admin/relief-drives/pending', async (req, res) => {
  const list = fallbackReliefDrives.filter(d => d.status === 'pending');
  res.status(200).json(list);
});

app.post('/api/admin/relief-drives/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body.status || '').toLowerCase();
    if (!['verified', 'open', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Status must be verified, open, rejected, or cancelled.' });
    }
    const drive = fallbackReliefDrives.find(d => d.id === id);
    if (!drive) return res.status(404).json({ error: 'Relief campaign not found.' });
    // "open" and "verified" both mean publicly visible after admin approval
    drive.status = status === 'verified' ? 'open' : status;
    drive.reviewed_at = new Date().toISOString();
    // S3: store reason when provided (AdminDashboard UI for this is a later todo)
    if (status === 'rejected' && req.body.reason !== undefined) {
      drive.rejectionReason = String(req.body.reason || '').trim();
    }
    if (status === 'open' || status === 'verified') {
      drive.rejectionReason = null;
    }
    persistS3ReliefStore(); // S3
    res.status(200).json({ message: 'Relief campaign status updated.', drive });
  } catch (err) {
    res.status(500).json({ error: 'Error updating relief campaign status.' });
  }
});

app.post('/api/relief-drives', async (req, res) => {
  try {
    const { founderId, title, university, cause, beneficiary, goal, description, useOfFunds, proofLinks, successorName, successorEmail } = req.body;
    if (!founderId || !title) return res.status(400).json({ error: 'Cause title and founder ID are required.' });
    const now = new Date().toISOString();
    const drive = {
      id: 'relief_' + Date.now(),
      founder_id: founderId,
      title,
      university: university || '',
      cause: cause || 'Community Support',
      beneficiary: beneficiary || '',
      goal: Number(goal) || 0,
      raised: 0,
      description: description || '',
      useOfFunds: useOfFunds || [],
      proofLinks: Array.isArray(proofLinks) ? proofLinks.filter(p => p && String(p.url || '').trim()) : [],
      // S3
      successorName: successorName || '',
      successorEmail: successorEmail || '',
      successor_name: successorName || '',
      successor_email: successorEmail || '',
      status: 'pending',
      created_at: now,
      submitted_at: now
    };
    fallbackReliefDrives.unshift(drive);
    persistS3ReliefStore(); // S3
    res.status(201).json({ message: 'Relief campaign submitted for admin approval.', drive });
  } catch (err) {
    res.status(500).json({ error: 'Error creating relief campaign.' });
  }
});

app.put('/api/relief-drives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, university, cause, beneficiary, goal, description, useOfFunds, proofLinks, founderId, successorName, successorEmail } = req.body;
    const drive = fallbackReliefDrives.find(d => d.id === id);
    if (!drive) return res.status(404).json({ error: 'Relief campaign not found.' });
    if (founderId && drive.founder_id !== founderId) {
      return res.status(403).json({ error: 'You can only edit your own relief campaigns.' });
    }
    // S3: pending edit, or reapply from rejected/cancelled
    if (!['pending', 'rejected', 'cancelled'].includes(drive.status)) {
      return res.status(400).json({ error: 'Only pending, rejected, or cancelled relief campaigns can be edited or reapplied.' });
    }
    if (title !== undefined) drive.title = title;
    if (university !== undefined) drive.university = university;
    if (cause !== undefined) drive.cause = cause;
    if (beneficiary !== undefined) drive.beneficiary = beneficiary;
    if (goal !== undefined) drive.goal = Number(goal) || 0;
    if (description !== undefined) drive.description = description;
    if (useOfFunds !== undefined) drive.useOfFunds = useOfFunds;
    if (proofLinks !== undefined) {
      drive.proofLinks = Array.isArray(proofLinks) ? proofLinks.filter(p => p && String(p.url || '').trim()) : [];
    }
    // S3
    if (successorName !== undefined) drive.successorName = drive.successor_name = successorName;
    if (successorEmail !== undefined) drive.successorEmail = drive.successor_email = successorEmail;
    // S3: editing / reapply restarts the admin approval clock (at most 3 days from submission)
    drive.status = 'pending';
    drive.submitted_at = new Date().toISOString();
    drive.reviewed_at = null;
    drive.rejectionReason = null; // S3
    persistS3ReliefStore(); // S3
    res.status(200).json({
      message: 'Relief campaign updated. Admin approval timer restarted (at most 3 days).',
      drive
    });
  } catch (err) {
    res.status(500).json({ error: 'Error updating relief campaign.' });
  }
});

app.delete('/api/relief-drives/:id', async (req, res) => {
  const { id } = req.params;
  const idx = fallbackReliefDrives.findIndex(d => d.id === id);
  if (idx < 0) return res.status(404).json({ error: 'Relief campaign not found.' });

  // S3: hard-delete rejected (or ?hard=true) so founder can remove from My Relief
  const hard = String(req.query.hard || '').toLowerCase() === 'true'
    || String(req.query.hard || '') === '1';
  if (hard) {
    if (fallbackReliefDrives[idx].status !== 'rejected') {
      return res.status(400).json({ error: 'Only rejected relief campaigns can be permanently deleted.' });
    }
    fallbackReliefDrives.splice(idx, 1);
    persistS3ReliefStore(); // S3
    return res.status(200).json({ message: 'Rejected relief campaign deleted.' });
  }

    fallbackReliefDrives[idx].status = 'cancelled';
    persistS3ReliefStore(); // S3
    res.status(200).json({ message: 'Relief campaign cancelled.' });
});

// ============================================================================
// FR-5: CAMPAIGN EDIT & CANCEL APIS
// ============================================================================
app.put('/api/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, tagline, goal, equityOffer, description, category, stage, milestones, university, coverPhoto, pitchVideoUrl, successorName, successorEmail } = req.body;

    const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
    if (!cmp) return res.status(404).json({ error: 'Campaign not found.' });

    // Live/verified campaigns are not freely re-edited here; pending/rejected return to audit queue
    const wasPendingLike = cmp.status === 'pending' || cmp.status === 'rejected' || cmp.status === 'revisions' || !cmp.verified;

    if (title) cmp.title = title;
    if (tagline !== undefined) cmp.tagline = tagline;
    if (goal !== undefined) cmp.goal = Number(goal);
    if (equityOffer) cmp.equity_offer = cmp.equityOffer = equityOffer;
    if (description !== undefined) cmp.description = description;
    if (category) cmp.category = category;
    if (stage) cmp.stage = stage;
    if (university !== undefined) cmp.university = university;
    if (coverPhoto !== undefined) cmp.cover_photo = cmp.coverPhoto = coverPhoto;
    if (pitchVideoUrl !== undefined) cmp.pitch_video_url = cmp.pitchVideoUrl = pitchVideoUrl;
    // S3
    if (successorName !== undefined) cmp.successor_name = cmp.successorName = successorName;
    if (successorEmail !== undefined) cmp.successor_email = cmp.successorEmail = successorEmail;
    if (Array.isArray(milestones) && milestones.length > 0) {
      cmp.milestones = milestones.map((m, idx) => ({
        title: String(m.title || `Milestone ${idx + 1}`).trim(),
        target: String(m.target || m.targetDate || 'TBD').trim(),
        status: m.status || (idx === 0 ? 'pending' : 'locked'),
        proofs: Array.isArray(m.proofs) ? m.proofs : []
      }));
    }

    // S3: milestone-only updates should not restart admin approval
    const milestonesOnly = req.body.milestonesOnly === true
      || (Array.isArray(milestones) && !title && tagline === undefined && goal === undefined && !equityOffer && description === undefined);
    if ((wasPendingLike || req.body.resetApproval) && !milestonesOnly) {
      cmp.status = 'pending';
      cmp.verified = false;
      cmp.submitted_at = new Date().toISOString();
      cmp.rejectionReason = null; // S3: clear on reapply / pending resubmit
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('campaigns').update({
          title: cmp.title,
          tagline: cmp.tagline,
          goal: cmp.goal,
          equity_offer: cmp.equity_offer,
          description: cmp.description,
          category: cmp.category,
          stage: cmp.stage,
          milestones: cmp.milestones,
          status: cmp.status,
          verified: cmp.verified
        }).eq('id', id);
      } catch (e) {}
    }

    persistS3CampaignStore(); // S3

    res.status(200).json({
      message: wasPendingLike && !milestonesOnly
        ? 'Campaign updated. Admin approval timer restarted (at most 3 days).'
        : 'Campaign updated successfully.',
      campaign: cmp
    });
  } catch (err) {
    res.status(500).json({ error: 'Error updating campaign.' });
  }
});

app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const hard = String(req.query.hard || '').toLowerCase() === 'true'
      || String(req.query.hard || '') === '1';

    const cmpIdx = fallbackCampaigns.findIndex(c => c.id === id || c._id === id);
    const cmp = cmpIdx >= 0 ? fallbackCampaigns[cmpIdx] : null;

    // S3: permanent delete only for rejected campaigns
    if (hard) {
      if (!cmp || cmp.status !== 'rejected') {
        return res.status(400).json({ error: 'Only rejected campaigns can be permanently deleted.' });
      }
      fallbackCampaigns.splice(cmpIdx, 1);
      persistS3CampaignStore(); // S3
      if (isSupabaseConfigured && supabase) {
        try { await supabase.from('campaigns').delete().eq('id', id); } catch (e) {}
      }
      return res.status(200).json({ message: 'Rejected campaign deleted.' });
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('campaigns').update({ status: 'cancelled' }).eq('id', id);
      } catch (e) {}
    }

    if (cmp) cmp.status = 'cancelled';
    persistS3CampaignStore(); // S3

    res.status(200).json({ message: 'Campaign de-listed / cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Error cancelling campaign.' });
  }
});

// ============================================================================
// S3: POST-APPROVAL EDIT REQUESTS (max 2 working days)
// ============================================================================
app.get('/api/edit-requests/founder/:founderId', (req, res) => {
  const { founderId } = req.params;
  const list = fallbackEditRequests
    .filter((r) => r.founder_id === founderId)
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));
  res.status(200).json(list);
});

app.get('/api/admin/edit-requests/pending', (req, res) => {
  // S3
  res.status(200).json(fallbackEditRequests.filter((r) => r.status === 'pending'));
});

app.post('/api/campaigns/:id/edit-requests', (req, res) => {
  try {
    // S3
    const { id } = req.params;
    const { founderId, reason, proposedChanges } = req.body;
    const cmp = fallbackCampaigns.find((c) => c.id === id || c._id === id);
    if (!cmp) return res.status(404).json({ error: 'Campaign not found.' });
    if (!(cmp.verified || cmp.status === 'verified' || cmp.status === 'open' || cmp.status === 'live')) {
      return res.status(400).json({ error: 'Special edit requests are only for approved/live campaigns. Edit pending campaigns directly.' });
    }
    if (!founderId || String(cmp.founder_id) !== String(founderId)) {
      return res.status(403).json({ error: 'You can only request edits for your own campaigns.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'A reason for the edit request is required.' });
    }
    if (fallbackEditRequests.some((r) => r.target_id === id && r.target_type === 'investment' && r.status === 'pending')) {
      return res.status(400).json({ error: 'An edit request is already pending for this campaign.' });
    }
    const now = new Date().toISOString();
    const reqObj = {
      id: 'editreq_' + Date.now(),
      target_type: 'investment',
      target_id: id,
      target_title: cmp.title || id,
      founder_id: founderId,
      reason: String(reason).trim(),
      proposedChanges: proposedChanges && typeof proposedChanges === 'object' ? proposedChanges : {},
      status: 'pending',
      submitted_at: now,
      due_at: addWorkingDaysBD(now, 2), // S3: at most 2 working days
      reviewed_at: null
    };
    fallbackEditRequests.unshift(reqObj);
    persistS3EditRequestStore(); // S3
    res.status(201).json({
      message: 'Edit request submitted. Admin review takes at most 2 working days.',
      request: reqObj
    });
  } catch (err) {
    res.status(500).json({ error: 'Error creating edit request.' });
  }
});

app.post('/api/relief-drives/:id/edit-requests', (req, res) => {
  try {
    // S3
    const { id } = req.params;
    const { founderId, reason, proposedChanges } = req.body;
    const drive = fallbackReliefDrives.find((d) => d.id === id);
    if (!drive) return res.status(404).json({ error: 'Relief campaign not found.' });
    if (!['open', 'verified'].includes(String(drive.status || '').toLowerCase())) {
      return res.status(400).json({ error: 'Special edit requests are only for approved relief campaigns.' });
    }
    if (!founderId || String(drive.founder_id) !== String(founderId)) {
      return res.status(403).json({ error: 'You can only request edits for your own relief campaigns.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: 'A reason for the edit request is required.' });
    }
    if (fallbackEditRequests.some((r) => r.target_id === id && r.target_type === 'relief' && r.status === 'pending')) {
      return res.status(400).json({ error: 'An edit request is already pending for this relief campaign.' });
    }
    const now = new Date().toISOString();
    const reqObj = {
      id: 'editreq_' + Date.now(),
      target_type: 'relief',
      target_id: id,
      target_title: drive.title || id,
      founder_id: founderId,
      reason: String(reason).trim(),
      proposedChanges: proposedChanges && typeof proposedChanges === 'object' ? proposedChanges : {},
      status: 'pending',
      submitted_at: now,
      due_at: addWorkingDaysBD(now, 2),
      reviewed_at: null
    };
    fallbackEditRequests.unshift(reqObj);
    persistS3EditRequestStore(); // S3
    res.status(201).json({
      message: 'Relief edit request submitted. Admin review takes at most 2 working days.',
      request: reqObj
    });
  } catch (err) {
    res.status(500).json({ error: 'Error creating relief edit request.' });
  }
});

app.post('/api/admin/edit-requests/:id/status', (req, res) => {
  try {
    // S3
    const { id } = req.params;
    const status = String(req.body.status || '').toLowerCase();
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected.' });
    }
    const er = fallbackEditRequests.find((r) => r.id === id);
    if (!er) return res.status(404).json({ error: 'Edit request not found.' });
    if (er.status !== 'pending') return res.status(400).json({ error: 'This edit request was already reviewed.' });

    er.status = status;
    er.reviewed_at = new Date().toISOString();
    er.admin_note = String(req.body.reason || req.body.note || '').trim();

    if (status === 'approved') {
      const changes = er.proposedChanges || {};
      if (er.target_type === 'investment') {
        const cmp = fallbackCampaigns.find((c) => c.id === er.target_id || c._id === er.target_id);
        if (cmp) {
          if (changes.title !== undefined) cmp.title = changes.title;
          if (changes.tagline !== undefined) cmp.tagline = changes.tagline;
          if (changes.description !== undefined) cmp.description = changes.description;
          if (changes.goal !== undefined) cmp.goal = Number(changes.goal) || cmp.goal;
          if (changes.equityOffer !== undefined) cmp.equity_offer = cmp.equityOffer = changes.equityOffer;
          if (changes.category !== undefined) cmp.category = changes.category;
          if (changes.stage !== undefined) cmp.stage = changes.stage;
          if (changes.university !== undefined) cmp.university = changes.university;
          persistS3CampaignStore(); // S3
        }
      } else if (er.target_type === 'relief') {
        const drive = fallbackReliefDrives.find((d) => d.id === er.target_id);
        if (drive) {
          if (changes.title !== undefined) drive.title = changes.title;
          if (changes.cause !== undefined) drive.cause = changes.cause;
          if (changes.beneficiary !== undefined) drive.beneficiary = changes.beneficiary;
          if (changes.goal !== undefined) drive.goal = Number(changes.goal) || drive.goal;
          if (changes.description !== undefined) drive.description = changes.description;
          if (changes.useOfFunds !== undefined) drive.useOfFunds = changes.useOfFunds;
          if (changes.proofLinks !== undefined) drive.proofLinks = changes.proofLinks;
          if (changes.university !== undefined) drive.university = changes.university;
          persistS3ReliefStore(); // S3
        }
      }
    }

    persistS3EditRequestStore(); // S3
    res.status(200).json({ message: `Edit request ${status}.`, request: er });
  } catch (err) {
    res.status(500).json({ error: 'Error updating edit request.' });
  }
});

// ============================================================================
// S3: CUSTOM PROGRESS TAGS (per campaign)
// ============================================================================
app.get('/api/progress-tags/founder/:founderId', (req, res) => {
  // S3
  const { founderId } = req.params;
  const ids = fallbackCampaigns
    .filter((c) => String(c.founder_id) === String(founderId))
    .map((c) => c.id || c._id)
    .filter(Boolean);
  const out = {};
  ids.forEach((id) => {
    if (Array.isArray(fallbackProgressTags[id]) && fallbackProgressTags[id].length > 0) {
      out[id] = fallbackProgressTags[id];
    }
  });
  res.status(200).json(out);
});

app.post('/api/campaigns/:id/progress-tags', (req, res) => {
  try {
    // S3
    const { id } = req.params;
    const { founderId, tag } = req.body;
    const cmp = fallbackCampaigns.find((c) => c.id === id || c._id === id);
    if (!cmp) return res.status(404).json({ error: 'Campaign not found.' });
    if (!founderId || String(cmp.founder_id) !== String(founderId)) {
      return res.status(403).json({ error: 'You can only add tags to your own campaigns.' });
    }
    const t = String(tag || '').trim();
    if (!t) return res.status(400).json({ error: 'Tag name is required.' });
    if (!Array.isArray(fallbackProgressTags[id])) fallbackProgressTags[id] = [];
    if (!fallbackProgressTags[id].includes(t)) fallbackProgressTags[id].push(t);
    persistS3ProgressTagStore(); // S3
    res.status(201).json({ tags: fallbackProgressTags[id] });
  } catch (err) {
    res.status(500).json({ error: 'Error saving progress tag.' });
  }
});

// ============================================================================
// S3: FOUNDER SECURITY DEPOSIT (recorded bond; no payment gateway)
// ============================================================================
app.get('/api/founders/:founderId/security-deposit', (req, res) => {
  // S3
  const rec = fallbackSecurityDeposits[req.params.founderId] || { amount: 0, ledger: [] };
  res.status(200).json(rec);
});

app.post('/api/founders/:founderId/security-deposit', (req, res) => {
  try {
    // S3
    const { founderId } = req.params;
    const amount = Number(req.body.amount);
    const method = String(req.body.method || 'other').trim() || 'other';
    if (!founderId) return res.status(400).json({ error: 'Founder ID is required.' });
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid deposit amount.' });
    }
    if (!fallbackSecurityDeposits[founderId]) {
      fallbackSecurityDeposits[founderId] = { amount: 0, ledger: [] };
    }
    fallbackSecurityDeposits[founderId].amount = Number(fallbackSecurityDeposits[founderId].amount || 0) + amount;
    fallbackSecurityDeposits[founderId].ledger = [
      {
        id: 'dep_' + Date.now(),
        amount,
        method,
        created_at: new Date().toISOString()
      },
      ...(fallbackSecurityDeposits[founderId].ledger || [])
    ].slice(0, 50);
    persistS3DepositStore(); // S3
    res.status(201).json(fallbackSecurityDeposits[founderId]);
  } catch (err) {
    res.status(500).json({ error: 'Error recording security deposit.' });
  }
});

// ============================================================================
// FR-8: PROGRESS LOGGING / ANNOUNCEMENTS APIS
// ============================================================================
app.get('/api/campaigns/:id/updates', async (req, res) => {
  try {
    const { id } = req.params;
    const viewer = String(req.query.viewer || 'public').toLowerCase();
    const founderId = req.query.founderId;
    if (!id) return res.status(400).json({ error: 'Campaign ID is required.' });

    let list = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('campaign_updates')
          .select('*')
          .eq('campaign_id', id)
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) list = data;
      } catch (e) {}
    }

    const local = fallbackUpdates.filter(u => u.campaign_id === id);
    if (list.length === 0) {
      list = local;
    } else if (local.length > 0) {
      const seen = new Set(list.map(u => u.id));
      list = [...local.filter(u => !seen.has(u.id)), ...list];
    }

    // Public viewers only see admin-approved updates. Founders see their own (all statuses).
    if (viewer === 'founder' && founderId) {
      list = list.filter(u => u.founder_id === founderId);
    } else if (viewer !== 'admin') {
      list = list.filter(u => (u.status || 'approved') === 'approved');
    }

    list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching campaign updates.' });
  }
});

app.post('/api/campaigns/:id/updates', async (req, res) => {
  try {
    const { id } = req.params;
    const { founderId, title, content, milestoneTag } = req.body;

    if (!id) return res.status(400).json({ error: 'Campaign ID is required.' });
    if (!founderId) return res.status(400).json({ error: 'Founder ID is required.' });
    if (!String(title || '').trim() || !String(content || '').trim()) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const newUpdate = {
      id: 'upd_' + Date.now(),
      campaign_id: id,
      founder_id: founderId,
      title: String(title).trim(),
      content: String(content).trim(),
      milestone_tag: String(milestoneTag || 'General Update').trim(),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('campaign_updates').insert([newUpdate]); } catch (e) {}
    }
    fallbackUpdates.unshift(newUpdate);
    persistS3UpdateStore(); // S3

    res.status(201).json(newUpdate);
  } catch (err) {
    res.status(500).json({ error: 'Error creating campaign update.' });
  }
});

app.get('/api/admin/campaign-updates/pending', async (req, res) => {
  try {
    const list = fallbackUpdates
      .filter(u => (u.status || 'pending') === 'pending')
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching pending campaign updates.' });
  }
});

app.post('/api/admin/campaign-updates/:updateId/status', async (req, res) => {
  try {
    const { updateId } = req.params;
    const status = String(req.body.status || '').toLowerCase();
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected.' });
    }
    const upd = fallbackUpdates.find(u => u.id === updateId);
    if (!upd) return res.status(404).json({ error: 'Campaign update not found.' });
    upd.status = status;
    upd.reviewed_at = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('campaign_updates').update({ status }).eq('id', updateId);
      } catch (e) {}
    }

    persistS3UpdateStore(); // S3
    res.status(200).json({ message: `Update ${status}.`, update: upd });
  } catch (err) {
    res.status(500).json({ error: 'Error updating campaign update status.' });
  }
});

// S3: reject a progress update with a reason (does not change POST .../status)
app.post('/api/admin/campaign-updates/:updateId/reject', async (req, res) => {
  try {
    const { updateId } = req.params;
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A rejection reason is required.' });
    const upd = fallbackUpdates.find((u) => u.id === updateId);
    if (!upd) return res.status(404).json({ error: 'Campaign update not found.' });
    upd.status = 'rejected';
    upd.rejectionReason = reason;
    upd.rejection_reason = reason;
    upd.reviewed_at = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('campaign_updates').update({ status: 'rejected' }).eq('id', updateId);
      } catch (e) {}
    }
    persistS3UpdateStore(); // S3
    res.status(200).json({ message: 'Update rejected.', update: upd });
  } catch (err) {
    res.status(500).json({ error: 'Error rejecting campaign update.' });
  }
});

// Founder milestone proof upload (evidence for a specific milestone)
app.post('/api/campaigns/:id/milestones/:milestoneId/proofs', upload.single('proofFile'), async (req, res) => {
  try {
    const { id, milestoneId } = req.params;
    const founderId = req.body.founderId;
    const note = String(req.body.note || '').trim();
    const idx = Number(milestoneId);

    if (!id) return res.status(400).json({ error: 'Campaign ID is required.' });
    if (!founderId) return res.status(400).json({ error: 'Founder ID is required.' });
    if (Number.isNaN(idx) || idx < 0) return res.status(400).json({ error: 'Invalid milestone id.' });
    if (!req.file) return res.status(400).json({ error: 'Proof file is required (PDF, JPG, or PNG).' });

    const proof = {
      id: 'proof_' + Date.now(),
      path: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      note,
      uploaded_by: founderId,
      created_at: new Date().toISOString()
    };

    const cmp = fallbackCampaigns.find(c => c.id === id || c._id === id);
    if (!cmp) return res.status(404).json({ error: 'Campaign not found.' });
    if (!Array.isArray(cmp.milestones) || !cmp.milestones[idx]) {
      return res.status(404).json({ error: 'Milestone not found on this campaign.' });
    }

    if (!Array.isArray(cmp.milestones[idx].proofs)) cmp.milestones[idx].proofs = [];
    cmp.milestones[idx].proofs.push(proof);
    const st = String(cmp.milestones[idx].status || '').toLowerCase();
    if (st !== 'done' && st !== 'completed') {
      cmp.milestones[idx].status = 'pending_review';
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('campaigns').update({ milestones: cmp.milestones }).eq('id', id);
      } catch (e) {}
    }

    persistS3CampaignStore(); // S3

    res.status(201).json({
      message: 'Proof uploaded for milestone verification.',
      proof,
      milestoneId: idx,
      milestone: cmp.milestones[idx]
    });
  } catch (err) {
    res.status(500).json({ error: 'Error uploading milestone proof.' });
  }
});

// ============================================================================
// FR-15: INVESTOR WATCHLIST PINS APIS
// ============================================================================
app.get('/api/investors/watchlist', async (req, res) => {
  try {
    const { userId } = req.query;
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('watchlist').select('*').eq('user_id', userId);
      if (!error && data) return res.status(200).json(data);
    }
    const saved = fallbackWatchlist.filter(w => w.user_id === userId);
    res.status(200).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching watchlist.' });
  }
});

app.post('/api/investors/watchlist', async (req, res) => {
  try {
    const { userId, campaignId } = req.body;
    if (!userId || !campaignId) return res.status(400).json({ error: 'User ID and Campaign ID required.' });

    const existingIdx = fallbackWatchlist.findIndex(w => w.user_id === userId && w.campaign_id === campaignId);
    let status = 'added';

    if (existingIdx >= 0) {
      fallbackWatchlist.splice(existingIdx, 1);
      status = 'removed';
      if (isSupabaseConfigured && supabase) {
        try { await supabase.from('watchlist').delete().eq('user_id', userId).eq('campaign_id', campaignId); } catch(e){}
      }
    } else {
      const item = { id: 'w_' + Date.now(), user_id: userId, campaign_id: campaignId, created_at: new Date().toISOString() };
      fallbackWatchlist.push(item);
      if (isSupabaseConfigured && supabase) {
        try { await supabase.from('watchlist').insert([item]); } catch(e){}
      }
    }

    res.status(200).json({ status, campaignId });
  } catch (err) {
    res.status(500).json({ error: 'Error toggling watchlist.' });
  }
});

// ============================================================================
// FR-22: AUTOMATED NOTIFICATIONS APIS
// ============================================================================
app.get('/api/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const filtered = data.filter(n => !userId || n.user_id === userId);
        return res.status(200).json(filtered);
      }
    }
    const list = fallbackNotifications.filter(n => !userId || n.user_id === userId);
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching notifications.' });
  }
});

app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('notifications').update({ is_read: true }).eq('id', id); } catch(e){}
    }
    const notif = fallbackNotifications.find(n => n.id === id);
    if (notif) notif.is_read = true;
    res.status(200).json({ message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Error marking notification read.' });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const { userId, title, message, type } = req.body;
    if (!userId || !title) return res.status(400).json({ error: 'User ID and title required.' });

    const notif = await createAndDispatchNotification(userId, title, message || '', type || 'info');
    res.status(201).json(notif);
  } catch (err) {
    res.status(500).json({ error: 'Error sending notification.' });
  }
});

// ============================================================================
// INVESTOR DASHBOARD SYSTEM ENDPOINTS (FR-23 to FR-28)
// ============================================================================

// PROPOSAL WITHDRAWAL
app.post('/api/proposals/:id/withdraw', async (req, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('proposals').update({ status: 'withdrawn' }).eq('id', id);
      } catch (e) {}
    }
    const prop = fallbackProposals.find(p => p.id === id || p._id === id);
    if (prop) prop.status = 'withdrawn';
    res.status(200).json({ message: 'Proposal withdrawn successfully.', proposalId: id });
  } catch (err) {
    res.status(500).json({ error: 'Error withdrawing proposal.' });
  }
});

app.delete('/api/proposals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('proposals').update({ status: 'withdrawn' }).eq('id', id);
      } catch (e) {}
    }
    const prop = fallbackProposals.find(p => p.id === id || p._id === id);
    if (prop) prop.status = 'withdrawn';
    res.status(200).json({ message: 'Proposal withdrawn successfully.', proposalId: id });
  } catch (err) {
    res.status(500).json({ error: 'Error withdrawing proposal.' });
  }
});

// CO-INVESTOR CONNECTIONS APIS
app.get('/api/investors/connections', async (req, res) => {
  try {
    const { userId } = req.query;
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('investor_connections').select('*');
      if (!error && data) {
        const filtered = data.filter(c => !userId || c.requester_id === userId || c.receiver_id === userId);
        return res.status(200).json(filtered);
      }
    }
    const list = fallbackConnections.filter(c => !userId || c.requester_id === userId || c.receiver_id === userId);
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching investor connections.' });
  }
});

app.post('/api/investors/connect', async (req, res) => {
  try {
    const { requesterId, receiverId } = req.body;
    if (!requesterId || !receiverId) return res.status(400).json({ error: 'Requester ID and Receiver ID required.' });

    const existing = fallbackConnections.find(c =>
      (c.requester_id === requesterId && c.receiver_id === receiverId) ||
      (c.requester_id === receiverId && c.receiver_id === requesterId)
    );

    if (existing) {
      return res.status(200).json({ message: 'Connection request already exists.', connection: existing });
    }

    const conn = {
      id: 'conn_' + Date.now(),
      requester_id: requesterId,
      receiver_id: receiverId,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      try { await supabase.from('investor_connections').insert([conn]); } catch(e){}
    }
    fallbackConnections.push(conn);

    await createAndDispatchNotification(
      receiverId,
      'New Co-Investor Connection Request! 🤝',
      'An alumni angel investor wants to connect with your investment network.',
      'info'
    );

    res.status(201).json({ message: 'Connection request sent.', connection: conn });
  } catch (err) {
    res.status(500).json({ error: 'Error sending connection request.' });
  }
});

// BOOKMARKED FOUNDERS APIS
app.get('/api/investors/bookmarked-founders', async (req, res) => {
  try {
    const { userId } = req.query;
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('bookmarked_founders').select('*').eq('investor_id', userId);
      if (!error && data) return res.status(200).json(data);
    }
    const list = fallbackBookmarkedFounders.filter(b => b.investor_id === userId);
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching bookmarked founders.' });
  }
});

app.post('/api/investors/bookmark-founder', async (req, res) => {
  try {
    const { investorId, founderId } = req.body;
    if (!investorId || !founderId) return res.status(400).json({ error: 'Investor ID and Founder ID required.' });

    const existingIdx = fallbackBookmarkedFounders.findIndex(b => b.investor_id === investorId && b.founder_id === founderId);
    let status = 'bookmarked';

    if (existingIdx >= 0) {
      fallbackBookmarkedFounders.splice(existingIdx, 1);
      status = 'unbookmarked';
      if (isSupabaseConfigured && supabase) {
        try { await supabase.from('bookmarked_founders').delete().eq('investor_id', investorId).eq('founder_id', founderId); } catch(e){}
      }
    } else {
      const item = { id: 'bf_' + Date.now(), investor_id: investorId, founder_id: founderId, created_at: new Date().toISOString() };
      fallbackBookmarkedFounders.push(item);
      if (isSupabaseConfigured && supabase) {
        try { await supabase.from('bookmarked_founders').insert([item]); } catch(e){}
      }
    }

    res.status(200).json({ status, founderId });
  } catch (err) {
    res.status(500).json({ error: 'Error toggling bookmarked founder.' });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;

