import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  LayoutGrid,
  Rocket,
  Users,
  Flag,
  FileText,
  Settings,
  HelpCircle,
  Plus,
  Search,
  Bell,
  MessageSquare,
  ArrowRight,
  Upload,
  Clock,
  Shield,
  Download,
  Filter,
  ChevronRight,
  X,
  Info,
  ExternalLink,
  Lock,
  Sparkles,
  Eye,
  Zap,
  Building,
  LogOut,
  Compass,
  Heart
} from 'lucide-react';

export default function FounderDashboard({ currentUser, onLogout, API_BASE_URL, triggerAlert }) {
  const user = currentUser || {
    id: 'usr_founder_1',
    name: 'Anika Rahman',
    email: 'anika@brac.edu.bd',
    university: 'BRAC University',
    vettingStatus: 'verified',
    mfsNumber: '01711223344',
    department: 'Computer Science & Engineering',
    studentId: '20101452'
  };

  // Active Sidebar Tab: 'overview' | 'campaign' | 'explore' | 'investors' | 'wallet' | 'milestones' | 'audit' | 'settings'
  const [activeTab, setActiveTab] = useState('overview');

  // Editable Profile User State
  const [profileUser, setProfileUser] = useState({
    name: user.name || '',
    email: user.email || '',
    university: user.university || '',
    department: user.department || '',
    studentId: user.studentId || user.student_id || '',
    studentIdCardImage: user.studentIdCardImage || '',
    nidCardImage: user.nidCardImage || '',
    mfsNumber: user.mfsNumber || '',
    vettingStatus: user.vettingStatus || 'verified',
    bio: user.bio || ''
  });

  const applyFounderProfile = (p) => {
    if (!p) return;
    setProfileUser((prev) => ({
      ...prev,
      name: p.name ?? prev.name,
      email: p.email ?? prev.email,
      university: p.university ?? prev.university,
      department: p.department ?? prev.department,
        studentId: p.studentId || p.student_id || prev.studentId,
        studentIdCardImage: p.studentIdCardImage || p.student_id_card_image || prev.studentIdCardImage,
        nidCardImage: p.nidCardImage || p.nid_card_image || prev.nidCardImage,
        mfsNumber: p.mfsNumber || p.mfs_number || prev.mfsNumber,
      vettingStatus: p.vettingStatus || p.vetting_status || prev.vettingStatus,
      bio: p.bio ?? prev.bio
    }));
  };

  const persistFounderSession = (p) => {
    try {
      const saved = JSON.parse(localStorage.getItem('fundbridge_user') || '{}');
      localStorage.setItem('fundbridge_user', JSON.stringify({
        ...saved,
        name: p.name ?? saved.name,
        email: p.email ?? saved.email,
        university: p.university ?? saved.university,
        department: p.department ?? saved.department,
        studentId: p.studentId || p.student_id || saved.studentId,
        mfsNumber: p.mfsNumber || p.mfs_number || saved.mfsNumber,
        bio: p.bio ?? saved.bio,
        vettingStatus: p.vettingStatus || p.vetting_status || saved.vettingStatus
      }));
    } catch (e) {}
  };

  const recordFounderAudit = async ({ category, title, status = 'RECORDED' }) => {
    const founderId = currentUser?.id || currentUser?._id || user.id;
    try {
      await fetch(`${API_BASE_URL}/api/founders/${encodeURIComponent(founderId)}/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, title, status })
      });
    } catch (e) {}
  };

  // Notifications & Chat State
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatTarget, setChatTarget] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInputText, setChatInputText] = useState('');
  const [selectedInvestor, setSelectedInvestor] = useState(null); // S3: directory detail
  const [selectedInvestorDeals, setSelectedInvestorDeals] = useState([]); // S3

  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!chatInputText.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser?.id || currentUser?._id || user.id,
          senderName: profileUser.name || user.name || 'Founder',
          receiverId: chatTarget?._id || chatTarget?.id || 'all',
          text: chatInputText
        })
      });
      if (res.ok) {
        const saved = await res.json();
        setChatMessages((prev) => (saved && saved.id ? [...prev, saved] : prev));
        setChatInputText('');
      }
    } catch (err) {}
  };

  const chatTargetRef = useRef(null);
  useEffect(() => {
    chatTargetRef.current = chatTarget;
  }, [chatTarget]);

  const openChatWithInvestor = async (inv) => {
    if (!inv) return;
    setChatTarget(inv);
    setShowChatDrawer(true);
    const me = currentUser?.id || currentUser?._id || user.id;
    const other = inv.id || inv._id;
    if (!me || !other) {
      setChatMessages([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/chat/thread?senderId=${encodeURIComponent(me)}&receiverId=${encodeURIComponent(other)}`
      );
      if (res.ok) {
        const rows = await res.json();
        setChatMessages(Array.isArray(rows) ? rows : []);
      } else {
        setChatMessages([]);
      }
    } catch {
      setChatMessages([]);
    }
  };

  const openInvestorDetail = async (inv) => {
    if (!inv) return;
    const id = inv.id || inv._id;
    setSelectedInvestor(inv);
    setSelectedInvestorDeals([]);
    if (!id) return;
    try {
      const [profRes, dealRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/investors/${encodeURIComponent(id)}/profile`),
        fetch(`${API_BASE_URL}/api/proposals/investor/${encodeURIComponent(id)}`)
      ]);
      if (profRes.ok) {
        const profile = await profRes.json();
        setSelectedInvestor({ ...inv, ...profile });
      }
      if (dealRes.ok) {
        const deals = await dealRes.json();
        setSelectedInvestorDeals(Array.isArray(deals) ? deals : []);
      }
    } catch {
      /* keep directory row */
    }
  };

  // Database State (Only real records loaded from backend)
  const [campaigns, setCampaigns] = useState([]);
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [investorsList, setInvestorsList] = useState([]);
  const [payoutsList, setPayoutsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reliefDrives, setReliefDrives] = useState([]);
  const [publicReliefCampaigns, setPublicReliefCampaigns] = useState([]);
  const [campaignsPageMode, setCampaignsPageMode] = useState('watch'); // watch | mine
  const [watchDetail, setWatchDetail] = useState(null); // S3: Campaigns to Watch detail
  const [watchDetailUpdates, setWatchDetailUpdates] = useState([]); // S3
  const [reliefPageMode, setReliefPageMode] = useState('watch'); // watch | mine
  const [showReliefCreateForm, setShowReliefCreateForm] = useState(false);
  const [idCardFile, setIdCardFile] = useState(null);
  const [nidFile, setNidFile] = useState(null);
  const emptyReliefForm = () => ({
    title: '',
    university: '',
    cause: 'Student Medical Aid',
    beneficiary: '',
    goal: 100000,
    description: '',
    use1: '',
    use2: '',
    use3: '',
    proofLinks: [{ type: 'Newspaper / Article', url: '' }],
    // S3: designated successor if founder cannot continue
    successorName: '',
    successorEmail: ''
  });
  const [reliefForm, setReliefForm] = useState(emptyReliefForm);
  const [editingReliefId, setEditingReliefId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Selected Investor Proposal
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [investorPropFilter, setInvestorPropFilter] = useState('all'); // S3

  // Campaign Form State
  const [campaignForm, setCampaignForm] = useState({
    title: '',
    university: user.university || '',
    tagline: '',
    coverPhoto: '',
    pitchVideoUrl: '',
    goal: 500000,
    durationDays: 60,
    equityOffer: '8% Revenue Share',
    description: '',
    // S3: designated successor if founder cannot continue
    successorName: '',
    successorEmail: ''
  });
  const [milestoneEditTitle, setMilestoneEditTitle] = useState('');
  const [milestoneEditTarget, setMilestoneEditTarget] = useState('');
  // S3: Overview metric card detail panels
  const [overviewDetail, setOverviewDetail] = useState(null); // null | 'escrow' | 'deposit' | 'proposals'
  const [depositAddAmount, setDepositAddAmount] = useState('');
  const [securityDepositHeld, setSecurityDepositHeld] = useState(0); // S3
  const [securityDepositLedger, setSecurityDepositLedger] = useState([]); // S3
  // S3: post-approval edit requests
  const [editRequests, setEditRequests] = useState([]);
  const [showEditRequestModal, setShowEditRequestModal] = useState(false);
  const [editRequestTarget, setEditRequestTarget] = useState(null); // { type: 'investment'|'relief', item }
  const [editRequestReason, setEditRequestReason] = useState('');
  const [editRequestForm, setEditRequestForm] = useState({});
  const [submittingEditRequest, setSubmittingEditRequest] = useState(false);

  const defaultMilestoneDrafts = () => ([
    { title: 'MVP Launch & Prototype', target: 'Month 1' },
    { title: 'Market Testing & First 100 Users', target: 'Month 2' },
    { title: 'Commercial Release & Revenue Target', target: 'Month 4' }
  ]);
  const [milestoneDrafts, setMilestoneDrafts] = useState(defaultMilestoneDrafts);

  const tranchePercentLabel = (idx, total) => {
    if (!total) return '';
    const base = Math.floor(100 / total);
    const rem = 100 - base * total;
    const pct = idx === total - 1 ? base + rem : base;
    return `Tranche ${idx + 1} (${pct}%)`;
  };

  // AI Suite State
  const [aiPrompt, setAiPrompt] = useState('');
  const [refinedPitch, setRefinedPitch] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Wallet / Payout Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bkash');

  // Progress Announcement Modal State (FR-8)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementTag, setAnnouncementTag] = useState('General Update');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementCampaignId, setAnnouncementCampaignId] = useState('');
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [timelineCampaignId, setTimelineCampaignId] = useState('');
  const [publishingUpdate, setPublishingUpdate] = useState(false);
  // S3: custom Milestone/Progress tags per campaign (persisted)
  const [customProgressTags, setCustomProgressTags] = useState({});
  const [showAddTagInput, setShowAddTagInput] = useState(false);
  const [newProgressTag, setNewProgressTag] = useState('');

  // Milestones: select one milestone, then publish update / upload proof for it
  const [selectedMilestoneIdx, setSelectedMilestoneIdx] = useState(null);
  const [milestoneProofFile, setMilestoneProofFile] = useState(null);
  const [milestoneProofNote, setMilestoneProofNote] = useState('');
  const [certifyChecked, setCertifyChecked] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [exploreCategory, setExploreCategory] = useState('all');

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // FR-8: load progress announcements for founder campaigns (newest first; includes pending)
  const loadProgressUpdates = async (campaignList) => {
    const list = Array.isArray(campaignList) ? campaignList : [];
    const userId = currentUser?.id || currentUser?._id || user.id;
    if (list.length === 0) {
      setProgressUpdates([]);
      return;
    }
    try {
      const batches = await Promise.all(list.map(async (camp) => {
        const id = camp.id || camp._id;
        if (!id) return [];
        const qs = new URLSearchParams({ viewer: 'founder', founderId: userId || '' });
        const res = await fetch(`${API_BASE_URL}/api/campaigns/${encodeURIComponent(id)}/updates?${qs}`);
        if (!res.ok) return [];
        const data = await res.json().catch(() => []);
        return (Array.isArray(data) ? data : []).map((u) => ({
          ...u,
          campaignTitle: camp.title || 'Campaign'
        }));
      }));
      const merged = batches.flat().sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
      setProgressUpdates(merged);
    } catch (err) {
      console.error('Progress updates fetch error:', err);
    }
  };

  // S3: tag options = campaign milestones + General Update + custom tags
  const getProgressTagOptions = (campaignId) => {
    const camp = campaigns.find((c) => (c.id || c._id) === campaignId);
    const fromMs = (Array.isArray(camp?.milestones) ? camp.milestones : [])
      .map((m, i) => (m.title || m.name || `Milestone ${i + 1}`).trim())
      .filter(Boolean);
    const custom = customProgressTags[campaignId] || [];
    return [...new Set([...fromMs, 'General Update', ...custom])];
  };

  const openAnnouncementModal = () => {
    const openCampaigns = campaigns.filter((c) => c.status !== 'cancelled');
    if (openCampaigns.length === 0) {
      showToast('Create a campaign before publishing a progress update.', 'error');
      return;
    }
    const openIds = new Set(openCampaigns.map((c) => c.id || c._id));
    const preferred =
      (announcementCampaignId && openIds.has(announcementCampaignId) && announcementCampaignId) ||
      (timelineCampaignId && openIds.has(timelineCampaignId) && timelineCampaignId) ||
      (openCampaigns[0].id || openCampaigns[0]._id);
    setAnnouncementCampaignId(preferred);
    const opts = getProgressTagOptions(preferred);
    setAnnouncementTag(opts[0] || 'General Update');
    setShowAddTagInput(false);
    setNewProgressTag('');
    setShowAnnouncementModal(true);
  };

  const openAnnouncementForMilestone = (idx) => {
    if (!activeCampaign) {
      showToast('No active campaign found.', 'error');
      return;
    }
    const m = activeCampaign.milestones?.[idx];
    if (!m) {
      showToast('Select a valid milestone first.', 'error');
      return;
    }
    const campId = activeCampaign.id || activeCampaign._id;
    const label = (m.name || m.title || `Milestone #${idx + 1}`).trim();
    setSelectedMilestoneIdx(idx);
    setAnnouncementCampaignId(campId);
    setAnnouncementTag(label);
    setAnnouncementTitle('');
    setAnnouncementContent('');
    setShowAddTagInput(false);
    setNewProgressTag('');
    setShowAnnouncementModal(true);
  };

  const handleAddProgressTag = async () => {
    const tag = newProgressTag.trim();
    if (!tag) {
      showToast('Enter a tag name.', 'error');
      return;
    }
    const campId = announcementCampaignId;
    if (!campId) return;
    if (getProgressTagOptions(campId).includes(tag)) {
      setAnnouncementTag(tag);
      setNewProgressTag('');
      setShowAddTagInput(false);
      return;
    }
    const userId = currentUser?.id || currentUser?._id || user.id;
    try {
      const res = await fetch(`${API_BASE_URL}/api/campaigns/${encodeURIComponent(campId)}/progress-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ founderId: userId, tag })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save tag');
      setCustomProgressTags((prev) => ({ ...prev, [campId]: data.tags || [...(prev[campId] || []), tag] }));
      setAnnouncementTag(tag);
      setNewProgressTag('');
      setShowAddTagInput(false);
      showToast('New progress tag added for this campaign.', 'success');
    } catch (err) {
      showToast(err.message || 'Error saving progress tag.', 'error');
    }
  };

  const handleUploadMilestoneProof = async () => {
    if (selectedMilestoneIdx === null || selectedMilestoneIdx === undefined) {
      showToast('Select a milestone first.', 'error');
      return;
    }
    if (!activeCampaign) {
      showToast('No active campaign found.', 'error');
      return;
    }
    if (!milestoneProofFile) {
      showToast('Choose a proof file (PDF, JPG, or PNG).', 'error');
      return;
    }
    if (!certifyChecked) {
      showToast('Please certify that the documents are accurate.', 'error');
      return;
    }

    const campId = activeCampaign.id || activeCampaign._id;
    const userId = currentUser?.id || currentUser?._id || user.id;
    const m = activeCampaign.milestones[selectedMilestoneIdx];
    const milestoneLabel = m?.name || m?.title || `Milestone #${selectedMilestoneIdx + 1}`;

    try {
      setUploadingProof(true);
      const formData = new FormData();
      formData.append('founderId', userId);
      formData.append('proofFile', milestoneProofFile);
      formData.append('note', milestoneProofNote.trim() || `Evidence for ${milestoneLabel}`);

      const res = await fetch(
        `${API_BASE_URL}/api/campaigns/${encodeURIComponent(campId)}/milestones/${selectedMilestoneIdx}/proofs`,
        { method: 'POST', body: formData }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Failed to upload milestone proof.', 'error');
        return;
      }
      setMilestoneProofFile(null);
      setMilestoneProofNote('');
      setCertifyChecked(false);
      showToast(`Proof uploaded for "${milestoneLabel}". Pending verification.`, 'success');
      await fetchDatabaseData();
    } catch (err) {
      showToast('Error uploading milestone proof.', 'error');
    } finally {
      setUploadingProof(false);
    }
  };

  // Fetch Database Data from API endpoints
  const fetchDatabaseData = async () => {
    const userId = currentUser?.id || currentUser?._id || user.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const fetchJsonTimed = async (url, ms = 8000) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        try {
          const res = await fetch(url, { signal: ctrl.signal });
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        } finally {
          clearTimeout(timer);
        }
      };
      const mergeById = (lists) => {
        const byId = new Map();
        lists.forEach((list) => {
          if (!Array.isArray(list)) return;
          list.forEach((row) => {
            const id = row && (row.id || row._id);
            if (id) byId.set(String(id), row);
          });
        });
        return [...byId.values()];
      };

      const email = String(currentUser?.email || user.email || '').toLowerCase();
      const founderIds = [String(userId)];
      if (email === 'ashraf.khan1@univ.edu.bd' || String(userId) === 'usr_founder_1') {
        if (!founderIds.includes('usr_founder_1')) founderIds.push('usr_founder_1');
      }

      const [watchData, dirData, publicRelief] = await Promise.all([
        fetchJsonTimed(`${API_BASE_URL}/api/campaigns/watchable`),
        fetchJsonTimed(`${API_BASE_URL}/api/investors/directory`),
        fetchJsonTimed(`${API_BASE_URL}/api/relief-drives`)
      ]);
      if (Array.isArray(watchData) && watchData.length > 0) setAllCampaigns(watchData);
      if (Array.isArray(dirData) && dirData.length > 0) setInvestorsList(dirData);
      if (Array.isArray(publicRelief) && publicRelief.length > 0) setPublicReliefCampaigns(publicRelief);

      const campLists = await Promise.all(founderIds.flatMap((id) => [
        fetchJsonTimed(`${API_BASE_URL}/api/founders/${encodeURIComponent(id)}/campaigns`, 5000),
        fetchJsonTimed(`${API_BASE_URL}/api/campaigns/founder/${encodeURIComponent(id)}`, 8000)
      ]));
      let userCampaigns = mergeById(campLists);
      if (userCampaigns.length > 0) {
        setCampaigns(userCampaigns);
        const openCamps = userCampaigns.filter((c) => c.status !== 'cancelled');
        const preferred =
          openCamps.find((c) => c.verified || c.status === 'verified') ||
          openCamps[0] ||
          userCampaigns[0];
        const preferredId = preferred.id || preferred._id || '';
        setTimelineCampaignId((prev) => prev || preferredId);
        setAnnouncementCampaignId((prev) => prev || preferredId);
        setCampaignForm({
          title: preferred.title || '',
          university: preferred.university || profileUser.university || '',
          tagline: preferred.tagline || '',
          coverPhoto: preferred.cover_photo || preferred.coverPhoto || '',
          pitchVideoUrl: preferred.pitch_video_url || preferred.pitchVideoUrl || '',
          goal: preferred.goal || 500000,
          durationDays: preferred.durationDays || 60,
          equityOffer: preferred.equity_offer || preferred.equityOffer || '',
          description: preferred.description || ''
        });
        await loadProgressUpdates(userCampaigns);
      }

      const reliefLists = await Promise.all(founderIds.flatMap((id) => [
        fetchJsonTimed(`${API_BASE_URL}/api/founders/${encodeURIComponent(id)}/relief-drives`, 5000),
        fetchJsonTimed(`${API_BASE_URL}/api/relief-drives/founder/${encodeURIComponent(id)}`, 8000)
      ]));
      const reliefMerged = mergeById(reliefLists);
      if (reliefMerged.length > 0) setReliefDrives(reliefMerged);

      const profileData = await fetchJsonTimed(`${API_BASE_URL}/api/users/profile?userId=${encodeURIComponent(userId)}`, 5000);
      if (profileData) applyFounderProfile(profileData.user || profileData);

      try {
        const erRes = await fetchJsonTimed(`${API_BASE_URL}/api/edit-requests/founder/${encodeURIComponent(userId)}`, 5000);
        if (Array.isArray(erRes)) setEditRequests(erRes);
      } catch {
        /* keep */
      }

      try {
        const tagMap = await fetchJsonTimed(`${API_BASE_URL}/api/progress-tags/founder/${encodeURIComponent(userId)}`, 5000);
        if (tagMap && typeof tagMap === 'object') setCustomProgressTags(tagMap);
      } catch {
        /* keep session tags */
      }

      const approvedForProps = userCampaigns.filter(
        (c) => c.verified === true || ['verified', 'open', 'live'].includes(String(c.status || '').toLowerCase())
      );
      const propBuckets = await Promise.all(
        approvedForProps.map(async (camp) => {
          const campId = camp.id || camp._id;
          if (!campId) return [];
          const rows = await fetchJsonTimed(`${API_BASE_URL}/api/proposals/campaign/${campId}`, 5000);
          return Array.isArray(rows) ? rows : [];
        })
      );
      const mergedProps = propBuckets.flat();
      if (mergedProps.length > 0) {
        setProposals(mergedProps);
        setSelectedProposal(mergedProps[0]);
      }
      const fpropLists = await Promise.all(
        founderIds.map((id) => fetchJsonTimed(`${API_BASE_URL}/api/proposals/founder/${encodeURIComponent(id)}`, 5000))
      );
      const fprop = mergeById(fpropLists);
      if (fprop.length > 0) {
        setProposals(fprop);
        setSelectedProposal(fprop[0]);
      }

      const payData = await fetchJsonTimed(`${API_BASE_URL}/api/payouts/founder/${encodeURIComponent(userId)}`, 5000);
      if (Array.isArray(payData) && payData.length > 0) setPayoutsList(payData);

      const auditData = await fetchJsonTimed(`${API_BASE_URL}/api/founders/${encodeURIComponent(userId)}/audit-logs`, 5000);
      if (Array.isArray(auditData) && auditData.length > 0) setAuditLogs(auditData);

      const notifData = await fetchJsonTimed(`${API_BASE_URL}/api/notifications?userId=${encodeURIComponent(userId)}`, 5000);
      if (Array.isArray(notifData) && notifData.length > 0) setNotifications(notifData);

      const dep = await fetchJsonTimed(`${API_BASE_URL}/api/founders/${encodeURIComponent(userId)}/security-deposit`, 5000);
      if (dep) {
        setSecurityDepositHeld(Number(dep.amount) || 0);
        setSecurityDepositLedger(Array.isArray(dep.ledger) ? dep.ledger : []);
      }

      setLoading(false);
    } catch (err) {
      console.error('Database fetch error:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseData();

    // Socket.io real-time listener for instant notifications
    const newSocket = io(API_BASE_URL);
    const userId = currentUser?.id || currentUser?._id || user.id;

    if (userId) {
      newSocket.emit('join_room', userId);
    }

    newSocket.on('receive_notification', (newNotif) => {
      if (newNotif.user_id === userId || newNotif.user_id === 'all') {
        setNotifications(prev => [newNotif, ...prev]);
        showToast(`🔔 ${newNotif.title}: ${newNotif.message}`, 'info');
      }
    });

    newSocket.on('new_notification_broadcast', (newNotif) => {
      if (!newNotif.user_id || newNotif.user_id === userId || newNotif.user_id === 'all') {
        setNotifications(prev => [newNotif, ...prev]);
      }
    });

    // S3: live chat into the open investor thread
    newSocket.on('new_direct_message', (msg) => {
      const me = String(userId);
      const other = String(chatTargetRef.current?.id || chatTargetRef.current?._id || '');
      if (!msg || !other) return;
      const s = String(msg.sender_id || '');
      const r = String(msg.receiver_id || '');
      const inThread = (s === me && r === other) || (s === other && r === me);
      if (!inThread) return;
      setChatMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser]);

  // S3: only admin-approved / live campaigns count for money totals, %, investments
  const isApprovedCampaign = (c) =>
    !!(c && (c.verified === true || ['verified', 'open', 'live'].includes(String(c.status || '').toLowerCase())));

  const manageableCampaigns = campaigns.filter((c) => c.status !== 'cancelled');
  const approvedCampaigns = manageableCampaigns.filter(isApprovedCampaign);

  // S3: active campaign = selected (timeline) → approved → first non-cancelled
  const activeCampaign = (() => {
    if (manageableCampaigns.length === 0) return null;
    if (timelineCampaignId) {
      const picked = manageableCampaigns.find((c) => (c.id || c._id) === timelineCampaignId);
      if (picked) return picked;
    }
    if (approvedCampaigns.length > 0) return approvedCampaigns[0];
    return manageableCampaigns[0];
  })();

  // S3: escrow / goal aggregates — approved campaigns only
  const totalEscrowRaised = approvedCampaigns.reduce((sum, c) => sum + (Number(c.raised) || 0), 0);
  const totalExpectedGoal = approvedCampaigns.reduce((sum, c) => sum + (Number(c.goal) || 0), 0);
  const escrowGoalPercent = totalExpectedGoal > 0
    ? Math.min(100, Math.round((totalEscrowRaised / totalExpectedGoal) * 100))
    : 0;

  const approvedCampaignIds = new Set(approvedCampaigns.map((c) => c.id || c._id));
  // S3: proposal counts only for approved campaigns
  const approvedProposals = proposals.filter((p) => {
    const cid = p.campaign_id || p.campaignId;
    return cid ? approvedCampaignIds.has(cid) : approvedCampaigns.length > 0;
  });

  // S3: approved relief campaigns (for escrow breakdown)
  const approvedReliefCampaigns = reliefDrives.filter(
    (d) => d && ['open', 'verified'].includes(String(d.status || '').toLowerCase())
  );
  const totalReliefRaised = approvedReliefCampaigns.reduce((sum, d) => sum + (Number(d.raised) || 0), 0);
  const totalCombinedRaised = totalEscrowRaised + totalReliefRaised;

  const handleDepositAdd = async (method) => {
    // S3: record bond amount (no payment gateway)
    const amt = Number(depositAddAmount);
    if (!amt || amt <= 0) {
      showToast('Enter a valid deposit amount first.', 'error');
      return;
    }
    const userId = currentUser?.id || currentUser?._id || user.id;
    try {
      const res = await fetch(`${API_BASE_URL}/api/founders/${encodeURIComponent(userId)}/security-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, method })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to record deposit');
      setSecurityDepositHeld(Number(data.amount) || 0);
      setSecurityDepositLedger(Array.isArray(data.ledger) ? data.ledger : []);
      setDepositAddAmount('');
      showToast(`Security deposit recorded: ৳ ${amt.toLocaleString()} via ${method}. (Ledger only — payment rails are not connected.)`, 'success');
      recordFounderAudit({ category: 'DEPOSIT', title: `Recorded security deposit ৳ ${amt.toLocaleString()} (${method})`, status: 'RECORDED' });
    } catch (err) {
      showToast(err.message || 'Error recording security deposit.', 'error');
    }
  };

  const visibleProgressUpdates = timelineCampaignId
    ? progressUpdates.filter((u) => u.campaign_id === timelineCampaignId)
    : progressUpdates;

  // Handle Proposal Status Update (Accept/Decline)
  const handleProposalStatus = async (proposalId, status) => {
    const p = proposals.find((x) => (x.id || x._id) === proposalId) || selectedProposal;
    const campId = p?.campaign_id || p?.campaignId;
    const userId = currentUser?.id || currentUser?._id || user.id;
    if (!campId) {
      showToast('This proposal is missing a campaign id.', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/founder/proposals/${encodeURIComponent(proposalId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, campaignId: campId, founderId: userId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(`Investor proposal ${status.toUpperCase()} successfully!`, 'success');
        recordFounderAudit({
          category: 'PROPOSAL',
          title: `${status === 'accepted' ? 'Accepted' : 'Declined'} an investment proposal`,
          status: status === 'accepted' ? 'ACCEPTED' : 'DECLINED'
        });
        fetchDatabaseData();
      } else {
        showToast(data.error || 'Failed to update proposal status.', 'error');
      }
    } catch (err) {
      showToast('Server error updating proposal.', 'error');
    }
  };

  // Campaign Creation Wizard Step State (1-5)
  const [wizardStep, setWizardStep] = useState(1);

  // Selected Campaign to edit (null = creating new campaign)
  const [editingCampaignId, setEditingCampaignId] = useState(null);

  // Open Create Campaign Form Wizard
  const handleOpenCreateCampaign = () => {
    setEditingCampaignId(null);
    setWizardStep(1);
    setMilestoneDrafts(defaultMilestoneDrafts());
    setCampaignForm({
      title: '',
      university: profileUser.university || user.university || '',
      category: 'FoodTech / SaaS',
      stage: 'MVP Stage',
      tagline: '',
      coverPhoto: '',
      pitchVideoUrl: '',
      goal: 500000,
      durationDays: 60,
      equityOffer: '8% Revenue Share',
      description: '',
      successorName: '',
      successorEmail: ''
    });
    setActiveTab('campaign');
  };

  const handleOpenEditCampaign = (c) => {
    if (!c) return;
    const st = c.status || '';
    const editable = st === 'pending' || st === 'rejected' || st === 'revisions' || (!c.verified && st !== 'cancelled' && st !== 'verified');
    if (!editable && (c.verified || st === 'verified')) {
      showToast('Live approved campaigns cannot be freely edited. Contact admin if a change is required.', 'error');
      return;
    }
    setEditingCampaignId(c.id || c._id);
    setWizardStep(1);
    const ms = Array.isArray(c.milestones) && c.milestones.length > 0
      ? c.milestones.map((m) => ({ title: m.title || m.name || '', target: m.target || m.targetDate || '' }))
      : defaultMilestoneDrafts();
    setMilestoneDrafts(ms);
    setCampaignForm({
      title: c.title || '',
      university: c.university || profileUser.university || '',
      category: c.category || 'FoodTech / SaaS',
      stage: c.stage || 'MVP Stage',
      tagline: c.tagline || '',
      coverPhoto: c.cover_photo || c.coverPhoto || '',
      pitchVideoUrl: c.pitch_video_url || c.pitchVideoUrl || '',
      goal: c.goal || 500000,
      durationDays: c.durationDays || 60,
      equityOffer: c.equity_offer || c.equityOffer || '',
      description: c.description || '',
      successorName: c.successorName || c.successor_name || '',
      successorEmail: c.successorEmail || c.successor_email || ''
    });
    setActiveTab('campaign');
  };

  // Save/Create Campaign Form Submit
  const handleSaveCampaign = async (e) => {
    if (e) e.preventDefault();
    if (profileUser.vettingStatus === 'pending' || profileUser.vetting_status === 'pending') {
      showToast('Your founder profile is pending Admin approval. You cannot launch a campaign until your profile is verified by Super Admin.', 'error');
      return;
    }
    if (!campaignForm.title || campaignForm.title.trim() === '') {
      showToast('Please enter a Startup Name for your campaign.', 'error');
      setWizardStep(1);
      return;
    }
    const cleanMilestones = milestoneDrafts
      .map((m) => ({ title: (m.title || '').trim(), target: (m.target || '').trim() }))
      .filter((m) => m.title);
    if (cleanMilestones.length === 0) {
      showToast('Add at least one milestone (title required).', 'error');
      setWizardStep(4);
      return;
    }

    if (editingCampaignId) {
      const ok = window.confirm(
        'Editing this campaign will restart admin approval from day zero. Approval takes at most 3 days. Continue?'
      );
      if (!ok) return;
    }

    const userId = currentUser?.id || currentUser?._id || user.id;
    try {
      const payload = {
        title: campaignForm.title,
        founderId: userId,
        university: campaignForm.university || profileUser.university || 'BRAC University',
        location: 'Dhaka, Bangladesh',
        category: campaignForm.category || 'Startup Venture',
        stage: campaignForm.stage || 'MVP Stage',
        goal: Number(campaignForm.goal) || 500000,
        equityOffer: campaignForm.equityOffer || '8% Revenue Share',
        tagline: campaignForm.tagline || '',
        coverPhoto: campaignForm.coverPhoto || '',
        pitchVideoUrl: campaignForm.pitchVideoUrl || '',
        description: campaignForm.description || campaignForm.title,
        // S3
        successorName: (campaignForm.successorName || '').trim(),
        successorEmail: (campaignForm.successorEmail || '').trim(),
        milestones: cleanMilestones.map((m, idx) => ({
          title: m.title,
          target: m.target || `Month ${idx + 1}`,
          status: idx === 0 ? 'pending' : 'locked'
        })),
        verified: false,
        status: 'pending',
        resetApproval: true
      };

      const res = editingCampaignId
        ? await fetch(`${API_BASE_URL}/api/campaigns/${editingCampaignId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await fetch(`${API_BASE_URL}/api/campaigns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, id: `cmp_${Date.now()}` })
          });

      if (res.ok) {
        showToast(
          editingCampaignId
            ? 'Campaign updated. Admin approval restarted (at most 3 days from now).'
            : 'Campaign submitted for Admin Audit & Verification! Approval takes at most 3 days.',
          'success'
        );
        recordFounderAudit({
          category: 'CAMPAIGN',
          title: editingCampaignId
            ? `Updated campaign “${campaignForm.title}”`
            : `Submitted campaign “${campaignForm.title}” for admin review`,
          status: 'PENDING'
        });
        await fetchDatabaseData();
        setCampaignsPageMode('mine');
        setActiveTab('explore');
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to save campaign.', 'error');
      }
    } catch (err) {
      showToast('Error submitting campaign to server.', 'error');
    }
  };

  const handleCancelCampaign = async (campaignId) => {
    if (!campaignId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Campaign cancelled / de-listed.', 'success');
        await fetchDatabaseData();
      } else {
        showToast('Failed to cancel campaign.', 'error');
      }
    } catch (err) {
      showToast('Error cancelling campaign.', 'error');
    }
  };

  // S3: hard-delete rejected investment campaign
  const handleDeleteRejectedCampaign = async (campaignId) => {
    if (!campaignId) return;
    const ok = window.confirm('Permanently delete this rejected campaign? This cannot be undone.');
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}?hard=true`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('Rejected campaign deleted.', 'success');
        await fetchDatabaseData();
      } else {
        showToast(data.error || 'Failed to delete campaign.', 'error');
      }
    } catch (err) {
      showToast('Error deleting campaign.', 'error');
    }
  };

  // S3: placeholder until AdminDashboard rejection-reason UI exists
  const formatRejectionReason = (item) => {
    const reason = item?.rejectionReason || item?.rejection_reason || '';
    if (String(reason).trim()) return String(reason).trim();
    return 'No rejection reason was provided.';
  };

  // S3: exit plan stubs (shown on campaign pages only, not Milestones)
  const handleExitPlanStub = (action, { relief = false } = {}) => {
    if (relief) {
      showToast(
        `${action}: relief exit is Stop + refund/proof only (no bidding). Full flow coming later.`,
        'info'
      );
      return;
    }
    showToast(
      `${action} is a planned multi-step exit (refund proof, investor confirmation, or highest-bid transfer). Not in current SRS — coming later.`,
      'info'
    );
  };

  // S3: open post-approval edit request form
  const openEditRequestModal = (type, item) => {
    if (!item) return;
    const pending = editRequests.find(
      (r) => r.status === 'pending' && r.target_type === type && r.target_id === (item.id || item._id)
    );
    if (pending) {
      showToast('An edit request is already pending (admin review: at most 2 working days).', 'info');
      return;
    }
    setEditRequestTarget({ type, item });
    setEditRequestReason('');
    if (type === 'investment') {
      setEditRequestForm({
        title: item.title || '',
        tagline: item.tagline || '',
        description: item.description || '',
        goal: item.goal || 0,
        equityOffer: item.equity_offer || item.equityOffer || '',
        category: item.category || '',
        stage: item.stage || '',
        university: item.university || ''
      });
    } else {
      setEditRequestForm({
        title: item.title || '',
        cause: item.cause || '',
        beneficiary: item.beneficiary || '',
        goal: item.goal || 0,
        description: item.description || '',
        university: item.university || ''
      });
    }
    setShowEditRequestModal(true);
  };

  const handleSubmitEditRequest = async (e) => {
    if (e) e.preventDefault();
    if (!editRequestTarget?.item) return;
    if (!editRequestReason.trim()) {
      showToast('Please explain why you need to edit.', 'error');
      return;
    }
    const userId = currentUser?.id || currentUser?._id || user.id;
    const targetId = editRequestTarget.item.id || editRequestTarget.item._id;
    const url =
      editRequestTarget.type === 'relief'
        ? `${API_BASE_URL}/api/relief-drives/${targetId}/edit-requests`
        : `${API_BASE_URL}/api/campaigns/${targetId}/edit-requests`;
    setSubmittingEditRequest(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          founderId: userId,
          reason: editRequestReason.trim(),
          proposedChanges: editRequestForm
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Failed to submit edit request.', 'error');
        return;
      }
      recordFounderAudit({
        category: editRequestTarget.type === 'relief' ? 'RELIEF' : 'CAMPAIGN',
        title: `Requested post-approval edit on “${editRequestTarget.item.title || targetId}”`,
        status: 'PENDING'
      });
      showToast(data.message || 'Edit request submitted (at most 2 working days).', 'success');
      setShowEditRequestModal(false);
      setEditRequestTarget(null);
      await fetchDatabaseData();
    } catch {
      showToast('Error submitting edit request.', 'error');
    } finally {
      setSubmittingEditRequest(false);
    }
  };

  const pendingEditFor = (type, id) =>
    editRequests.find((r) => r.status === 'pending' && r.target_type === type && r.target_id === id);

  // S3: milestone status helpers — done only with proof; missed auto after target window
  const hasMilestoneProof = (m) => Array.isArray(m?.proofs) && m.proofs.length > 0;

  const isPastMilestoneDeadline = (m, campaign) => {
    const target = String(m?.target || m?.targetDate || '').trim();
    if (!target) return false;
    const isoTry = Date.parse(target);
    if (!Number.isNaN(isoTry) && /\d{4}/.test(target)) {
      return Date.now() > isoTry;
    }
    const monthMatch = target.match(/month\s*(\d+)/i);
    if (!monthMatch) return false;
    const months = Number(monthMatch[1]);
    if (!Number.isFinite(months) || months <= 0) return false;
    const startRaw = campaign?.submitted_at || campaign?.created_at || campaign?.createdAt;
    const start = Date.parse(startRaw || '');
    if (!start) return false;
    const deadline = new Date(start);
    deadline.setMonth(deadline.getMonth() + months);
    return Date.now() > deadline.getTime();
  };

  const getMilestoneBucket = (m, campaign = activeCampaign) => {
    const st = String(m?.status || 'pending').toLowerCase();
    const proofs = hasMilestoneProof(m);
    // S3: never show Done without proof files
    if ((st === 'done' || st === 'completed') && proofs) return 'done';
    if (st === 'missed' || st === 'failed') return 'missed';
    if (!proofs && isPastMilestoneDeadline(m, campaign)) return 'missed';
    return 'pending';
  };

  // S3: if this live campaign belongs to the logged-in founder, show their real profile name
  const watchFounderName = (c) => {
    const uid = currentUser?.id || currentUser?._id || user.id;
    const fid = c?.founder_id || c?.founderId || c?.founder?.id || c?.founder?._id;
    if (uid && fid && String(fid) === String(uid)) {
      return profileUser.name || c?.founder?.name || 'You';
    }
    return c?.founder?.name || 'Student founder';
  };

  // S3: Campaigns to Watch → real detail page (live campaign records)
  const openWatchDetail = async (c) => {
    if (!c) return;
    setWatchDetail(c);
    setWatchDetailUpdates([]);
    const id = c.id || c._id;
    if (!id) return;
    try {
      const qs = new URLSearchParams({ viewer: 'public' });
      const res = await fetch(`${API_BASE_URL}/api/campaigns/${encodeURIComponent(id)}/updates?${qs}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => []);
      setWatchDetailUpdates(Array.isArray(data) ? data : []);
    } catch {
      setWatchDetailUpdates([]);
    }
  };

  const persistActiveMilestones = async (nextMilestones, successMsg, { quiet = false } = {}) => {
    const camp = activeCampaign;
    const campId = camp?.id || camp?._id;
    if (!campId) {
      if (!quiet) showToast('No campaign selected.', 'error');
      return false;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/campaigns/${campId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestonesOnly: true, // S3: do not restart approval for milestone adjust
          milestones: nextMilestones.map((m, idx) => ({
            title: m.title || m.name || `Milestone ${idx + 1}`,
            target: m.target || m.targetDate || 'TBD',
            status: m.status || (idx === 0 ? 'pending' : 'locked'),
            proofs: Array.isArray(m.proofs) ? m.proofs : []
          }))
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!quiet) showToast(data.error || 'Failed to update milestones.', 'error');
        return false;
      }
      if (!quiet) showToast(successMsg || 'Milestones updated.', 'success');
      await fetchDatabaseData();
      return true;
    } catch {
      if (!quiet) showToast('Error updating milestones.', 'error');
      return false;
    }
  };

  // S3: redo only for missed milestones
  const handleRedoMilestone = async (idx) => {
    if (!activeCampaign?.milestones?.[idx]) return;
    const bucket = getMilestoneBucket(activeCampaign.milestones[idx]);
    if (bucket !== 'missed') {
      showToast('Only missed milestones can be redone.', 'error');
      return;
    }
    const next = activeCampaign.milestones.map((m, i) => (i === idx ? { ...m, status: 'pending' } : m));
    await persistActiveMilestones(
      next,
      'Redo requested. It may take some time to update because admin approval is required.'
    );
  };

  const handleSaveMilestoneEdits = async (idx) => {
    if (!activeCampaign?.milestones?.[idx]) return;
    if (getMilestoneBucket(activeCampaign.milestones[idx]) === 'done') {
      showToast('Completed milestones cannot be edited.', 'error');
      return;
    }
    if (!milestoneEditTitle.trim()) {
      showToast('Milestone title is required.', 'error');
      return;
    }
    const next = activeCampaign.milestones.map((m, i) =>
      i === idx
        ? { ...m, title: milestoneEditTitle.trim(), name: milestoneEditTitle.trim(), target: milestoneEditTarget.trim() || m.target || m.targetDate || 'TBD' }
        : m
    );
    const ok = await persistActiveMilestones(
      next,
      'Edits saved. It may take some time to update because admin approval is required.'
    );
    if (ok) setSelectedMilestoneIdx(idx);
  };

  // S3: add a new pending milestone
  const handleAddMilestone = async () => {
    if (!activeCampaign) {
      showToast('Select a campaign first.', 'error');
      return;
    }
    const existing = Array.isArray(activeCampaign.milestones) ? activeCampaign.milestones : [];
    const n = existing.length + 1;
    const next = [
      ...existing,
      {
        title: `New milestone ${n}`,
        name: `New milestone ${n}`,
        target: `Month ${n}`,
        status: 'pending',
        proofs: []
      }
    ];
    const ok = await persistActiveMilestones(
      next,
      'Milestone added. It may take some time to update because admin approval is required.'
    );
    if (ok) {
      setSelectedMilestoneIdx(next.length - 1);
      setMilestoneEditTitle(`New milestone ${n}`);
      setMilestoneEditTarget(`Month ${n}`);
    }
  };

  // S3: delete milestone — not done, not last remaining
  const handleDeleteMilestone = async (idx) => {
    if (!activeCampaign?.milestones?.[idx]) return;
    const list = activeCampaign.milestones;
    if (list.length <= 1) {
      showToast('You must keep at least one milestone.', 'error');
      return;
    }
    if (getMilestoneBucket(list[idx]) === 'done') {
      showToast('Completed milestones cannot be deleted.', 'error');
      return;
    }
    const label = list[idx].title || list[idx].name || `Milestone #${idx + 1}`;
    const okConfirm = window.confirm(`Delete “${label}”? This cannot be undone.`);
    if (!okConfirm) return;
    const next = list.filter((_, i) => i !== idx);
    const ok = await persistActiveMilestones(
      next,
      'Milestone deleted. It may take some time to update because admin approval is required.'
    );
    if (ok) {
      setSelectedMilestoneIdx(null);
      setMilestoneEditTitle('');
      setMilestoneEditTarget('');
    }
  };

  // S3: fix false "done" without proof; auto-set missed after target window
  useEffect(() => {
    if (!activeCampaign?.milestones?.length) return;
    const campId = activeCampaign.id || activeCampaign._id;
    if (!campId) return;
    let changed = false;
    const next = activeCampaign.milestones.map((m) => {
      const st = String(m.status || '').toLowerCase();
      const proofs = hasMilestoneProof(m);
      if ((st === 'done' || st === 'completed') && !proofs) {
        changed = true;
        return { ...m, status: 'pending' };
      }
      if (proofs || st === 'missed' || st === 'failed' || st === 'done' || st === 'completed') return m;
      if (isPastMilestoneDeadline(m, activeCampaign)) {
        changed = true;
        return { ...m, status: 'missed' };
      }
      return m;
    });
    if (!changed) return;
    persistActiveMilestones(next, '', { quiet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaign?.id || activeCampaign?._id, activeCampaign?.milestones?.length]);

  const handleUploadVettingDocs = async () => {
    const userId = currentUser?.id || currentUser?._id || user.id;
    if (!idCardFile && !nidFile) {
      showToast('Choose a Student ID or NID file first.', 'error');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('userId', userId);
      if (idCardFile) formData.append('studentIdCardImage', idCardFile);
      if (nidFile) formData.append('nidCardImage', nidFile);
      const res = await fetch(`${API_BASE_URL}/api/users/profile/documents`, { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Upload failed.', 'error');
        return;
      }
      applyFounderProfile(data.user || {});
      persistFounderSession(data.user || {});
      setIdCardFile(null);
      setNidFile(null);
      showToast('ID documents uploaded for admin vetting.', 'success');
      recordFounderAudit({ category: 'VETTING', title: 'Uploaded Student ID / NID for admin vetting', status: 'PENDING' });
    } catch (err) {
      showToast('Error uploading documents.', 'error');
    }
  };

  const openReliefCreateForm = () => {
    setEditingReliefId(null);
    setReliefForm({ ...emptyReliefForm(), university: profileUser.university || '' });
    setShowReliefCreateForm(true);
  };

  const handleOpenEditRelief = (d) => {
    if (!d) return;
    // S3: pending edit, or reapply from rejected/cancelled
    if (!['pending', 'rejected', 'cancelled'].includes(d.status)) {
      showToast('Only pending, rejected, or cancelled relief campaigns can be edited or reapplied.', 'error');
      return;
    }
    setEditingReliefId(d.id);
    const links = Array.isArray(d.proofLinks) && d.proofLinks.length > 0
      ? d.proofLinks.map((p) => ({ type: p.type || 'Other link', url: p.url || '' }))
      : [{ type: 'Newspaper / Article', url: '' }];
    const uses = Array.isArray(d.useOfFunds) ? d.useOfFunds : [];
    setReliefForm({
      title: d.title || '',
      university: d.university || profileUser.university || '',
      cause: d.cause || 'Student Medical Aid',
      beneficiary: d.beneficiary || '',
      goal: d.goal || 100000,
      description: d.description || '',
      use1: uses[0] || '',
      use2: uses[1] || '',
      use3: uses[2] || '',
      proofLinks: links,
      successorName: d.successorName || d.successor_name || '',
      successorEmail: d.successorEmail || d.successor_email || ''
    });
    setShowReliefCreateForm(true);
    setReliefPageMode('mine');
  };

  const handleSaveReliefDrive = async (e) => {
    if (e) e.preventDefault();
    const userId = currentUser?.id || currentUser?._id || user.id;
    if (!reliefForm.title.trim() || !reliefForm.beneficiary.trim()) {
      showToast('Cause name and who will be helped are required.', 'error');
      return;
    }
    const proofLinks = (reliefForm.proofLinks || [])
      .map((p) => ({ type: (p.type || 'Other link').trim(), url: (p.url || '').trim() }))
      .filter((p) => p.url);
    const badUrl = proofLinks.find((p) => !/^https?:\/\//i.test(p.url));
    if (badUrl) {
      showToast('Proof links must start with http:// or https:// (no file uploads).', 'error');
      return;
    }

    if (editingReliefId) {
      const ok = window.confirm(
        'Editing this relief campaign will restart admin approval from day zero. Approval takes at most 3 days. Continue?'
      );
      if (!ok) return;
    }

    const body = {
      founderId: userId,
      title: reliefForm.title.trim(),
      university: reliefForm.university || profileUser.university,
      cause: reliefForm.cause,
      beneficiary: reliefForm.beneficiary.trim(),
      goal: Number(reliefForm.goal) || 0,
      description: reliefForm.description.trim(),
      useOfFunds: [reliefForm.use1, reliefForm.use2, reliefForm.use3].map(s => s.trim()).filter(Boolean),
      proofLinks,
      // S3
      successorName: (reliefForm.successorName || '').trim(),
      successorEmail: (reliefForm.successorEmail || '').trim()
    };

    try {
      const res = editingReliefId
        ? await fetch(`${API_BASE_URL}/api/relief-drives/${editingReliefId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
        : await fetch(`${API_BASE_URL}/api/relief-drives`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
      if (res.ok) {
        showToast(
          editingReliefId
            ? 'Relief campaign updated. Admin approval restarted (at most 3 days from now).'
            : 'Relief campaign submitted for admin approval (at most 3 days).',
          'success'
        );
        recordFounderAudit({
          category: 'RELIEF',
          title: editingReliefId
            ? `Updated relief campaign “${reliefForm.title}”`
            : `Submitted relief campaign “${reliefForm.title}” for admin review`,
          status: 'PENDING'
        });
        setReliefForm({ ...emptyReliefForm(), university: profileUser.university || '' });
        setEditingReliefId(null);
        setShowReliefCreateForm(false);
        setReliefPageMode('mine');
        await fetchDatabaseData();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to save relief campaign.', 'error');
      }
    } catch (err) {
      showToast('Error saving relief campaign.', 'error');
    }
  };

  const handleCancelReliefDrive = async (driveId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/relief-drives/${driveId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Relief campaign cancelled.', 'success');
        await fetchDatabaseData();
      }
    } catch (err) {
      showToast('Error cancelling relief campaign.', 'error');
    }
  };

  // S3: hard-delete rejected relief campaign
  const handleDeleteRejectedRelief = async (driveId) => {
    if (!driveId) return;
    const ok = window.confirm('Permanently delete this rejected relief campaign? This cannot be undone.');
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/relief-drives/${driveId}?hard=true`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('Rejected relief campaign deleted.', 'success');
        await fetchDatabaseData();
      } else {
        showToast(data.error || 'Failed to delete relief campaign.', 'error');
      }
    } catch (err) {
      showToast('Error deleting relief campaign.', 'error');
    }
  };

  // Save Profile Info (FR-3)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const userId = currentUser?.id || currentUser?._id || user.id;
    if (!userId) {
      showToast('Cannot save profile: missing user id.', 'error');
      return;
    }
    if (!profileUser.name?.trim() || !profileUser.email?.trim() || !profileUser.university?.trim() || !profileUser.studentId?.trim() || !profileUser.mfsNumber?.trim()) {
      showToast('Name, email, university, student ID, and mobile number are required.', 'error');
      return;
    }
    if (!profileUser.email.includes('@')) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: profileUser.name.trim(),
          email: profileUser.email.trim(),
          university: profileUser.university.trim(),
          department: profileUser.department.trim(),
          studentId: profileUser.studentId.trim(),
          mfsNumber: profileUser.mfsNumber.trim(),
          bio: (profileUser.bio || '').trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'Failed to save profile.', 'error');
        return;
      }
      const saved = data.user || profileUser;
      applyFounderProfile(saved);
      persistFounderSession(saved);
      showToast('Profile information updated successfully!', 'success');
      recordFounderAudit({ category: 'PROFILE', title: 'Updated profile biodata', status: 'RECORDED' });
    } catch (err) {
      showToast('Error saving profile.', 'error');
    }
  };

  // AI Copy Generator
  const handleGenerateAiCopy = () => {
    if (!aiPrompt) {
      showToast('Please enter a milestone prompt for AI copy generation.', 'info');
      return;
    }
    setIsGeneratingAi(true);
    setTimeout(() => {
      setRefinedPitch(
        `"${campaignForm.title || 'Startup'} leverages innovative tech developed at ${campaignForm.university} to transform its sector. Target objectives: ${aiPrompt}"`
      );
      setIsGeneratingAi(false);
      showToast('AI copy generated via Gemini 1.5 Pro!', 'success');
    }, 1200);
  };

  // Submit Payout Request
  const handleRequestPayout = async (e) => {
    e.preventDefault();
    if (!payoutAmount || Number(payoutAmount) <= 0) return;
    const userId = currentUser?.id || currentUser?._id || user.id;

    try {
      const res = await fetch(`${API_BASE_URL}/api/payouts/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          founderId: userId,
          amount: Number(payoutAmount),
          method: payoutMethod,
          accountNumber: profileUser.mfsNumber || '01711223344',
          tranche: 'Milestone Escrow Disbursement'
        })
      });

      if (res.ok) {
        setShowPayoutModal(false);
        showToast(`Payout request of ৳ ${Number(payoutAmount).toLocaleString()} submitted to database!`, 'success');
        recordFounderAudit({
          category: 'PAYOUT',
          title: `Requested payout ৳ ${Number(payoutAmount).toLocaleString()} via ${payoutMethod}`,
          status: 'PENDING'
        });
        setPayoutAmount('');
        fetchDatabaseData();
      }
    } catch (err) {
      showToast('Error submitting payout request.', 'error');
    }
  };

  // Publish Progress Announcement (FR-8)
  const handlePublishAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) {
      showToast('Please fill out the announcement title and narrative content.', 'error');
      return;
    }

    const campId = announcementCampaignId || (campaigns[0] && (campaigns[0].id || campaigns[0]._id));
    const userId = currentUser?.id || currentUser?._id || user.id;
    if (!campId) {
      showToast('Create a campaign before publishing a progress update.', 'error');
      return;
    }
    if (!userId) {
      showToast('Cannot publish: missing founder id.', 'error');
      return;
    }

    const owned = campaigns.some((c) => (c.id || c._id) === campId);
    if (!owned) {
      showToast('Select one of your own campaigns.', 'error');
      return;
    }

    try {
      setPublishingUpdate(true);
      const res = await fetch(`${API_BASE_URL}/api/campaigns/${encodeURIComponent(campId)}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          founderId: userId,
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
          milestoneTag: announcementTag
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const camp = campaigns.find((c) => (c.id || c._id) === campId);
        recordFounderAudit({
          category: 'PROGRESS',
          title: `Posted progress update “${announcementTitle.trim()}”`,
          status: 'PENDING'
        });
        const saved = {
          ...data,
          campaign_id: data.campaign_id || campId,
          campaignTitle: camp?.title || 'Campaign'
        };
        setProgressUpdates((prev) => [saved, ...prev.filter((u) => u.id !== saved.id)]);
        setTimelineCampaignId(campId);
        setShowAnnouncementModal(false);
        setAnnouncementTitle('');
        setAnnouncementContent('');
        showToast('Progress update submitted for admin approval.', 'success');
        await loadProgressUpdates(campaigns);
      } else {
        showToast(data.error || 'Failed to publish announcement update.', 'error');
      }
    } catch (err) {
      showToast('Error publishing progress announcement.', 'error');
    } finally {
      setPublishingUpdate(false);
    }
  };

  // Initials Avatar Component
  const InitialsAvatar = ({ name, className = 'w-10 h-10' }) => {
    const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'FB';
    return (
      <div className={`${className} rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shrink-0`}>
        {initials}
      </div>
    );
  };

  // Filtered list of all campaigns for Explore tab
  const filteredAllCampaigns = allCampaigns.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = q === '' ||
      c.title?.toLowerCase().includes(q) ||
      c.university?.toLowerCase().includes(q) ||
      (c.founder?.name || '').toLowerCase().includes(q) ||
      (c.tagline || '').toLowerCase().includes(q);
    const cat = (c.category || '').toLowerCase();
    const sel = exploreCategory.toLowerCase();
    const matchesCategory = sel === 'all' ||
      cat === sel ||
      cat.includes(sel) ||
      (sel === 'f&b' && (cat.includes('food') || cat.includes('saas'))) ||
      (sel === 'cleantech' && cat.includes('clean'));
    return matchesSearch && matchesCategory;
  });
  // S3: Campaigns to Watch marketplace pulse (live list currently shown — not Overview personal escrow)
  const watchMarketWanted = filteredAllCampaigns.reduce((s, c) => s + (Number(c.goal) || 0), 0);
  const watchMarketInvested = filteredAllCampaigns.reduce((s, c) => s + (Number(c.raised) || 0), 0);
  const watchMarketPct = watchMarketWanted > 0
    ? Math.min(100, Math.round((watchMarketInvested / watchMarketWanted) * 100))
    : 0;

  const searchNeedle = searchQuery.trim().toLowerCase();
  const matchesSearchNeedle = (...vals) =>
    !searchNeedle || vals.some((v) => String(v || '').toLowerCase().includes(searchNeedle));
  const filteredPublicRelief = publicReliefCampaigns.filter((d) =>
    matchesSearchNeedle(d.title, d.university, d.cause, d.beneficiary, d.description)
  );
  const filteredMyRelief = reliefDrives.filter((d) =>
    matchesSearchNeedle(d.title, d.university, d.cause, d.beneficiary, d.description, d.status)
  );
  const filteredProposals = proposals.filter((p) =>
    matchesSearchNeedle(p.investor_name, p.return_structure, p.terms, p.status, p.amount, p.campaign_title)
  );
  const directoryInvestors = investorsList.filter((inv) =>
    matchesSearchNeedle(inv.name, inv.institution, inv.university, inv.email, inv.bio)
  );
  const investorTabProposals = filteredProposals.filter((p) => {
    const st = String(p.status || 'pending').toLowerCase();
    if (investorPropFilter === 'pending') return st === 'pending';
    if (investorPropFilter === 'accepted') return st === 'accepted';
    if (investorPropFilter === 'declined') return st === 'declined' || st === 'rejected';
    return true;
  });
  const pendingProposalCount = proposals.filter((p) => String(p.status || 'pending').toLowerCase() === 'pending').length;
  const acceptedProposalCount = proposals.filter((p) => String(p.status || '').toLowerCase() === 'accepted').length;
  const acceptedProposalRaised = proposals
    .filter((p) => String(p.status || '').toLowerCase() === 'accepted')
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const filteredAuditLogs = auditLogs.filter((log) =>
    matchesSearchNeedle(log.category, log.title, log.status, log.hash, log.created_at)
  );
  // S3: Overview header search
  const overviewCampaigns = campaigns.filter((c) =>
    matchesSearchNeedle(c.title, c.university, c.category, c.status, c.tagline)
  );
  const overviewTimelineUpdates = visibleProgressUpdates.filter((u) =>
    matchesSearchNeedle(u.title, u.content, u.milestone_tag, u.milestoneTag, u.campaignTitle)
  );
  // S3: Overview backers = accepted proposals on this founder’s campaigns (not the platform directory)
  const overviewBackers = (() => {
    const seen = new Set();
    const list = [];
    approvedProposals
      .filter((p) => String(p.status || '').toLowerCase() === 'accepted')
      .forEach((p) => {
        const id = String(p.investor_id || p.investorId || p.investor_name || p.investorName || '');
        if (!id || seen.has(id)) return;
        seen.add(id);
        const match = investorsList.find(
          (i) =>
            String(i.id || i._id) === String(p.investor_id || p.investorId) ||
            (i.name && p.investor_name && i.name === p.investor_name)
        );
        const camp = approvedCampaigns.find((c) => (c.id || c._id) === (p.campaign_id || p.campaignId));
        list.push({
          id,
          name: (match && (match.name || match.institution)) || p.investor_name || p.investorName || 'Investor',
          amount: Number(p.amount || 0),
          campaignTitle: camp?.title || p.campaign_id || '',
          proposal: p
        });
      });
    return list;
  })();
  const filteredOverviewBackers = overviewBackers.filter((i) =>
    matchesSearchNeedle(i.name, i.campaignTitle, i.amount)
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex antialiased">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'
          }`}>
          <Info className="w-4 h-4" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col justify-between p-5 shrink-0 select-none">
        <div className="space-y-8">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5 px-2">
            <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">FundBridge</h1>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'overview'
                  ? 'bg-[#DCFCE7] text-[#15803D] font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
            >
              <LayoutGrid className="w-4.5 h-4.5" />
              <span>Overview</span>
            </button>



            <button
              onClick={() => {
                setCampaignsPageMode('watch');
                setWatchDetail(null); // S3
                setActiveTab('explore');
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'explore'
                  ? 'bg-[#DCFCE7] text-[#15803D] font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
            >
              <Compass className="w-4.5 h-4.5" />
              <span>Campaigns</span>
            </button>

            <button
              onClick={() => {
                setReliefForm(prev => ({ ...prev, university: profileUser.university || prev.university }));
                setReliefPageMode('watch');
                setShowReliefCreateForm(false);
                setActiveTab('relief');
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'relief'
                  ? 'bg-[#DCFCE7] text-[#15803D] font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
            >
              <Heart className="w-4.5 h-4.5" />
              <span>Relief Campaigns</span>
            </button>

            <button
              onClick={() => setActiveTab('investors')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'investors'
                  ? 'bg-[#DCFCE7] text-[#15803D] font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
            >
              <Users className="w-4.5 h-4.5" />
              <span>Investors</span>
            </button>

            <button
              onClick={() => setActiveTab('milestones')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'milestones'
                  ? 'bg-[#DCFCE7] text-[#15803D] font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
            >
              <Flag className="w-4.5 h-4.5" />
              <span>Milestones</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'audit'
                  ? 'bg-[#DCFCE7] text-[#15803D] font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
            >
              <FileText className="w-4.5 h-4.5" />
              <span>Audit Logs</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Actions */}
        <div className="space-y-1 pt-6 border-t border-slate-200">
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-slate-200 text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg">
            <HelpCircle className="w-4 h-4" />
            <span>Support</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* TOP HEADER BAR */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
          {/* Search Input */}
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                activeTab === 'explore' ? 'Search all campaigns...' :
                  activeTab === 'investors' ? 'Search investors...' :
                    activeTab === 'relief' ? 'Search relief campaigns...' :
                      activeTab === 'milestones' ? 'Search milestones...' :
                        activeTab === 'audit' ? 'Search hash or log...' :
                          'Search my campaigns & updates...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100/80 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Right User Bar */}
          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <Bell className="w-4.5 h-4.5" />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white animate-pulse"></span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 top-11 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-fadeIn text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h4 className="text-xs font-bold text-slate-900">System Notifications</h4>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {notifications.filter(n => !n.is_read).length} Unread
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 text-xs">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div 
                          key={n.id || n._id}
                          onClick={async () => {
                            try {
                              await fetch(`${API_BASE_URL}/api/notifications/${n.id || n._id}/read`, { method: 'PUT' });
                              setNotifications(prev => prev.map(x => (x.id === n.id || x._id === n._id ? { ...x, is_read: true } : x)));
                            } catch(e){}
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            !n.is_read ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-100 opacity-75'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-slate-900 text-[11px] block">{n.title}</span>
                            <span className="text-[9px] text-slate-400 font-mono whitespace-nowrap">
                              {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-tight mt-1">{n.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="py-6 text-center text-xs text-slate-400">No notifications yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-slate-200 my-auto"></div>

            {/* Founder Profile Badge - Clicking opens Settings */}
            <div
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 px-2.5 py-1.5 rounded-xl transition-colors"
              title="Click to edit profile settings"
            >
              <InitialsAvatar name={profileUser.name} className="w-8 h-8" />
              <div className="hidden sm:block text-left">
                <span className="text-xs font-bold text-slate-900 block leading-tight">{profileUser.name}</span>
                <span className="text-[10px] text-slate-500 block leading-tight">{profileUser.university || 'Founder'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Pending Vetting Status Banner */}
        {(profileUser.vettingStatus === 'pending' || profileUser.vetting_status === 'pending') && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 px-8 py-2.5 flex items-center justify-between text-xs font-medium sticky top-16 z-15">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span><strong>Identity Vetting Pending:</strong> Your student founder profile is awaiting Super Admin verification. Campaign launching is restricted until approved.</span>
            </div>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase">PENDING VETTING</span>
          </div>
        )}

        {/* TAB PAGE CONTENT CONTAINER */}
        <main className="flex-1 p-8 space-y-8 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-500 font-medium">Loading workspace records from database...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW SCREEN */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">My Workspace</h1>
                  </div>

                  {/* S3: Overview detail panels from metric cards */}
                  {overviewDetail === 'escrow' && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">Funding raised breakdown</h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Approved investment campaigns + approved relief campaigns. Combined raised: ৳ {totalCombinedRaised.toLocaleString()}
                          </p>
                        </div>
                        <button type="button" onClick={() => setOverviewDetail(null)} className="px-3 py-1.5 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer">
                          ← Back to Overview
                        </button>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-800">Investment campaigns</h3>
                        {approvedCampaigns.length > 0 ? approvedCampaigns.map((c) => (
                          <div key={c.id || c._id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap justify-between gap-2 text-xs">
                            <div>
                              <p className="font-bold text-slate-900">{c.title}</p>
                              <p className="text-slate-500">{c.status || (c.verified ? 'verified' : 'live')}</p>
                            </div>
                            <div className="font-mono text-right">
                              <p className="text-emerald-700 font-bold">Raised ৳ {Number(c.raised || 0).toLocaleString()}</p>
                              <p className="text-slate-500">Goal ৳ {Number(c.goal || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        )) : (
                          <p className="text-xs text-slate-500">No approved investment campaigns yet.</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-800">Relief campaigns</h3>
                        {approvedReliefCampaigns.length > 0 ? approvedReliefCampaigns.map((d) => (
                          <div key={d.id} className="p-4 bg-rose-50/40 border border-rose-100 rounded-xl flex flex-wrap justify-between gap-2 text-xs">
                            <div>
                              <p className="font-bold text-slate-900">{d.title}</p>
                              <p className="text-slate-500">{d.cause} · {d.status}</p>
                            </div>
                            <div className="font-mono text-right">
                              <p className="text-emerald-700 font-bold">Raised ৳ {Number(d.raised || 0).toLocaleString()}</p>
                              <p className="text-slate-500">Goal ৳ {Number(d.goal || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        )) : (
                          <p className="text-xs text-slate-500">No approved relief campaigns yet.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {overviewDetail === 'deposit' && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">Security deposit</h2>
                          <p className="text-xs text-slate-500 mt-0.5">Good-faith bond held by the platform</p>
                        </div>
                        <button type="button" onClick={() => setOverviewDetail(null)} className="px-3 py-1.5 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer">
                          ← Back to Overview
                        </button>
                      </div>
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-950 space-y-2">
                        <p className="font-semibold">What is this?</p>
                        <p>
                          A security deposit is money you put up as a <strong>good-faith bond</strong>. It shows commitment and can be held until milestones are verified.
                          It is usually refundable when milestones complete successfully. Amounts below are recorded on your founder ledger (payment gateway is not connected).
                        </p>
                        <p className="font-mono text-sm font-bold">Currently held: ৳ {Number(securityDepositHeld || 0).toLocaleString()}</p>
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-slate-700 block">Amount to add (BDT)</label>
                        <input
                          type="number"
                          value={depositAddAmount}
                          onChange={(e) => setDepositAddAmount(e.target.value)}
                          placeholder="e.g. 10000"
                          className="w-full max-w-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => handleDepositAdd('bKash')} className="px-3 py-2 bg-pink-50 text-pink-800 text-xs font-semibold rounded-lg cursor-pointer">Add via bKash</button>
                          <button type="button" onClick={() => handleDepositAdd('Nagad')} className="px-3 py-2 bg-orange-50 text-orange-800 text-xs font-semibold rounded-lg cursor-pointer">Add via Nagad</button>
                          <button type="button" onClick={() => handleDepositAdd('Bank transfer')} className="px-3 py-2 bg-sky-50 text-sky-800 text-xs font-semibold rounded-lg cursor-pointer">Add via bank</button>
                        </div>
                        {securityDepositLedger.length > 0 && (
                          <ul className="text-[11px] text-slate-600 space-y-1 pt-2">
                            {securityDepositLedger.slice(0, 5).map((row) => (
                              <li key={row.id} className="font-mono">
                                ৳ {Number(row.amount || 0).toLocaleString()} · {row.method} · {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  {overviewDetail === 'proposals' && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900">Investors who proposed</h2>
                          <p className="text-xs text-slate-500 mt-0.5">Incoming term sheets on your approved campaigns</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setOverviewDetail(null); setActiveTab('investors'); }}
                            className="px-3 py-1.5 bg-sky-100 text-sky-800 text-xs font-semibold rounded-lg cursor-pointer"
                          >
                            Open Investors tab
                          </button>
                          <button type="button" onClick={() => setOverviewDetail(null)} className="px-3 py-1.5 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer">
                            ← Back to Overview
                          </button>
                        </div>
                      </div>
                      {approvedProposals.length > 0 ? (
                        <div className="space-y-3">
                          {approvedProposals.map((p, idx) => {
                            const camp = approvedCampaigns.find((c) => (c.id || c._id) === (p.campaign_id || p.campaignId));
                            return (
                              <div
                                key={p.id || p._id || idx}
                                className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 cursor-pointer hover:border-sky-300"
                                onClick={() => {
                                  setSelectedProposal(p);
                                  setOverviewDetail(null);
                                  setActiveTab('investors');
                                }}
                              >
                                <div className="flex justify-between gap-2">
                                  <p className="font-bold text-slate-900">{p.investor_name || p.investorName || 'Investor'}</p>
                                  <span className="font-mono font-bold text-emerald-700">৳ {Number(p.amount || 0).toLocaleString()}</span>
                                </div>
                                <p className="text-slate-500">{p.return_structure || p.terms || 'Term sheet'} · {p.status || 'pending'}</p>
                                <p className="text-slate-400">Campaign: {camp?.title || p.campaign_id || p.campaignId || '—'}</p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 py-8 text-center">No investor proposals on your approved campaigns yet.</p>
                      )}
                    </div>
                  )}

                  {!overviewDetail && (
                  <>
                  {/* 3 TOP METRIC CARDS — S3: clickable */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button
                      type="button"
                      onClick={() => setOverviewDetail('escrow')}
                      className="text-left bg-[#064E3B] rounded-2xl p-6 text-white relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[160px] cursor-pointer hover:ring-2 hover:ring-emerald-400/50 transition-all"
                    >
                      <div className="absolute right-0 bottom-0 opacity-15 pointer-events-none">
                        <svg width="180" height="120" viewBox="0 0 180 120" fill="none">
                          <path d="M40 120L110 20L180 120H40Z" stroke="white" strokeWidth="6" />
                          <path d="M0 120L70 20L140 120H0Z" stroke="white" strokeWidth="6" />
                        </svg>
                      </div>

                      <div>
                        <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-200/80 block">TOTAL FUNDING RAISED IN ESCROW</span>
                        <h3 className="text-3xl font-bold tracking-tight mt-2 font-mono">
                          ৳ {totalCombinedRaised.toLocaleString()}
                        </h3>
                      </div>

                      <div className="mt-4 pt-3 border-t border-emerald-700/50">
                        <span className="text-xs font-medium text-emerald-200 block mb-1.5">
                          {totalExpectedGoal > 0
                            ? `${escrowGoalPercent}% of BDT ${totalExpectedGoal.toLocaleString()} investment goals · click for breakdown`
                            : 'Click for investment + relief breakdown'}
                        </span>
                        <div className="w-full bg-emerald-950/60 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${escrowGoalPercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOverviewDetail('deposit')}
                      className="text-left bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-emerald-400 hover:ring-2 hover:ring-emerald-100 transition-all min-h-[160px]"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">SECURITY DEPOSIT HELD</span>
                        <Shield className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-bold tracking-tight text-slate-900 font-mono">৳ {Number(securityDepositHeld || 0).toLocaleString()}</h3>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-2">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span>Click to learn more / add deposit</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOverviewDetail('proposals')}
                      className="text-left bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-sky-400 hover:ring-2 hover:ring-sky-100 transition-all min-h-[160px]"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 block">INVESTOR PROPOSALS</span>
                        <FileText className="w-5 h-5 text-sky-600" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-bold tracking-tight text-slate-900 font-mono">{approvedProposals.length}</h3>
                      </div>
                      <div>
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-md inline-block">
                          {approvedProposals.length > 0 ? 'Click to see who proposed' : 'Awaiting proposals from investors'}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* CAMPAIGN STATUS & MILESTONES TABLE — S3: milestones from selected campaign */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Campaign Status & Milestones</h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Shows milestones you set for the selected campaign (not hardcoded defaults).
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {manageableCampaigns.length > 0 && (
                          <select
                            value={(activeCampaign && (activeCampaign.id || activeCampaign._id)) || ''}
                            onChange={(e) => setTimelineCampaignId(e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium"
                          >
                            {manageableCampaigns.map((c) => (
                              <option key={c.id || c._id} value={c.id || c._id}>
                                {c.title} ({(c.verified || c.status === 'verified') ? 'Live' : (c.status || 'pending')})
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => {
                            // S3: Manage Campaign → My Campaigns list (not the edit wizard)
                            setCampaignsPageMode('mine');
                            setActiveTab('explore');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          Manage Campaign
                        </button>
                      </div>
                    </div>

                    {activeCampaign && activeCampaign.milestones && activeCampaign.milestones.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                              <th className="pb-3 font-semibold">MILESTONE NAME</th>
                              <th className="pb-3 font-semibold">TARGET DATE</th>
                              <th className="pb-3 font-semibold">STATUS</th>
                              <th className="pb-3 font-semibold">ACTION</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeCampaign.milestones.map((m, idx) => {
                              const bucket = getMilestoneBucket(m, activeCampaign);
                              return (
                              <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-4 font-semibold text-slate-900 flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${
                                    bucket === 'done' ? 'bg-emerald-500' :
                                    bucket === 'missed' ? 'bg-rose-500' : 'bg-amber-500'
                                  }`}></span>
                                  <span>{m.name || m.title || `Milestone #${idx + 1}`}</span>
                                </td>
                                <td className="py-4 text-slate-600">{m.targetDate || m.target || 'TBD'}</td>
                                <td className="py-4">
                                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase ${
                                    bucket === 'done' ? 'bg-emerald-500 text-white' :
                                    bucket === 'missed' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {bucket === 'done' ? 'Done' : bucket === 'missed' ? 'Missed' : 'Pending'}
                                  </span>
                                </td>
                                <td className="py-4">
                                  <button
                                    onClick={() => {
                                      setSelectedMilestoneIdx(idx);
                                      setActiveTab('milestones');
                                    }}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                                      bucket === 'done'
                                        ? 'text-sky-600 hover:text-sky-700 bg-transparent'
                                        : 'bg-[#047857] hover:bg-[#065f46] text-white'
                                    }`}
                                  >
                                    {bucket === 'done' ? (
                                      <>View / Update <Eye className="w-3.5 h-3.5" /></>
                                    ) : (
                                      <><Upload className="w-3.5 h-3.5" /><span>Open Milestone</span></>
                                    )}
                                  </button>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-500">No active milestones configured in database for this campaign.</p>
                      </div>
                    )}
                  </div>

                  {/* FR-8: PROGRESS TIMELINE */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Progress Timeline</h2>
                        <p className="text-xs text-slate-500">Story log of what you achieved (admin-approved posts). Different from the milestone plan table above.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {campaigns.length > 1 && (
                          <select
                            value={timelineCampaignId}
                            onChange={(e) => setTimelineCampaignId(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                          >
                            {campaigns.map((c) => {
                              const id = c.id || c._id;
                              return (
                                <option key={id} value={id}>{c.title || id}</option>
                              );
                            })}
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={openAnnouncementModal}
                          className="px-3.5 py-2 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Publish Update</span>
                        </button>
                      </div>
                    </div>

                    {overviewTimelineUpdates.length > 0 ? (
                      <ol className="relative border-l border-slate-200 ml-2 space-y-5">
                        {overviewTimelineUpdates.map((u) => (
                          <li key={u.id || `${u.campaign_id}-${u.created_at}-${u.title}`} className="ml-4">
                            <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-bold text-slate-900">{u.title}</h3>
                                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {u.created_at ? new Date(u.created_at).toLocaleString() : 'Just now'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md uppercase">
                                  {u.milestone_tag || u.milestoneTag || 'Update'}
                                </span>
                                {u.campaignTitle && (
                                  <span className="px-2 py-0.5 bg-sky-50 text-sky-700 text-[10px] font-semibold rounded-md">
                                    {u.campaignTitle}
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                                  (u.status || 'approved') === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                  u.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {(u.status || 'approved') === 'approved' ? 'Live' : (u.status || 'pending')}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 whitespace-pre-wrap">{u.content}</p>
                              {/* S3: same default as backend/public — missing status means already live */}
                              {(u.status || 'approved') === 'pending' && (
                                <p className="text-[10px] text-amber-700">Waiting for admin approval before others can view this update.</p>
                              )}
                              {u.status === 'rejected' && (
                                <p className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
                                  Reason: {formatRejectionReason(u)}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
                        <p className="text-xs text-slate-500">No progress announcements yet. Publish an update to start your campaign timeline.</p>
                        <button
                          type="button"
                          onClick={openAnnouncementModal}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Publish first update
                        </button>
                      </div>
                    )}
                  </div>

                  {/* MY CAMPAIGN SECTION IN OVERVIEW SECTION BELOW */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">My Campaigns</h2>
                        <p className="text-xs text-slate-500">Startup campaigns registered under your founder profile in database</p>
                      </div>
                      <button
                        onClick={() => {
                          setCampaignsPageMode('mine');
                          setActiveTab('explore');
                        }}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>My Campaigns</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {overviewCampaigns.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {overviewCampaigns.map((c, idx) => (
                          <div key={c.id || c._id || idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-bold text-slate-900 text-sm">{c.title}</h3>
                                <span className="text-xs text-slate-500">{c.university} • {c.category || 'Startup'}</span>
                              </div>
                              <span className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase ${
                                c.status === 'cancelled' ? 'bg-slate-200 text-slate-600' :
                                (c.verified || c.status === 'verified') ? 'bg-emerald-100 text-emerald-800' :
                                c.status === 'revisions' ? 'bg-purple-100 text-purple-800' :
                                c.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                                'bg-amber-100 text-amber-800'
                                }`}>
                                {c.status === 'cancelled' ? 'Cancelled' :
                                 (c.verified || c.status === 'verified') ? 'Verified & Live ✓' :
                                 c.status === 'revisions' ? 'Revisions Requested 📝' :
                                 c.status === 'rejected' ? 'Rejected by Admin ❌' :
                                 'Pending Admin Verification ⏳'}
                              </span>
                            </div>

                            <div className="flex justify-between text-xs font-mono pt-1">
                              <span className="text-slate-500">Raised: <strong className="text-emerald-700">৳ {Number(c.raised || 0).toLocaleString()}</strong></span>
                              <span className="text-slate-500">Goal: <strong>৳ {Number(c.goal || 0).toLocaleString()}</strong></span>
                            </div>

                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-600 h-full rounded-full"
                                style={{ width: c.goal > 0 ? `${Math.min(100, Math.round(((c.raised || 0) / c.goal) * 100))}%` : '0%' }}
                              ></div>
                            </div>

                            {c.status === 'rejected' && (
                              <p className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
                                Reason: {formatRejectionReason(c)}
                              </p>
                            )}

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80 flex-wrap">
                              {(c.status === 'pending' || c.status === 'revisions') && (
                                <button
                                  onClick={() => handleOpenEditCampaign(c)}
                                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                >
                                  Edit Details
                                </button>
                              )}
                              {c.status === 'rejected' && (
                                <button
                                  onClick={() => handleOpenEditCampaign(c)}
                                  className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                >
                                  Reapply
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  // S3: open this campaign’s milestones, not whichever was last selected
                                  setTimelineCampaignId(c.id || c._id);
                                  setActiveTab('milestones');
                                }}
                                className="px-3 py-1.5 bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                              >
                                Milestones
                              </button>
                              {c.status === 'rejected' && (
                                <button
                                  onClick={() => handleDeleteRejectedCampaign(c.id || c._id)}
                                  className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                              {/* S3: Cancel removed from list views — exit actions live under Milestones */}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-400 space-y-3">
                        <p>{campaigns.length > 0 ? 'No campaigns match your search.' : 'No campaigns registered in database under your account.'}</p>
                        <button
                          onClick={() => {
                            setCampaignsPageMode('mine');
                            setActiveTab('explore');
                          }}
                          className="px-4 py-2 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Go to My Campaigns</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* S3: backers who invested (accepted proposals) — not the platform investor directory */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">Investors in your campaigns</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          People whose term sheets you accepted. Pending proposals stay on the Investors tab.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('investors')}
                        className="text-xs text-sky-600 hover:text-sky-700 font-semibold shrink-0"
                      >
                        Investors tab
                      </button>
                    </div>

                    {filteredOverviewBackers.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                        {filteredOverviewBackers.map((inv) => (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => {
                              if (inv.proposal) setSelectedProposal(inv.proposal);
                              setOverviewDetail(null);
                              setActiveTab('investors');
                            }}
                            className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2 cursor-pointer hover:border-sky-300"
                          >
                            <div className="flex items-center gap-3">
                              <InitialsAvatar name={inv.name} className="w-10 h-10" />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-slate-800 block truncate">{inv.name}</span>
                                <span className="text-[10px] text-slate-500 block truncate">{inv.campaignTitle || 'Campaign'}</span>
                              </div>
                            </div>
                            <p className="text-xs font-mono font-bold text-emerald-700">৳ {Number(inv.amount || 0).toLocaleString()}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                        <p>{searchNeedle ? 'No backers match your search.' : 'No investors have funded your campaigns yet (accept a proposal first).'}</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('investors')}
                          className="text-sky-600 font-semibold cursor-pointer"
                        >
                          Review proposals on Investors
                        </button>
                      </div>
                    )}
                  </div>
                  </>
                  )}
                </div>
              )}

              {/* TAB 2: MY CAMPAIGN WIZARD FORM */}
              {activeTab === 'campaign' && (
                <div className="space-y-6 max-w-5xl mx-auto">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <span className="text-xs text-slate-500 font-medium">Workspace / Campaign Submission Wizard</span>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">
                        {editingCampaignId ? 'Edit Startup Campaign Details' : 'Create New Startup Campaign'}
                      </h1>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-3 py-1 bg-amber-100 text-amber-800 rounded-lg">
                        Step {wizardStep} of 5
                      </span>
                    </div>
                  </div>

                  {/* 5-STEP WIZARD PROGRESS BAR */}
                  <div className="grid grid-cols-5 gap-2 text-center text-xs font-semibold">
                    <button
                      onClick={() => setWizardStep(1)}
                      className={`p-2.5 rounded-xl border transition-all ${
                        wizardStep === 1 ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' :
                        wizardStep > 1 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      1. Venture Identity
                    </button>
                    <button
                      onClick={() => setWizardStep(2)}
                      className={`p-2.5 rounded-xl border transition-all ${
                        wizardStep === 2 ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' :
                        wizardStep > 2 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      2. Pitch & Deck
                    </button>
                    <button
                      onClick={() => setWizardStep(3)}
                      className={`p-2.5 rounded-xl border transition-all ${
                        wizardStep === 3 ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' :
                        wizardStep > 3 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      3. Financials & Terms
                    </button>
                    <button
                      onClick={() => setWizardStep(4)}
                      className={`p-2.5 rounded-xl border transition-all ${
                        wizardStep === 4 ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' :
                        wizardStep > 4 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      4. Milestones
                    </button>
                    <button
                      onClick={() => setWizardStep(5)}
                      className={`p-2.5 rounded-xl border transition-all ${
                        wizardStep === 5 ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      5. Audit Submission
                    </button>
                  </div>

                  {/* STEP CONTENT PANELS */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm space-y-6">
                    {/* STEP 1: CORE VENTURE IDENTITY */}
                    {wizardStep === 1 && (
                      <div className="space-y-5">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="font-bold text-slate-900 text-base">Step 1: Core Venture Identity</h3>
                          <p className="text-xs text-slate-500">Provide basic startup title, category, and university affiliation.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Startup Venture Name *</label>
                            <input
                              type="text"
                              required
                              value={campaignForm.title}
                              onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                              placeholder="e.g. CampusBites or EcoThread"
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">University / Institution *</label>
                            <input
                              type="text"
                              value={campaignForm.university}
                              onChange={(e) => setCampaignForm({ ...campaignForm, university: e.target.value })}
                              placeholder="e.g. BRAC University"
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Category / Sector</label>
                            <select
                              value={campaignForm.category || 'FoodTech / SaaS'}
                              onChange={(e) => setCampaignForm({ ...campaignForm, category: e.target.value })}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                            >
                              <option value="FoodTech / SaaS">FoodTech / SaaS</option>
                              <option value="EdTech / AI">EdTech / AI</option>
                              <option value="HealthTech / Biotech">HealthTech / Biotech</option>
                              <option value="CleanTech / IoT">CleanTech / IoT</option>
                              <option value="FinTech / E-Commerce">FinTech / E-Commerce</option>
                              <option value="Hardware / Robotics">Hardware / Robotics</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Venture Development Stage</label>
                            <select
                              value={campaignForm.stage || 'MVP Stage'}
                              onChange={(e) => setCampaignForm({ ...campaignForm, stage: e.target.value })}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                            >
                              <option value="Idea Phase">Idea Phase</option>
                              <option value="Prototype / MVP">Prototype / MVP</option>
                              <option value="Early Revenue">Early Revenue</option>
                              <option value="Growth & Scale">Growth & Scale</option>
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Short Mission Tagline</label>
                            <input
                              type="text"
                              value={campaignForm.tagline}
                              onChange={(e) => setCampaignForm({ ...campaignForm, tagline: e.target.value })}
                              placeholder="e.g. Smart canteen pre-meal reservation app for university campuses..."
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                            />
                          </div>
                          {/* S3: designated successor */}
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Designated successor (name)</label>
                            <input
                              type="text"
                              value={campaignForm.successorName || ''}
                              onChange={(e) => setCampaignForm({ ...campaignForm, successorName: e.target.value })}
                              placeholder="Person who can take over if you cannot continue"
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Successor email</label>
                            <input
                              type="email"
                              value={campaignForm.successorEmail || ''}
                              onChange={(e) => setCampaignForm({ ...campaignForm, successorEmail: e.target.value })}
                              placeholder="successor@univ.edu.bd"
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                            />
                          </div>
                          <p className="md:col-span-2 text-[10px] text-slate-500">Optional. Used if the lead founder is unable to continue the campaign.</p>
                        </div>

                        <div className="flex justify-end pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              if (!campaignForm.title) {
                                showToast('Please enter Startup Name before continuing.', 'error');
                                return;
                              }
                              setWizardStep(2);
                            }}
                            className="px-6 py-2.5 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            Next Step: Pitch & Deck →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: PITCH DECK & MEDIA UPLOADS */}
                    {wizardStep === 2 && (
                      <div className="space-y-5">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="font-bold text-slate-900 text-base">Step 2: Pitch Deck & Document Uploads</h3>
                          <p className="text-xs text-slate-500">Upload pitch deck documents, cover photo URL, and pitch video details.</p>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Cover Photo URL or Banner</label>
                            <input
                              type="text"
                              value={campaignForm.coverPhoto}
                              onChange={(e) => setCampaignForm({ ...campaignForm, coverPhoto: e.target.value })}
                              placeholder="https://images.unsplash.com/photo-..."
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Pitch Video URL (YouTube / Vimeo / Google Drive)</label>
                            <input
                              type="text"
                              value={campaignForm.pitchVideoUrl}
                              onChange={(e) => setCampaignForm({ ...campaignForm, pitchVideoUrl: e.target.value })}
                              placeholder="https://youtube.com/watch?v=..."
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Full Venture Pitch Description *</label>
                            <textarea
                              rows={5}
                              value={campaignForm.description}
                              onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                              placeholder="Describe the problem, market solution, customer traction, and revenue model..."
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                            ></textarea>
                          </div>

                          {/* AI Optimization Suite Assistant */}
                          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-indigo-600" /> AI Pitch Assistant (Gemini 1.5 Pro)
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="Enter milestone goal (e.g. launch mobile canteen app for 5000 students)..."
                                className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs"
                              />
                              <button
                                type="button"
                                onClick={handleGenerateAiCopy}
                                disabled={isGeneratingAi}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                              >
                                {isGeneratingAi ? 'Generating...' : 'Enhance Pitch'}
                              </button>
                            </div>
                            {refinedPitch && (
                              <div className="p-3 bg-white border border-indigo-200 rounded-lg text-xs italic text-indigo-900 space-y-2">
                                <p>"{refinedPitch}"</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCampaignForm({ ...campaignForm, description: refinedPitch.replace(/"/g, '') });
                                    showToast('Applied AI refined pitch to description!', 'success');
                                  }}
                                  className="px-3 py-1 bg-emerald-600 text-white text-[11px] font-semibold rounded-lg"
                                >
                                  Use AI Pitch Description
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between pt-4">
                          <button
                            type="button"
                            onClick={() => setWizardStep(1)}
                            className="px-5 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl"
                          >
                            ← Previous Step
                          </button>
                          <button
                            type="button"
                            onClick={() => setWizardStep(3)}
                            className="px-6 py-2.5 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            Next Step: Financials & Terms →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: FINANCIAL TARGET & EQUITY TERMS */}
                    {wizardStep === 3 && (
                      <div className="space-y-5">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="font-bold text-slate-900 text-base">Step 3: Financial Goal & Return Terms</h3>
                          <p className="text-xs text-slate-500">Define funding goal amount in BDT and terms offered to investors.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Target Funding Goal (৳ BDT) *</label>
                            <input
                              type="number"
                              required
                              value={campaignForm.goal}
                              onChange={(e) => setCampaignForm({ ...campaignForm, goal: e.target.value })}
                              placeholder="500000"
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Investor Equity / Return Terms *</label>
                            <input
                              type="text"
                              required
                              value={campaignForm.equityOffer}
                              onChange={(e) => setCampaignForm({ ...campaignForm, equityOffer: e.target.value })}
                              placeholder="e.g. 8% Revenue Share or 10% Equity"
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Campaign Duration (Days)</label>
                            <input
                              type="number"
                              value={campaignForm.durationDays || 60}
                              onChange={(e) => setCampaignForm({ ...campaignForm, durationDays: e.target.value })}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Funding release schedule (from your milestones)</label>
                            <input
                              type="text"
                              disabled
                              value={
                                milestoneDrafts.filter((m) => (m.title || '').trim()).length > 0
                                  ? `${milestoneDrafts.filter((m) => (m.title || '').trim()).length} equal release steps based on your milestones`
                                  : 'Set milestones in the next step'
                              }
                              className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between pt-4">
                          <button
                            type="button"
                            onClick={() => setWizardStep(2)}
                            className="px-5 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl"
                          >
                            ← Previous Step
                          </button>
                          <button
                            type="button"
                            onClick={() => setWizardStep(4)}
                            className="px-6 py-2.5 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            Next Step: Milestones →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 4: CUSTOM MILESTONES */}
                    {wizardStep === 4 && (
                      <div className="space-y-5">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="font-bold text-slate-900 text-base">Step 4: Your Milestones</h3>
                          <p className="text-xs text-slate-500">
                            Add the goals you will complete over time. Funding is released in equal parts as each milestone is verified (not a fixed 3-step list).
                          </p>
                        </div>

                        <div className="space-y-3">
                          {milestoneDrafts.map((m, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">Milestone #{idx + 1}</span>
                                <span className="text-[10px] font-mono text-emerald-700">{tranchePercentLabel(idx, milestoneDrafts.length)}</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Goal title *</label>
                                  <input
                                    type="text"
                                    value={m.title}
                                    onChange={(e) => {
                                      const next = [...milestoneDrafts];
                                      next[idx] = { ...next[idx], title: e.target.value };
                                      setMilestoneDrafts(next);
                                    }}
                                    placeholder="e.g. Launch beta app for 500 students"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Target timing</label>
                                  <input
                                    type="text"
                                    value={m.target}
                                    onChange={(e) => {
                                      const next = [...milestoneDrafts];
                                      next[idx] = { ...next[idx], target: e.target.value };
                                      setMilestoneDrafts(next);
                                    }}
                                    placeholder="e.g. Month 2 or Q1 2026"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                                  />
                                </div>
                              </div>
                              {milestoneDrafts.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setMilestoneDrafts(milestoneDrafts.filter((_, i) => i !== idx))}
                                  className="text-[11px] font-semibold text-rose-600 cursor-pointer"
                                >
                                  Remove milestone
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => setMilestoneDrafts([...milestoneDrafts, { title: '', target: `Month ${milestoneDrafts.length + 1}` }])}
                          className="px-3.5 py-2 border border-dashed border-emerald-400 text-emerald-800 text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          + Add another milestone
                        </button>

                        <div className="flex justify-between pt-4">
                          <button
                            type="button"
                            onClick={() => setWizardStep(3)}
                            className="px-5 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl"
                          >
                            ← Previous Step
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (milestoneDrafts.every((m) => !(m.title || '').trim())) {
                                showToast('Enter at least one milestone title.', 'error');
                                return;
                              }
                              setWizardStep(5);
                            }}
                            className="px-6 py-2.5 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            Next Step: Review & Audit Submission →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 5: AUDIT SUBMISSION REVIEW */}
                    {wizardStep === 5 && (
                      <div className="space-y-6">
                        <div className="border-b border-slate-100 pb-3">
                          <h3 className="font-bold text-slate-900 text-base">Step 5: Review & Submit for Admin Audit</h3>
                          <p className="text-xs text-slate-500">Double-check your pitch details before submitting for FundBridge Admin verification.</p>
                        </div>

                        {/* SUMMARY CHECKLIST CARD */}
                        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-xs">
                          <div className="flex justify-between items-start border-b pb-3">
                            <div>
                              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">STARTUP VENTURE</span>
                              <h4 className="font-bold text-slate-900 text-base">{campaignForm.title || 'Untitled Venture'}</h4>
                              <span className="text-xs font-semibold text-emerald-700">{campaignForm.university}</span>
                            </div>
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded uppercase">
                              READY FOR AUDIT ⏳
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-mono">
                            <div>
                              <span className="text-slate-400 text-[10px] block">FUNDING GOAL</span>
                              <strong className="text-slate-900">৳ {Number(campaignForm.goal || 0).toLocaleString()}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">TERMS OFFERED</span>
                              <strong className="text-emerald-700">{campaignForm.equityOffer}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">STAGE</span>
                              <strong className="text-slate-900">{campaignForm.stage || 'MVP'}</strong>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-200 text-slate-600 leading-relaxed">
                            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">PITCH SUMMARY</span>
                            <p className="line-clamp-3">{campaignForm.description || campaignForm.tagline || 'No description provided.'}</p>
                          </div>
                        </div>

                        {/* AUDIT PIPELINE INFORMATION BANNER */}
                        <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-xl space-y-1.5 text-xs text-amber-900">
                          <span className="font-bold block text-amber-900 flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-amber-700" /> Admin Audit & Verification Workflow:
                          </span>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            Approval takes <strong>at most 3 days</strong>. If you edit a pending campaign later, the timer restarts from day zero. After admins verify credentials and pitch details, the campaign is set to <strong>VERIFIED</strong> and published to the Investor Feed.
                          </p>
                        </div>

                        <div className="flex justify-between pt-4">
                          <button
                            type="button"
                            onClick={() => setWizardStep(4)}
                            className="px-5 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl"
                          >
                            ← Previous Step
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveCampaign}
                            className="px-6 py-3 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                          >
                            <span>Submit for Admin Audit & Verification</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: CAMPAIGNS TO WATCH / MY CAMPAIGNS */}
              {activeTab === 'explore' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">
                        {campaignsPageMode === 'mine' ? 'My Campaigns' : 'Campaigns to Watch'}
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {campaignsPageMode === 'mine'
                          ? 'Your startup campaigns. New campaigns require admin approval before going live.'
                          : 'Browse live startup campaigns across university incubation centers.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {campaignsPageMode === 'watch' ? (
                        <>
                          <select
                            value={exploreCategory}
                            onChange={(e) => setExploreCategory(e.target.value)}
                            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 bg-white focus:outline-none"
                          >
                            <option value="all">All Categories</option>
                            <option value="f&b">FoodTech / F&B</option>
                            <option value="cleantech">CleanTech</option>
                            <option value="watertech">WaterTech</option>
                            <option value="healthtech">HealthTech</option>
                            <option value="agtech">AgTech</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => { setWatchDetail(null); setCampaignsPageMode('mine'); }}
                            className="px-3.5 py-2 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            My Campaigns
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => { setWatchDetail(null); setCampaignsPageMode('watch'); }}
                            className="px-3.5 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            ← Campaigns to Watch
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenCreateCampaign}
                            className="px-3.5 py-2 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Create New Campaign
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {campaignsPageMode === 'watch' && !watchDetail && (
                    <div className="bg-[#064E3B] rounded-2xl p-5 text-white shadow-sm">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-200/80 block">Live marketplace (Campaigns to Watch)</span>
                      <p className="text-[11px] text-emerald-100/80 mt-1">All live campaigns in this list — not your personal Overview escrow.</p>
                      <div className="flex flex-wrap items-end justify-between gap-4 mt-3">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-emerald-200/70 block">Invested</span>
                          <h3 className="text-2xl font-bold font-mono tracking-tight">৳ {watchMarketInvested.toLocaleString()}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-mono uppercase text-emerald-200/70 block">Wanted (goals)</span>
                          <h3 className="text-2xl font-bold font-mono tracking-tight">৳ {watchMarketWanted.toLocaleString()}</h3>
                        </div>
                      </div>
                      <div className="mt-3">
                        <span className="text-xs font-medium text-emerald-200 block mb-1.5">{watchMarketPct}% of listed goals funded</span>
                        <div className="w-full bg-emerald-950/60 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${watchMarketPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {campaignsPageMode === 'watch' && watchDetail ? (
                    (() => {
                      const c = watchDetail;
                      const founder = c.founder || {};
                      const founderName = watchFounderName(c);
                      const ms = Array.isArray(c.milestones) ? c.milestones : [];
                      const doneN = ms.filter((m) => getMilestoneBucket(m, c) === 'done').length;
                      const pct = c.goal > 0 ? Math.min(100, Math.round(((c.raised || 0) / c.goal) * 100)) : 0;
                      const liveUpdates = watchDetailUpdates.filter((u) => (u.status || 'approved') === 'approved');
                      return (
                        <div className="space-y-6">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => { setWatchDetail(null); setWatchDetailUpdates([]); }}
                              className="px-3 py-1.5 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
                            >
                              ← Back to Campaigns to Watch
                            </button>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                            <div className="flex flex-wrap justify-between gap-3 items-start">
                              <div>
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md uppercase">{c.category || 'Startup'}</span>
                                <h2 className="text-xl font-bold text-slate-900 mt-2">{c.title}</h2>
                                <p className="text-xs text-slate-500 mt-1">{c.university} · {c.stage || 'MVP'} · {c.location || 'Bangladesh'}</p>
                              </div>
                              <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-emerald-50 text-emerald-800">Live</span>
                            </div>
                            {c.tagline && <p className="text-sm text-slate-700">{c.tagline}</p>}
                            {c.description && <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{c.description}</p>}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Founder</span>
                              <div className="flex items-center gap-3 mt-3">
                                <InitialsAvatar name={founderName} className="w-11 h-11" />
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{founderName}</p>
                                  <p className="text-[11px] text-slate-500">{founder.university || c.university}</p>
                                  {founder.department && <p className="text-[11px] text-slate-400">{founder.department}</p>}
                                </div>
                              </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Invested</span>
                              <p className="text-2xl font-bold font-mono text-emerald-700 mt-2">৳ {Number(c.raised || 0).toLocaleString()}</p>
                              <p className="text-[11px] text-slate-500 mt-1">of ৳ {Number(c.goal || 0).toLocaleString()} goal · {pct}%</p>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              {(c.equity_offer || c.equityOffer) && (
                                <p className="text-[11px] text-slate-600 mt-2">Terms: {c.equity_offer || c.equityOffer}</p>
                              )}
                            </div>
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Milestones hit</span>
                              <p className="text-2xl font-bold font-mono text-slate-900 mt-2">{doneN} / {ms.length || 0}</p>
                              <p className="text-[11px] text-slate-500 mt-1">Done only with proof on file</p>
                            </div>
                          </div>

                          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
                            <h3 className="text-sm font-bold text-slate-900">Milestone plan</h3>
                            {ms.length > 0 ? (
                              <ul className="space-y-2">
                                {ms.map((m, idx) => {
                                  const bucket = getMilestoneBucket(m, c);
                                  return (
                                    <li key={idx} className="flex flex-wrap justify-between gap-2 text-xs p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                      <span className="font-semibold text-slate-800">{m.title || m.name || `Milestone ${idx + 1}`}</span>
                                      <span className="text-slate-500">{m.target || m.targetDate || 'TBD'}</span>
                                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                        bucket === 'done' ? 'bg-emerald-100 text-emerald-800' :
                                        bucket === 'missed' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                      }`}>{bucket}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-xs text-slate-500">No milestones listed for this campaign.</p>
                            )}
                          </div>

                          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
                            <h3 className="text-sm font-bold text-slate-900">Public progress</h3>
                            {liveUpdates.length > 0 ? (
                              <ol className="space-y-3">
                                {liveUpdates.map((u) => (
                                  <li key={u.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                                    <div className="flex justify-between gap-2">
                                      <span className="font-bold text-slate-900">{u.title}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</span>
                                    </div>
                                    <p className="text-slate-600 whitespace-pre-wrap">{u.content}</p>
                                    {(u.milestone_tag || u.milestoneTag) && (
                                      <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded">{u.milestone_tag || u.milestoneTag}</span>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-xs text-slate-500">No admin-approved public updates yet.</p>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : campaignsPageMode === 'watch' ? (
                    filteredAllCampaigns.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAllCampaigns.map((c, idx) => (
                          <button
                            key={c.id || c._id || idx}
                            type="button"
                            onClick={() => openWatchDetail(c)}
                            className="text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-emerald-400 hover:ring-2 hover:ring-emerald-100 transition-all cursor-pointer"
                          >
                            <div className="space-y-3">
                              <div className="flex justify-between items-start">
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md uppercase">
                                  {c.category || 'Startup'}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500">{c.stage || 'MVP Stage'}</span>
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-900 text-base">{c.title}</h3>
                                <span className="text-xs font-semibold text-emerald-700 block">{c.university}</span>
                                {watchFounderName(c) && (
                                  <span className="text-[11px] text-slate-500 block mt-0.5">Founder: {watchFounderName(c)}</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                {c.tagline || c.description}
                              </p>
                            </div>
                            <div className="space-y-3 pt-3 border-t border-slate-100">
                              <div className="flex justify-between text-xs font-mono">
                                <span className="text-slate-500">Raised: <strong className="text-emerald-700">৳ {Number(c.raised || 0).toLocaleString()}</strong></span>
                                <span className="text-slate-500">Goal: <strong>৳ {Number(c.goal || 0).toLocaleString()}</strong></span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div
                                  className="bg-emerald-600 h-full rounded-full"
                                  style={{ width: c.goal > 0 ? `${Math.min(100, Math.round(((c.raised || 0) / c.goal) * 100))}%` : '0%' }}
                                ></div>
                              </div>
                              <p className="text-[11px] text-sky-700 font-semibold">View details →</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
                        <Compass className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-700">No live campaigns found matching your query.</p>
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      {campaigns.length > 0 ? campaigns.map((c, idx) => (
                        <div key={c.id || c._id || idx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                          <div className="flex justify-between gap-3 items-start">
                            <div>
                              <h3 className="font-bold text-slate-900 text-base">{c.title}</h3>
                              <p className="text-xs text-slate-500">{c.university} • {c.category || 'Startup'}</p>
                            </div>
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase ${
                              c.status === 'cancelled' ? 'bg-slate-200 text-slate-600' :
                              (c.verified || c.status === 'verified') ? 'bg-emerald-100 text-emerald-800' :
                              c.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {(c.verified || c.status === 'verified') ? 'Live' : (c.status || 'pending')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">{c.tagline || c.description}</p>
                          <p className="text-xs font-mono text-slate-500">Goal ৳ {Number(c.goal || 0).toLocaleString()} · Raised ৳ {Number(c.raised || 0).toLocaleString()}</p>
                          {c.status === 'rejected' && (
                            <p className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
                              Reason: {formatRejectionReason(c)}
                            </p>
                          )}
                          {!(c.verified || c.status === 'verified') && c.status !== 'cancelled' && c.status !== 'rejected' && (
                            <p className="text-[10px] text-amber-700">
                              Awaiting admin approval (at most 3 days). Editing restarts the timer from day zero.
                            </p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {(c.status === 'pending' || c.status === 'revisions') && (
                              <button type="button" onClick={() => handleOpenEditCampaign(c)} className="px-3 py-1.5 bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer">
                                Edit
                              </button>
                            )}
                            {c.status === 'rejected' && (
                              <>
                                <button type="button" onClick={() => handleOpenEditCampaign(c)} className="px-3 py-1.5 bg-amber-100 text-amber-900 text-xs font-semibold rounded-lg cursor-pointer">
                                  Reapply
                                </button>
                                <button type="button" onClick={() => handleDeleteRejectedCampaign(c.id || c._id)} className="px-3 py-1.5 bg-rose-100 text-rose-800 text-xs font-semibold rounded-lg cursor-pointer">
                                  Delete
                                </button>
                              </>
                            )}
                            {/* S3: exit lives on My Campaigns; milestones page is milestones-only */}
                            {(c.status === 'pending' || c.status === 'verified' || c.verified || c.status === 'revisions') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTimelineCampaignId(c.id || c._id);
                                    setSelectedMilestoneIdx(null);
                                    setActiveTab('milestones');
                                  }}
                                  className="px-3 py-1.5 bg-sky-100 text-sky-800 text-xs font-semibold rounded-lg cursor-pointer"
                                >
                                  Milestones
                                </button>
                                {(c.verified || c.status === 'verified') && (
                                  <button
                                    type="button"
                                    onClick={() => openEditRequestModal('investment', c)}
                                    className="px-3 py-1.5 bg-violet-100 text-violet-900 text-xs font-semibold rounded-lg cursor-pointer"
                                  >
                                    {pendingEditFor('investment', c.id || c._id) ? 'Edit pending…' : 'Request edit'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleExitPlanStub(`Stop campaign (${c.title})`)}
                                  className="px-3 py-1.5 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg cursor-pointer"
                                >
                                  Stop (stub)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExitPlanStub(`Auction / transfer (${c.title})`)}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer"
                                >
                                  Auction (stub)
                                </button>
                              </>
                            )}
                            {pendingEditFor('investment', c.id || c._id) && (
                              <p className="w-full text-[10px] text-violet-700">
                                Edit request pending — admin review at most 2 working days
                                {pendingEditFor('investment', c.id || c._id).due_at
                                  ? ` (due ${new Date(pendingEditFor('investment', c.id || c._id).due_at).toLocaleDateString()})`
                                  : ''}.
                              </p>
                            )}
                            {(c.successorName || c.successor_name) && (
                              <p className="w-full text-[10px] text-slate-500">
                                Designated successor: {c.successorName || c.successor_name}
                                {(c.successorEmail || c.successor_email) ? ` · ${c.successorEmail || c.successor_email}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      )) : (
                        <div className="py-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
                          <p className="text-xs text-slate-500">You have no startup campaigns yet.</p>
                          <button
                            type="button"
                            onClick={handleOpenCreateCampaign}
                            className="px-4 py-2 bg-[#047857] text-white text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            Create New Campaign
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: RELIEF CAMPAIGNS TO SUPPORT / MY RELIEF CAMPAIGNS */}
              {activeTab === 'relief' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">
                        {reliefPageMode === 'mine' ? 'My Relief Campaigns' : 'Relief Campaigns to Support'}
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {reliefPageMode === 'mine'
                          ? 'Your donation causes. Separate from investment campaigns. New ones need admin approval.'
                          : 'Browse approved community relief campaigns seeking donations (not investment equity).'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {reliefPageMode === 'watch' ? (
                        <button
                          type="button"
                          onClick={() => { setReliefPageMode('mine'); setShowReliefCreateForm(false); }}
                          className="px-3.5 py-2 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          My Relief Campaigns
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => { setReliefPageMode('watch'); setShowReliefCreateForm(false); }}
                            className="px-3.5 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                          >
                            ← Relief Campaigns to Support
                          </button>
                          <button
                            type="button"
                            onClick={openReliefCreateForm}
                            className="px-3.5 py-2 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Create New Relief Campaign
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {reliefPageMode === 'watch' && (
                    publicReliefCampaigns.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPublicRelief.map((d) => (
                          <div key={d.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-md uppercase">{d.cause || 'Relief'}</span>
                            <h3 className="font-bold text-slate-900 text-base">{d.title}</h3>
                            <p className="text-xs text-slate-500">{d.university}</p>
                            <p className="text-xs text-slate-600 line-clamp-2">{d.description || d.beneficiary}</p>
                            <p className="text-xs font-mono text-slate-600">Goal ৳ {Number(d.goal || 0).toLocaleString()} · Raised ৳ {Number(d.raised || 0).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
                        <Heart className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-700">No approved relief campaigns to support yet.</p>
                      </div>
                    )
                  )}

                  {reliefPageMode === 'mine' && (
                    <div className="space-y-4 max-w-3xl">
                      {showReliefCreateForm && (
                        <form onSubmit={handleSaveReliefDrive} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 text-xs">
                          <div className="flex justify-between items-center">
                            <h2 className="font-bold text-slate-900 text-sm">{editingReliefId ? 'Edit Relief Campaign' : 'Create New Relief Campaign'}</h2>
                            <button type="button" onClick={() => { setShowReliefCreateForm(false); setEditingReliefId(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                          </div>
                          <p className="text-[11px] text-amber-700">
                            {editingReliefId
                              ? 'Saving edits restarts admin approval from day zero (at most 3 days).'
                              : 'Submitted for admin approval (at most 3 days). Not public until approved. Separate from investment campaigns.'}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">Cause name <span className="text-rose-600">*</span></label>
                              <input required value={reliefForm.title} onChange={(e) => setReliefForm({ ...reliefForm, title: e.target.value })} placeholder="e.g. Flood relief for campus families" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">Cause type</label>
                              <select value={reliefForm.cause} onChange={(e) => setReliefForm({ ...reliefForm, cause: e.target.value })} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                                <option>Student Medical Aid</option>
                                <option>Disaster Relief</option>
                                <option>Education Support</option>
                                <option>Food & Shelter</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="font-semibold text-slate-700 block mb-1">Who will this help? <span className="text-rose-600">*</span></label>
                              <input required value={reliefForm.beneficiary} onChange={(e) => setReliefForm({ ...reliefForm, beneficiary: e.target.value })} placeholder="e.g. 40 students affected by campus hostel fire" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">Donation goal (৳)</label>
                              <input type="number" value={reliefForm.goal} onChange={(e) => setReliefForm({ ...reliefForm, goal: e.target.value })} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono" />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">University</label>
                              <input value={reliefForm.university} onChange={(e) => setReliefForm({ ...reliefForm, university: e.target.value })} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                            </div>
                            <div className="md:col-span-2">
                              <label className="font-semibold text-slate-700 block mb-1">Why donations are needed</label>
                              <textarea rows={3} value={reliefForm.description} onChange={(e) => setReliefForm({ ...reliefForm, description: e.target.value })} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">Use of funds 1</label>
                              <input value={reliefForm.use1} onChange={(e) => setReliefForm({ ...reliefForm, use1: e.target.value })} placeholder="e.g. Medicine" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">Use of funds 2</label>
                              <input value={reliefForm.use2} onChange={(e) => setReliefForm({ ...reliefForm, use2: e.target.value })} placeholder="e.g. Temporary housing" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                            </div>
                            <div className="md:col-span-2">
                              <label className="font-semibold text-slate-700 block mb-1">Use of funds 3</label>
                              <input value={reliefForm.use3} onChange={(e) => setReliefForm({ ...reliefForm, use3: e.target.value })} placeholder="e.g. School supplies" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                            </div>
                          </div>

                          {/* S3: designated successor for relief */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">Designated successor (name)</label>
                              <input
                                value={reliefForm.successorName || ''}
                                onChange={(e) => setReliefForm({ ...reliefForm, successorName: e.target.value })}
                                placeholder="Person who can continue if you cannot"
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                              />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 block mb-1">Successor email</label>
                              <input
                                type="email"
                                value={reliefForm.successorEmail || ''}
                                onChange={(e) => setReliefForm({ ...reliefForm, successorEmail: e.target.value })}
                                placeholder="successor@univ.edu.bd"
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                              />
                            </div>
                          </div>

                          <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm">Proof links (URLs only)</h3>
                              <p className="text-[11px] text-slate-500 mt-0.5">Newspaper articles, Google Drive / cloud folders, or video links. File upload is not allowed here.</p>
                            </div>
                            {(reliefForm.proofLinks || []).map((p, idx) => (
                              <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                                <div>
                                  <label className="font-semibold text-slate-700 block mb-1">Link type</label>
                                  <select
                                    value={p.type}
                                    onChange={(e) => {
                                      const next = [...reliefForm.proofLinks];
                                      next[idx] = { ...next[idx], type: e.target.value };
                                      setReliefForm({ ...reliefForm, proofLinks: next });
                                    }}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                                  >
                                    <option>Newspaper / Article</option>
                                    <option>Google Drive / Cloud</option>
                                    <option>Video URL</option>
                                    <option>Other link</option>
                                  </select>
                                </div>
                                <div className="md:col-span-2">
                                  <label className="font-semibold text-slate-700 block mb-1">URL (https://…)</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="url"
                                      value={p.url}
                                      onChange={(e) => {
                                        const next = [...reliefForm.proofLinks];
                                        next[idx] = { ...next[idx], url: e.target.value };
                                        setReliefForm({ ...reliefForm, proofLinks: next });
                                      }}
                                      placeholder="https://…"
                                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                                    />
                                    {(reliefForm.proofLinks || []).length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => setReliefForm({ ...reliefForm, proofLinks: reliefForm.proofLinks.filter((_, i) => i !== idx) })}
                                        className="px-2 text-rose-600 text-[11px] font-semibold"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setReliefForm({ ...reliefForm, proofLinks: [...(reliefForm.proofLinks || []), { type: 'Other link', url: '' }] })}
                              className="px-3 py-1.5 border border-dashed border-emerald-400 text-emerald-800 font-semibold rounded-xl"
                            >
                              + Add proof URL
                            </button>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => { setShowReliefCreateForm(false); setEditingReliefId(null); }} className="px-4 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl">Cancel</button>
                            <button type="submit" className="px-5 py-2.5 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl cursor-pointer">
                              {editingReliefId ? 'Save & Restart Approval' : 'Submit for Admin Approval'}
                            </button>
                          </div>
                        </form>
                      )}

                      {reliefDrives.length > 0 ? filteredMyRelief.map((d) => (
                        <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                          <div className="flex justify-between gap-3">
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm">{d.title}</h3>
                              <p className="text-slate-500">{d.cause} • Help: {d.beneficiary}</p>
                            </div>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              d.status === 'open' || d.status === 'verified' ? 'bg-emerald-100 text-emerald-800' :
                              d.status === 'rejected' || d.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>{d.status}</span>
                          </div>
                          <p className="font-mono text-slate-600">Goal ৳ {Number(d.goal || 0).toLocaleString()}</p>
                          {Array.isArray(d.proofLinks) && d.proofLinks.length > 0 && (
                            <ul className="space-y-1">
                              {d.proofLinks.map((p, i) => (
                                <li key={i} className="text-[11px] text-sky-700 truncate">
                                  <span className="font-semibold text-slate-600">{p.type}: </span>
                                  <a href={p.url} target="_blank" rel="noreferrer" className="underline">{p.url}</a>
                                </li>
                              ))}
                            </ul>
                          )}
                          {d.status === 'rejected' && (
                            <p className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
                              Reason: {formatRejectionReason(d)}
                            </p>
                          )}
                          {d.status === 'pending' && (
                            <p className="text-[10px] text-amber-700">Awaiting admin approval (at most 3 days). Editing restarts from day zero.</p>
                          )}
                          {(d.successorName || d.successor_name) && (
                            <p className="text-[10px] text-slate-500">
                              Designated successor: {d.successorName || d.successor_name}
                              {(d.successorEmail || d.successor_email) ? ` · ${d.successorEmail || d.successor_email}` : ''}
                            </p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {d.status === 'pending' && (
                              <button type="button" onClick={() => handleOpenEditRelief(d)} className="px-3 py-1.5 bg-slate-200 text-slate-800 font-semibold rounded-lg cursor-pointer">Edit</button>
                            )}
                            {(d.status === 'rejected' || d.status === 'cancelled') && (
                              <button type="button" onClick={() => handleOpenEditRelief(d)} className="px-3 py-1.5 bg-amber-100 text-amber-900 font-semibold rounded-lg cursor-pointer">Reapply</button>
                            )}
                            {d.status === 'rejected' && (
                              <button type="button" onClick={() => handleDeleteRejectedRelief(d.id)} className="px-3 py-1.5 bg-rose-100 text-rose-800 font-semibold rounded-lg cursor-pointer">Delete</button>
                            )}
                            {/* S3: relief exit = Stop only (no auction/bidding) */}
                            {(d.status === 'open' || d.status === 'verified') && (
                              <button
                                type="button"
                                onClick={() => openEditRequestModal('relief', d)}
                                className="px-3 py-1.5 bg-violet-100 text-violet-900 font-semibold rounded-lg cursor-pointer"
                              >
                                {pendingEditFor('relief', d.id) ? 'Edit pending…' : 'Request edit'}
                              </button>
                            )}
                            {(d.status === 'open' || d.status === 'verified' || d.status === 'pending') && (
                              <button
                                type="button"
                                onClick={() => handleExitPlanStub(`Stop relief campaign (${d.title})`, { relief: true })}
                                className="px-3 py-1.5 bg-rose-50 text-rose-700 font-semibold rounded-lg cursor-pointer"
                              >
                                Stop (stub)
                              </button>
                            )}
                          </div>
                          {pendingEditFor('relief', d.id) && (
                            <p className="text-[10px] text-violet-700">
                              Edit request pending — admin review at most 2 working days.
                            </p>
                          )}
                        </div>
                      )) : (
                        !showReliefCreateForm && (
                          <div className="py-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
                            <p className="text-xs text-slate-500">You have no relief campaigns yet.</p>
                            <button
                              type="button"
                              onClick={openReliefCreateForm}
                              className="px-4 py-2 bg-[#047857] text-white text-xs font-semibold rounded-xl cursor-pointer"
                            >
                              Create New Relief Campaign
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: INVESTORS — S3: live proposals for this founder only */}
              {activeTab === 'investors' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">Investors</h1>
                    <p className="text-xs text-slate-500 mt-0.5">Click an investor for biodata, investments, and chat. Conversation history stays in that chat — no extra tab.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-base">Registered investors</h3>
                      <span className="text-[11px] font-mono text-slate-400">{directoryInvestors.length}</span>
                    </div>
                    {directoryInvestors.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {directoryInvestors.map((inv) => (
                          <button
                            type="button"
                            key={inv.id || inv._id}
                            onClick={() => openInvestorDetail(inv)}
                            className={`bg-white border rounded-2xl p-4 shadow-sm text-left cursor-pointer transition-all ${
                              (selectedInvestor?.id || selectedInvestor?._id) === (inv.id || inv._id)
                                ? 'border-sky-500 ring-2 ring-sky-500/20'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <InitialsAvatar name={inv.name || 'Investor'} />
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 text-sm truncate">{inv.name || 'Investor'}</h4>
                                <span className="text-[11px] text-slate-500 block truncate">{inv.institution || inv.university || inv.email || 'Investor'}</span>
                              </div>
                            </div>
                            {inv.bio ? (
                              <p className="mt-3 text-[11px] text-slate-600 leading-snug line-clamp-3">{inv.bio}</p>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center bg-white border border-slate-200 rounded-2xl">
                        <p className="text-xs font-semibold text-slate-700">No registered investors in the local directory.</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button type="button" onClick={() => setInvestorPropFilter('pending')} className={`text-left bg-white border rounded-2xl p-5 shadow-sm cursor-pointer ${investorPropFilter === 'pending' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'}`}>
                      <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Pending review</span>
                      <span className="text-2xl font-bold text-amber-700 font-mono">{pendingProposalCount}</span>
                    </button>
                    <button type="button" onClick={() => setInvestorPropFilter('accepted')} className={`text-left bg-white border rounded-2xl p-5 shadow-sm cursor-pointer ${investorPropFilter === 'accepted' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
                      <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">Accepted (invested)</span>
                      <span className="text-2xl font-bold text-emerald-700 font-mono">{acceptedProposalCount}</span>
                    </button>
                    <div className="bg-[#064E3B] rounded-2xl p-5 text-white shadow-sm">
                      <span className="text-[10px] font-mono uppercase text-emerald-200/80 tracking-wider block">Raised from accepted offers</span>
                      <span className="text-2xl font-bold font-mono">৳ {acceptedProposalRaised.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {['all', 'pending', 'accepted', 'declined'].map((key) => (
                      <button key={key} type="button" onClick={() => setInvestorPropFilter(key)} className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg cursor-pointer ${investorPropFilter === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* INVESTORS GRID & PROPOSALS */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                      <h3 className="font-bold text-slate-900 text-base">Submitted Investor Proposals</h3>

                      {investorTabProposals.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {investorTabProposals.map((p, idx) => (
                            <div
                              key={p.id || p._id || idx}
                              onClick={() => setSelectedProposal(p)}
                              className={`bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition-all ${selectedProposal?.id === p.id ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <InitialsAvatar name={p.investor_name || 'Investor'} />
                                  <div>
                                    <h4 className="font-bold text-slate-900 text-sm">{p.investor_name || p.investorName || 'Investor'}</h4>
                                    <span className="text-[11px] text-slate-500 block">{p.campaign_title || p.return_structure || p.terms || 'Term sheet'}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 text-[9px] font-extrabold rounded ${p.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                                      p.status === 'declined' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                    {(p.status || 'PENDING').toUpperCase()}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                                <div className="flex justify-between text-slate-600">
                                  <span>Offer Amount</span>
                                  <span className="font-bold text-slate-900 font-mono">৳ {Number(p.amount || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                  <span>Return Structure</span>
                                  <span className="font-semibold text-slate-900">{p.return_structure || p.terms || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
                          <Users className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="text-xs font-semibold text-slate-700">No investor proposals submitted yet in database.</p>
                          <p className="text-[11px] text-slate-400">When an investor submits a funding proposal for your campaign, it will appear here.</p>
                        </div>
                      )}
                    </div>

                    {selectedProposal ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
                        <div className="space-y-5">
                          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 font-bold block">FINANCIAL OFFER</span>
                              <span className="text-2xl font-bold text-emerald-900 font-mono">৳ {Number(selectedProposal.amount || 0).toLocaleString()}</span>
                            </div>
                            <Wallet className="w-8 h-8 text-emerald-600 opacity-80" />
                          </div>

                          <div className="space-y-3 text-xs">
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                              <span className="text-slate-500">Return Terms</span>
                              <span className="font-bold text-slate-900">{selectedProposal.return_structure || selectedProposal.terms || '—'}</span>
                            </div>
                            {selectedProposal.maturity_period ? (
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                              <span className="text-slate-500">Maturity Period</span>
                              <span className="font-bold text-slate-900">{selectedProposal.maturity_period}</span>
                            </div>
                            ) : null}
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                              <span className="text-slate-500">Status</span>
                              <span className="font-bold text-emerald-700 uppercase">{selectedProposal.status || 'pending'}</span>
                            </div>
                          </div>

                          {selectedProposal.custom_notes && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">INVESTOR NOTE</span>
                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 italic">
                                "{selectedProposal.custom_notes}"
                              </div>
                            </div>
                          )}
                        </div>

                        {String(selectedProposal.status || 'pending').toLowerCase() === 'pending' ? (
                        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => handleProposalStatus(selectedProposal.id || selectedProposal._id, 'declined')}
                            className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                          >
                            Decline Offer
                          </button>
                          <button
                            onClick={() => handleProposalStatus(selectedProposal.id || selectedProposal._id, 'accepted')}
                            className="flex-1 py-2.5 bg-[#047857] hover:bg-[#065f46] text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                          >
                            Accept Offer
                          </button>
                        </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 pt-4 border-t border-slate-100">Already reviewed. Accepted offers count as invested on this campaign.</p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400 my-auto">
                        Select a proposal from the left to view financial terms.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: WALLET */}
              {activeTab === 'wallet' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">Wallet</h1>
                      <p className="text-xs text-slate-500 mt-0.5">Manage payouts, security deposits, and tranche disbursements from database.</p>
                    </div>
                    <button
                      onClick={() => setShowPayoutModal(true)}
                      className="px-4 py-2.5 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Request Payout</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-slate-900 text-base">Security Deposit Bond Calculation</h3>
                        <Info className="w-4 h-4 text-slate-400" />
                      </div>

                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
                        <span className="text-[10px] font-mono uppercase text-slate-400 tracking-widest block mb-2 font-bold">DYNAMIC BOND FORMULA</span>
                        <div className="text-xl font-bold text-slate-900 font-mono py-2 px-4 bg-white border border-slate-200 rounded-lg inline-block shadow-2xs">
                          D = F * (P<sub>base</sub> + α * T)
                        </div>
                      </div>

                      <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-900">
                        <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>Security deposits are locked safely in smart escrow contracts and released upon milestone completion verification.</span>
                      </div>
                    </div>

                    <div className="space-y-6 flex flex-col justify-between">
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">AVAILABLE TO WITHDRAW</span>
                        <h3 className="text-3xl font-bold text-sky-600 font-mono">
                          {/* S3: stub split — based on approved-campaign escrow only */}
                          ৳ {Math.round(totalEscrowRaised * 0.5).toLocaleString()}
                        </h3>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">IN ESCROW PIPELINE</span>
                        <h3 className="text-3xl font-bold text-slate-900 font-mono">
                          ৳ {Math.round(totalEscrowRaised * 0.5).toLocaleString()}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-900 text-base">Automated Payout Ledger</h3>

                    {payoutsList.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                              <th className="pb-3 font-semibold">TRANCHE / REASON</th>
                              <th className="pb-3 font-semibold">AMOUNT</th>
                              <th className="pb-3 font-semibold">METHOD</th>
                              <th className="pb-3 font-semibold">STATUS</th>
                              <th className="pb-3 font-semibold">HASH / DATE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {payoutsList.map((p, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/80">
                                <td className="py-4 font-semibold text-slate-900">{p.tranche || 'Escrow Disbursement'}</td>
                                <td className="py-4 font-mono font-bold text-slate-900">৳ {Number(p.amount || 0).toLocaleString()}</td>
                                <td className="py-4">
                                  <span className="px-2 py-0.5 bg-pink-50 text-pink-700 text-[10px] font-bold rounded">{p.method || 'bKash'}</span>
                                </td>
                                <td className="py-4">
                                  <span className="px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-md uppercase">{p.status || 'COMPLETED'}</span>
                                </td>
                                <td className="py-4 text-slate-500 font-mono text-[11px]">{p.hash || p.created_at || 'Verified'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                        No payout transactions recorded in database yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: MILESTONES — S3: milestones only (exit lives on campaign pages) */}
              {activeTab === 'milestones' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#0284C7] tracking-widest font-bold block">ACTIVE PROJECT TRACKING</span>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display mt-0.5">Milestone Submissions</h1>
                      <p className="text-xs text-slate-500 mt-1">Pick a campaign, then manage that campaign’s milestones only.</p>
                    </div>
                    {manageableCampaigns.length > 0 && (
                      <select
                        value={(activeCampaign && (activeCampaign.id || activeCampaign._id)) || ''}
                        onChange={(e) => {
                          setTimelineCampaignId(e.target.value);
                          setSelectedMilestoneIdx(null);
                        }}
                        className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium"
                      >
                        {manageableCampaigns.map((c) => (
                          <option key={c.id || c._id} value={c.id || c._id}>
                            {c.title} ({(c.verified || c.status === 'verified') ? 'Live' : (c.status || 'pending')})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {activeCampaign && Array.isArray(activeCampaign.milestones) && activeCampaign.milestones.length > 0 && (() => {
                    const doneN = activeCampaign.milestones.filter((m) => getMilestoneBucket(m) === 'done').length;
                    const missedN = activeCampaign.milestones.filter((m) => getMilestoneBucket(m) === 'missed').length;
                    const pendingN = activeCampaign.milestones.length - doneN - missedN;
                    return (
                      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 space-y-2">
                        <p className="text-xs font-bold text-sky-900">
                          Milestones for: <span className="text-emerald-800">{activeCampaign.title}</span>
                        </p>
                        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">{doneN} done</span>
                          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800">{pendingN} pending</span>
                          <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800">{missedN} missed</span>
                        </div>
                        <p className="text-[10px] text-slate-500">Pending milestones can be edited. Missed milestones can be redone.</p>
                      </div>
                    );
                  })()}

                  {activeCampaign && activeCampaign.milestones && activeCampaign.milestones.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-slate-900 text-base">Configured Milestones</h3>
                            <p className="text-[11px] text-slate-500">
                              Campaign: <strong className="text-slate-800">{activeCampaign.title}</strong> — click a milestone for actions.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddMilestone}
                            className="px-3 py-1.5 bg-[#047857] text-white text-[11px] font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add milestone
                          </button>
                        </div>
                        <div className="space-y-3">
                          {activeCampaign.milestones.map((m, idx) => {
                            const selected = selectedMilestoneIdx === idx;
                            const proofCount = Array.isArray(m.proofs) ? m.proofs.length : 0;
                            const bucket = getMilestoneBucket(m);
                            return (
                              <div
                                key={idx}
                                onClick={() => {
                                  setSelectedMilestoneIdx(idx);
                                  setMilestoneProofFile(null);
                                  setMilestoneProofNote('');
                                  setCertifyChecked(false);
                                  setMilestoneEditTitle(m.name || m.title || '');
                                  setMilestoneEditTarget(m.targetDate || m.target || '');
                                }}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                  selected
                                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                                    : 'border-slate-200 hover:border-sky-500 bg-slate-50/50'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <h4 className="font-bold text-slate-900 text-sm">{m.name || m.title || `Milestone #${idx + 1}`}</h4>
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                                    bucket === 'done'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : bucket === 'missed'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {bucket}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500 block mt-1">Target: {m.targetDate || m.target || 'TBD'}</span>
                                <span className="text-[10px] text-slate-400 block mt-1">
                                  {proofCount > 0 ? `${proofCount} proof file(s) on record` : 'No proofs uploaded yet'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        {selectedMilestoneIdx === null || !activeCampaign.milestones[selectedMilestoneIdx] ? (
                          <div className="py-16 text-center space-y-2">
                            <Flag className="w-8 h-8 text-slate-300 mx-auto" />
                            <h3 className="font-bold text-slate-900 text-sm">Select a milestone</h3>
                            <p className="text-xs text-slate-500 max-w-xs mx-auto">
                              Choose a milestone on the left. Publish Update and Proof Upload will appear here for that item only.
                            </p>
                          </div>
                        ) : (
                          (() => {
                            const m = activeCampaign.milestones[selectedMilestoneIdx];
                            const milestoneLabel = m.name || m.title || `Milestone #${selectedMilestoneIdx + 1}`;
                            const proofs = Array.isArray(m.proofs) ? m.proofs : [];
                            const bucket = getMilestoneBucket(m);
                            const canAdjust = bucket !== 'done';
                            return (
                              <>
                                <div className="border-b border-slate-100 pb-3 space-y-1">
                                  <h3 className="font-bold text-slate-900 text-base">Actions for this milestone</h3>
                                  <p className="text-xs text-slate-600">
                                    Campaign: <span className="font-semibold text-slate-800">{activeCampaign.title}</span>
                                  </p>
                                  <p className="text-xs text-slate-600">
                                    Verifying: <span className="font-semibold text-emerald-800">{milestoneLabel}</span>
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    Target {m.targetDate || m.target || 'TBD'} · Status {bucket}
                                  </p>
                                </div>

                                {canAdjust && (
                                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                    <p className="text-[11px] font-semibold text-slate-700">Adjust milestone</p>
                                    <p className="text-[10px] text-slate-500">
                                      Time: if target is “Month N”, missed is automatic when N months have passed since this campaign’s submission date
                                      ({activeCampaign.submitted_at || activeCampaign.created_at
                                        ? new Date(activeCampaign.submitted_at || activeCampaign.created_at).toLocaleDateString()
                                        : 'submission date unknown'}).
                                      Redo is only for missed milestones. Changes may take some time because admin approval is required.
                                    </p>
                                    <input
                                      type="text"
                                      value={milestoneEditTitle}
                                      onChange={(e) => setMilestoneEditTitle(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                                      placeholder="Milestone title"
                                    />
                                    <input
                                      type="text"
                                      value={milestoneEditTarget}
                                      onChange={(e) => setMilestoneEditTarget(e.target.value)}
                                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                                      placeholder="Target / duration (e.g. Month 2)"
                                    />
                                    {bucket === 'missed' && (
                                      <button
                                        type="button"
                                        onClick={() => handleRedoMilestone(selectedMilestoneIdx)}
                                        className="w-full px-3 py-2 bg-amber-100 text-amber-900 text-[11px] font-semibold rounded-lg cursor-pointer"
                                      >
                                        Redo missed milestone
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleSaveMilestoneEdits(selectedMilestoneIdx)}
                                      className="w-full px-3 py-2 bg-slate-800 text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                                    >
                                      Save edits
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMilestone(selectedMilestoneIdx)}
                                      className="w-full px-3 py-2 bg-rose-50 text-rose-700 border border-rose-100 text-[11px] font-semibold rounded-lg cursor-pointer"
                                    >
                                      Delete milestone
                                    </button>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openAnnouncementForMilestone(selectedMilestoneIdx)}
                                  className="w-full py-3 px-4 bg-[#059669] hover:bg-[#047857] text-white font-semibold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>Publish Update for this milestone</span>
                                </button>

                                <div className="space-y-3 pt-2">
                                  <h4 className="font-bold text-slate-900 text-sm">Proof upload for “{milestoneLabel}”</h4>
                                  <p className="text-[11px] text-slate-500">
                                    Upload receipts, bank/MFS statements, screenshots, or other documents that prove this milestone is complete.
                                  </p>
                                  <label className="border-2 border-dashed border-slate-300 rounded-2xl p-5 text-center bg-slate-50 space-y-2 block cursor-pointer hover:border-sky-400 transition-colors">
                                    <Upload className="w-7 h-7 text-sky-600 mx-auto" />
                                    <span className="text-xs font-bold text-slate-800 block">
                                      {milestoneProofFile ? milestoneProofFile.name : 'Choose proof file for this milestone'}
                                    </span>
                                    <span className="text-[11px] text-slate-400 block">PDF, JPG, or PNG (Max 5MB)</span>
                                    <input
                                      type="file"
                                      accept=".jpg,.jpeg,.png,.pdf"
                                      className="hidden"
                                      onChange={(e) => setMilestoneProofFile(e.target.files?.[0] || null)}
                                    />
                                  </label>
                                  <div>
                                    <label className="font-semibold text-slate-700 block mb-1 text-xs">What does this file prove?</label>
                                    <input
                                      type="text"
                                      value={milestoneProofNote}
                                      onChange={(e) => setMilestoneProofNote(e.target.value)}
                                      placeholder={`e.g. bKash receipt for ${milestoneLabel}`}
                                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                                    />
                                  </div>
                                  <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={certifyChecked}
                                      onChange={(e) => setCertifyChecked(e.target.checked)}
                                      className="mt-0.5 rounded text-emerald-600"
                                    />
                                    <span>I certify these documents are accurate evidence for <strong>{milestoneLabel}</strong>.</span>
                                  </label>
                                  <button
                                    type="button"
                                    disabled={uploadingProof}
                                    onClick={handleUploadMilestoneProof}
                                    className="w-full py-3 bg-[#047857] hover:bg-[#065f46] disabled:opacity-60 text-white font-bold text-xs rounded-xl cursor-pointer"
                                  >
                                    {uploadingProof ? 'Uploading…' : 'Submit Proof to Database'}
                                  </button>
                                </div>

                                {proofs.length > 0 && (
                                  <div className="pt-3 border-t border-slate-100 space-y-2">
                                    <h4 className="font-bold text-slate-900 text-xs">Uploaded proofs for this milestone</h4>
                                    <ul className="space-y-2">
                                      {proofs.map((p) => (
                                        <li key={p.id || p.path} className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                          <span className="font-semibold text-slate-800 block">{p.originalName || p.path}</span>
                                          {p.note && <span className="text-slate-500 block">{p.note}</span>}
                                          <span className="text-slate-400 font-mono">{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
                      <p className="text-xs text-slate-400">No milestones set for this campaign yet.</p>
                      {activeCampaign && (
                        <button
                          type="button"
                          onClick={handleAddMilestone}
                          className="px-4 py-2 bg-[#047857] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add milestone
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: AUDIT LOGS */}
              {activeTab === 'audit' && (
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#0284C7] tracking-widest font-bold block">YOUR ACTIVITY</span>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display mt-0.5">Audit Logs</h1>
                    <p className="text-xs text-slate-500 mt-1">Actions on your account: campaigns, proposals, payouts, profile, and updates. Receipt hash is a checksum of that event, not a blockchain.</p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    {auditLogs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                              <th className="pb-3 font-semibold">When</th>
                              <th className="pb-3 font-semibold">CATEGORY</th>
                              <th className="pb-3 font-semibold">TITLE</th>
                              <th className="pb-3 font-semibold">STATUS</th>
                              <th className="pb-3 font-semibold">HASH RECEIPT</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredAuditLogs.map((log, idx) => (
                              <tr key={log.id || idx} className="hover:bg-slate-50/80">
                                <td className="py-4 font-mono text-slate-500 whitespace-nowrap">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
                                <td className="py-4 font-mono font-bold text-slate-800">{log.category || 'SYSTEM'}</td>
                                <td className="py-4 font-semibold text-slate-900">{log.title || 'Log Activity'}</td>
                                <td className="py-4">
                                  <span className="px-2.5 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-md uppercase">
                                    {log.status || 'RECORDED'}
                                  </span>
                                </td>
                                <td className="py-4 font-mono text-sky-600 font-semibold">{log.hash || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-slate-50 rounded-xl text-xs text-slate-400">
                        No audit records yet. Create a campaign, update your profile, or review a proposal and it will show here.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 7: SETTINGS / EDIT PROFILE INFO */}
              {activeTab === 'settings' && (
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">Profile Settings</h1>
                    <p className="text-xs text-slate-500 mt-1">Manage your founder identity, contact details, and institutional credentials.</p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                    <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                      <InitialsAvatar name={profileUser.name} className="w-16 h-16 text-lg" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{profileUser.name}</h3>
                        <span className="text-xs text-emerald-700 font-semibold block">{profileUser.university}</span>
                        <span className="text-[10px] text-slate-400 font-mono uppercase">Vetting Status: {profileUser.vettingStatus || 'VERIFIED'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Full Name <span className="text-rose-600">*</span></label>
                        <input
                          type="text"
                          required
                          value={profileUser.name}
                          onChange={(e) => setProfileUser({ ...profileUser, name: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Email Address <span className="text-rose-600">*</span></label>
                        <input
                          type="email"
                          required
                          value={profileUser.email}
                          onChange={(e) => setProfileUser({ ...profileUser, email: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">University / Institution <span className="text-rose-600">*</span></label>
                        <input
                          type="text"
                          required
                          value={profileUser.university}
                          onChange={(e) => setProfileUser({ ...profileUser, university: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Department</label>
                        <input
                          type="text"
                          value={profileUser.department || ''}
                          onChange={(e) => setProfileUser({ ...profileUser, department: e.target.value })}
                          placeholder="e.g. Computer Science & Engineering"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Student ID <span className="text-rose-600">*</span></label>
                        <input
                          type="text"
                          required
                          value={profileUser.studentId || ''}
                          onChange={(e) => setProfileUser({ ...profileUser, studentId: e.target.value })}
                          placeholder="e.g. 20101452"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">bKash / MFS Mobile Number <span className="text-rose-600">*</span></label>
                        <input
                          type="text"
                          required
                          value={profileUser.mfsNumber || ''}
                          onChange={(e) => setProfileUser({ ...profileUser, mfsNumber: e.target.value })}
                          placeholder="e.g. 01711223344"
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Bio</label>
                      <textarea
                        rows={4}
                        value={profileUser.bio || ''}
                        onChange={(e) => setProfileUser({ ...profileUser, bio: e.target.value })}
                        placeholder="Short background about you and your startup..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                      <h3 className="font-bold text-slate-900">Identity documents for vetting</h3>
                      <p className="text-slate-500">Upload Student ID and NID (PDF or image). Admin already has a review queue — this only attaches your files.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">Student ID card</label>
                          <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setIdCardFile(e.target.files?.[0] || null)} />
                          {profileUser.studentIdCardImage && <p className="text-[10px] text-emerald-700 mt-1">On file</p>}
                        </div>
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">NID card</label>
                          <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setNidFile(e.target.files?.[0] || null)} />
                          {profileUser.nidCardImage && <p className="text-[10px] text-emerald-700 mt-1">On file</p>}
                        </div>
                      </div>
                      <button type="button" onClick={handleUploadVettingDocs} className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer">Upload documents</button>
                    </div>

                    <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                      <button
                        type="button"
                        onClick={onLogout}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out of Account</span>
                      </button>

                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-[#047857] hover:bg-[#065f46] text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer"
                      >
                        Save Profile Changes
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* REQUEST PAYOUT MODAL */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Request Wallet Payout</h3>
              <button onClick={() => setShowPayoutModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestPayout} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Withdrawal Amount (৳)</label>
                <input
                  type="number"
                  required
                  placeholder="Enter amount (e.g. 50000)"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Payout Method</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="bkash">bKash Merchant ({profileUser.mfsNumber || '01711223344'})</option>
                  <option value="bank">BRAC Bank Wire Transfer</option>
                  <option value="nagad">Nagad Enterprise</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#047857] hover:bg-[#065f46] text-white font-semibold rounded-xl shadow-sm cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FR-8: PUBLISH ANNOUNCEMENT MODAL */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <span>Publish Campaign Progress Update</span>
              </h3>
              <button onClick={() => setShowAnnouncementModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublishAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Campaign <span className="text-rose-600">*</span></label>
                <select
                  required
                  value={announcementCampaignId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setAnnouncementCampaignId(id);
                    const opts = getProgressTagOptions(id);
                    setAnnouncementTag(opts[0] || 'General Update');
                    setShowAddTagInput(false);
                    setNewProgressTag('');
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                >
                  {campaigns.filter((c) => c.status !== 'cancelled').map((c) => {
                    const id = c.id || c._id;
                    return (
                      <option key={id} value={id}>{c.title || id}</option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Update Title <span className="text-rose-600">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Milestone 1 Completed - MVP Live for Beta Testing!"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* S3: Milestone/Progress tag from campaign milestones + custom */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block mb-1">Milestone / Progress tag</label>
                <select
                  value={
                    getProgressTagOptions(announcementCampaignId).includes(announcementTag)
                      ? announcementTag
                      : (getProgressTagOptions(announcementCampaignId)[0] || 'General Update')
                  }
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      setShowAddTagInput(true);
                      return;
                    }
                    setAnnouncementTag(e.target.value);
                    setShowAddTagInput(false);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                >
                  {getProgressTagOptions(announcementCampaignId).map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                  <option value="__add_new__">+ Add new tag…</option>
                </select>
                {showAddTagInput && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProgressTag}
                      onChange={(e) => setNewProgressTag(e.target.value)}
                      placeholder="New tag name"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddProgressTag}
                      className="px-3 py-2 bg-slate-800 text-white text-[11px] font-semibold rounded-xl cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddTagInput(false); setNewProgressTag(''); }}
                      className="px-3 py-2 border border-slate-300 text-slate-700 text-[11px] font-semibold rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <p className="text-[10px] text-slate-500">Tags come from this campaign’s milestones. You can also add a custom progress tag.</p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Announcement Narrative / Log Details <span className="text-rose-600">*</span></label>
                <textarea
                  rows={4}
                  required
                  placeholder="Share latest development logs, metric achievements, and user feedback with your backers..."
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  disabled={publishingUpdate}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishingUpdate || campaigns.filter((c) => c.status !== 'cancelled').length === 0}
                  className="flex-1 py-2.5 bg-[#047857] hover:bg-[#065f46] disabled:opacity-60 text-white font-semibold rounded-xl shadow-sm cursor-pointer"
                >
                  {publishingUpdate ? 'Submitting...' : 'Submit for Admin Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* S3: post-approval edit request modal */}
      {showEditRequestModal && editRequestTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Request edit (approved campaign)</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {editRequestTarget.item.title} · Admin review at most 2 working days
                </p>
              </div>
              <button type="button" onClick={() => setShowEditRequestModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitEditRequest} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Why do you need to edit? <span className="text-rose-600">*</span></label>
                <textarea
                  required
                  rows={3}
                  value={editRequestReason}
                  onChange={(e) => setEditRequestReason(e.target.value)}
                  placeholder="e.g. Correct funding goal after advisor feedback"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              {editRequestTarget.type === 'investment' ? (
                <>
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-xl" value={editRequestForm.title || ''} onChange={(e) => setEditRequestForm({ ...editRequestForm, title: e.target.value })} placeholder="Title" />
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-xl" value={editRequestForm.tagline || ''} onChange={(e) => setEditRequestForm({ ...editRequestForm, tagline: e.target.value })} placeholder="Tagline" />
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono" type="number" value={editRequestForm.goal || ''} onChange={(e) => setEditRequestForm({ ...editRequestForm, goal: e.target.value })} placeholder="Goal (BDT)" />
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-xl" value={editRequestForm.equityOffer || ''} onChange={(e) => setEditRequestForm({ ...editRequestForm, equityOffer: e.target.value })} placeholder="Equity / terms" />
                  <textarea className="w-full px-3 py-2 border border-slate-300 rounded-xl" rows={3} value={editRequestForm.description || ''} onChange={(e) => setEditRequestForm({ ...editRequestForm, description: e.target.value })} placeholder="Description" />
                </>
              ) : (
                <>
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-xl" value={editRequestForm.title || ''} onChange={(e) => setEditRequestForm({ ...editRequestForm, title: e.target.value })} placeholder="Title" />
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-xl" value={editRequestForm.cause || ''} onChange={(e) => setEditRequestForm({ ...editRequestForm, cause: e.target.value })} placeholder="Cause" />
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-xl" value={editRequestForm.beneficiary || ''} onChange={(e) => setEditRequestForm({ ...editRequestForm, beneficiary: e.target.value })} placeholder="Beneficiary" />
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono" type="number" value={editRequestForm.goal || ''} onChange={(e) => setEditRequestForm({ ...editRequestForm, goal: e.target.value })} placeholder="Goal (BDT)" />
                  <textarea className="w-full px-3 py-2 border border-slate-300 rounded-xl" rows={3} value={editRequestForm.description || ''} onChange={(e) => setEditRequestForm({ ...editRequestForm, description: e.target.value })} placeholder="Description" />
                </>
              )}
              <p className="text-[10px] text-slate-500">Changes apply only after admin approval (at most 2 working days).</p>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowEditRequestModal(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl">Cancel</button>
                <button type="submit" disabled={submittingEditRequest} className="flex-1 py-2.5 bg-violet-700 hover:bg-violet-800 disabled:opacity-60 text-white font-semibold rounded-xl cursor-pointer">
                  {submittingEditRequest ? 'Submitting…' : 'Submit edit request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* S3: investor directory detail */}
      {selectedInvestor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-start gap-3 min-w-0">
                <InitialsAvatar name={selectedInvestor.name || 'Investor'} className="w-12 h-12" />
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-base truncate">{selectedInvestor.name || 'Investor'}</h3>
                  <p className="text-[11px] text-slate-500 truncate">{selectedInvestor.institution || 'Investor'}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedInvestor(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Email</span>
                <span className="font-semibold text-slate-900 text-right break-all">{selectedInvestor.email || '—'}</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Contact (MFS)</span>
                <span className="font-semibold text-slate-900 font-mono">{selectedInvestor.phone || selectedInvestor.mfsNumber || selectedInvestor.mfs_number || '—'}</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Bank / MFS account</span>
                <span className="font-semibold text-slate-900 text-right">{selectedInvestor.bank_or_mfs || '—'}</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Vetting</span>
                <span className="font-semibold text-emerald-700 uppercase">{selectedInvestor.vettingStatus || selectedInvestor.vetting_status || '—'}</span>
              </div>
              {selectedInvestor.affiliationStatus ? (
                <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Affiliation</span>
                  <span className="font-semibold text-slate-900">{selectedInvestor.affiliationStatus}</span>
                </div>
              ) : null}
            </div>

            {selectedInvestor.bio ? (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">Bio</span>
                <p className="text-xs text-slate-700 leading-relaxed">{selectedInvestor.bio}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">Invested in</span>
              {selectedInvestorDeals.filter((p) => String(p.status || '').toLowerCase() === 'accepted').length > 0 ? (
                <ul className="space-y-2">
                  {selectedInvestorDeals
                    .filter((p) => String(p.status || '').toLowerCase() === 'accepted')
                    .map((p) => (
                      <li key={p.id || p._id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <span className="font-semibold text-slate-900 block">{p.campaign_title || p.campaign_id || 'Campaign'}</span>
                        <span className="font-mono text-emerald-700">৳ {Number(p.amount || 0).toLocaleString()}</span>
                        {p.return_structure || p.terms ? (
                          <span className="text-slate-500 block mt-0.5">{p.return_structure || p.terms}</span>
                        ) : null}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-500">No accepted investments on record yet.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => openChatWithInvestor(selectedInvestor)}
              className="w-full py-2.5 bg-[#047857] hover:bg-[#065f46] text-white font-semibold text-xs rounded-xl transition-all shadow-sm cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
          </div>
        </div>
      )}

      {/* S3: FR-7 chat with selected investor (history in this drawer) */}
      {showChatDrawer && chatTarget && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex justify-end">
          <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
            <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Direct chat</p>
                <h3 className="font-bold text-slate-900 text-sm truncate">{chatTarget.name || 'Investor'}</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowChatDrawer(false); setChatTarget(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10">No messages yet. Start the thread.</p>
              ) : (
                chatMessages.map((m) => {
                  const me = String(currentUser?.id || currentUser?._id || user.id);
                  const mine = String(m.sender_id || m.senderId || '') === me;
                  return (
                    <div key={m.id || m._id || m.created_at} className={`max-w-[85%] ${mine ? 'ml-auto' : ''}`}>
                      <div className={`rounded-2xl px-3.5 py-2.5 text-xs ${mine ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-800'}`}>
                        {m.text || m.message}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono mt-1 block">{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</span>
                    </div>
                  );
                })
              )}
            </div>
            <form onSubmit={handleSendChatMessage} className="p-3 border-t border-slate-200 flex gap-2 shrink-0">
              <input
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button type="submit" className="px-4 py-2.5 bg-[#047857] text-white text-xs font-semibold rounded-xl cursor-pointer">
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

