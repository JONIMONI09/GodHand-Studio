import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Users, 
  Key, 
  CheckCircle, 
  Ban, 
  Trash2, 
  AlertTriangle, 
  RefreshCw, 
  FileWarning, 
  User as UserIcon, 
  Search,
  MessageSquare,
  Send,
  AtSign,
  Crown,
  Lock,
  LifeBuoy,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  UserCheck,
  UserX,
  FileText,
  AlertCircle,
  HelpCircle,
  Hash,
  Eye,
  Settings,
  Cpu,
  Download,
  Terminal,
  Layers,
  PanelLeftClose,
  PanelLeft,
  UserPlus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { 
  collection, 
  query, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  setDoc, 
  addDoc,
  deleteDoc,
  onSnapshot, 
  where, 
  serverTimestamp, 
  deleteField,
  orderBy,
  limit,
  arrayUnion
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useAuth, OWNER_EMAIL } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/translations';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { SystemCoreMods } from '../components/admin/SystemCoreMods';
import { generateTicketHtml } from '../lib/ticketHtmlExport';
import { logger } from '../lib/logger';

export default function Admin() {
  const { user, role, isOwner, isAdmin, isMod, isSupporter, isStaff, loading, username } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'chat' | 'tickets' | 'moderation' | 'team' | 'audit' | 'system' | 'arm32mod'>('chat');

  // ARM32 Fix Mod State
  const [arm32Status, setArm32Status] = useState<'idle' | 'building' | 'success' | 'failed'>('idle');
  const [arm32Logs, setArm32Logs] = useState<string[]>([]);
  const [arm32JarExists, setArm32JarExists] = useState(false);
  const [arm32JarSize, setArm32JarSize] = useState(0);
  const [buildingArm32, setBuildingArm32] = useState(false);

  // Base state
  const [users, setUsers] = useState<any[]>([]);
  const [resets, setResets] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [quarantinedProjects, setQuarantinedProjects] = useState<any[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  // System status toggle
  const [showOfflinePrompt, setShowOfflinePrompt] = useState(false);
  const [offlinePassword, setOfflinePassword] = useState('');
  const [offlineError, setOfflineError] = useState('');

  // Password reset code
  const [inputCode, setInputCode] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  // Delete project
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // User details modal
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [loadingUserProjects, setLoadingUserProjects] = useState(false);

  // Chat State (Discord-style)
  const [activeChannel, setActiveChannel] = useState<'allgemein-team' | 'support-desk' | 'admin-only' | 'owner-audit-log'>('allgemein-team');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [mentionMenu, setMentionMenu] = useState<{ open: boolean; search: string }>({ open: false, search: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ticket Center State
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [reasonModal, setReasonModal] = useState<{
    open: boolean;
    title: string;
    actionType: 'status_change' | 'delete_team_member' | 'assign_member' | 'delete_ticket' | 'delete_quarantined_project' | 'ban_user';
    targetId: string;
    extraData?: any;
    reason: string;
  }>({
    open: false,
    title: '',
    actionType: 'status_change',
    targetId: '',
    reason: ''
  });

  // Resizable & Collapsible Admin Sidebar State
  const [adminSidebarWidth, setAdminSidebarWidth] = useState<number>(230);
  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState<boolean>(false);
  const [isResizingAdminSidebar, setIsResizingAdminSidebar] = useState<boolean>(false);

  // Ticket Invitation Modal State
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteEmailOrUsername, setInviteEmailOrUsername] = useState<string>('');
  const [isInvitingUser, setIsInvitingUser] = useState<boolean>(false);

  // Assign dropdown state
  const [assignDropdownTicketId, setAssignDropdownTicketId] = useState<string | null>(null);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Safe Audit Log Writer
  const recordAuditAction = async (action: string, targetUserOrItem: string, reason: string, details?: any) => {
    try {
      logger.audit(action, user?.email || 'Unknown', { target: targetUserOrItem, reason, details });
      const logEntry = {
        action,
        target: targetUserOrItem,
        actorId: user?.uid,
        actorEmail: user?.email,
        actorUsername: username || user?.displayName || user?.email?.split('@')[0] || 'Staff',
        actorRole: role,
        reason: reason.trim(),
        details: details || null,
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'audit_logs'), logEntry);

      // Also post a formatted notification into #owner-audit-log
      await addDoc(collection(db, 'team_messages'), {
        channel: 'owner-audit-log',
        senderId: 'SYSTEM',
        senderName: 'GodHand Audit Engine',
        senderRole: 'system',
        text: `🛡️ **AUDIT EVENT**: \`${action}\` ausgeführt von **${user?.email}** (${role})\n🎯 **Ziel**: ${targetUserOrItem}\n📝 **Begründung**: ${reason}`,
        isSystem: true,
        createdAt: serverTimestamp()
      });
    } catch (err: any) {
      logger.error('Admin:recordAuditAction', err);
    }
  };

  // Subscriptions & Initial fetch
  useEffect(() => {
    if (!isStaff) return;
    logger.info('Admin', `Initializing Team Dashboard for ${user?.email} (Role: ${role})`);
    setLoadingData(true);

    // Fetch users
    const fetchUsers = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e: any) {
        logger.error('Admin:fetchUsers', e);
      }
    };
    fetchUsers();

    // System settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
      if (docSnap.exists()) {
        setSystemSettings(docSnap.data());
      } else {
        setSystemSettings({ isOffline: false });
      }
    });

    // Reports
    const unsubReports = onSnapshot(
      query(collection(db, 'reports')),
      (snapshot) => {
        setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingData(false);
      },
      (error) => logger.error('Admin:reports', error)
    );

    // Tickets
    const unsubTickets = onSnapshot(
      query(collection(db, 'tickets')),
      (snapshot) => {
        const tDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        tDocs.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setTickets(tDocs);
      },
      (error) => logger.error('Admin:tickets', error)
    );

    // Quarantined Projects
    const unsubQuarantined = onSnapshot(
      query(collection(db, 'projects'), where('status', '==', 'quarantined')),
      (snapshot) => {
        setQuarantinedProjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    // Deleted Projects (Admin / Owner)
    let unsubDeleted = () => {};
    if (isAdmin) {
      unsubDeleted = onSnapshot(
        query(collection(db, 'projects'), where('status', '==', 'deleted')),
        (snapshot) => {
          const filtered = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          filtered.sort((a: any, b: any) => {
            const timeA = a.deletedAt?.toMillis ? a.deletedAt.toMillis() : 0;
            const timeB = b.deletedAt?.toMillis ? b.deletedAt.toMillis() : 0;
            return timeB - timeA;
          });
          setDeletedProjects(filtered);
        }
      );
    }

    // Password resets (Admin / Owner)
    let unsubResets = () => {};
    if (isAdmin) {
      unsubResets = onSnapshot(
        query(collection(db, 'password_resets'), where('status', '==', 'pending')),
        (snapshot) => {
          setResets(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      );
    }

    // Audit logs (Owner / Admin)
    let unsubAudit = () => {};
    if (isOwner || isAdmin) {
      unsubAudit = onSnapshot(
        query(collection(db, 'audit_logs'), limit(100)),
        (snapshot) => {
          const aDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          aDocs.sort((a: any, b: any) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
          setAuditLogs(aDocs);
        },
        (error) => logger.error('Admin:auditLogs', error)
      );
    }

    return () => {
      unsubSettings();
      unsubReports();
      unsubTickets();
      unsubQuarantined();
      unsubDeleted();
      unsubResets();
      unsubAudit();
    };
  }, [isStaff, role, isAdmin, isOwner]);

  // Subscribe to Chat Channel Messages
  useEffect(() => {
    if (!isStaff) return;
    // Check permission for channel
    if (activeChannel === 'owner-audit-log' && !isOwner) {
      setActiveChannel('allgemein-team');
      return;
    }
    if (activeChannel === 'admin-only' && !isAdmin) {
      setActiveChannel('allgemein-team');
      return;
    }

    logger.debug('Admin:Chat', `Subscribing to channel: #${activeChannel}`);
    const q = query(
      collection(db, 'team_messages'),
      where('channel', '==', activeChannel)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      msgs.sort((a: any, b: any) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
      setChatMessages(msgs);
      setTimeout(scrollToBottom, 100);
    }, (error) => {
      logger.error('Admin:Chat:subscribe', error);
    });

    return () => unsubscribe();
  }, [activeChannel, isStaff, isOwner, isAdmin]);

  // Subscribe to Ticket Messages when a ticket is opened
  useEffect(() => {
    if (!selectedTicket?.id) return;
    logger.debug('Admin:Ticket', `Subscribing to ticket thread: ${selectedTicket.id}`);
    const q = query(
      collection(db, `tickets/${selectedTicket.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTicketMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      logger.error('Admin:Ticket:messages', error);
    });

    return () => unsubscribe();
  }, [selectedTicket?.id]);

  // ARM32 Fix Mod Manager API Integration
  const fetchArm32Status = async () => {
    try {
      const res = await fetch('/api/admin/arm32-fix/status');
      if (res.ok) {
        const data = await res.json();
        setArm32Status(data.status);
        setArm32Logs(data.logs || []);
        setArm32JarExists(!!data.jarExists);
        setArm32JarSize(data.jarSize || 0);
      }
    } catch (e) {
      // Pass-through when backend offline
    }
  };

  useEffect(() => {
    if (activeTab === 'arm32mod') {
      fetchArm32Status();
      const interval = setInterval(fetchArm32Status, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleCompileArm32 = async () => {
    setBuildingArm32(true);
    try {
      const res = await fetch('/api/admin/arm32-fix/build', { method: 'POST' });
      if (res.ok) {
        toast.success(t('arm32Compiling'));
        fetchArm32Status();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to start compilation');
      }
    } catch (e: any) {
      toast.error('Network error starting compilation');
    } finally {
      setTimeout(() => setBuildingArm32(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#18181b] text-white">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mr-2" />
        <span className="text-sm font-medium">{t('loading')}</span>
      </div>
    );
  }

  if (!user || !isStaff) {
    return <Navigate to="/" replace />;
  }

  // --- Chat Functions ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    try {
      const text = messageInput.trim();
      setMessageInput('');
      setMentionMenu({ open: false, search: '' });

      await addDoc(collection(db, 'team_messages'), {
        channel: activeChannel,
        senderId: user.uid,
        senderEmail: user.email,
        senderName: username || user.displayName || user.email?.split('@')[0] || 'Staff',
        senderRole: role,
        text,
        createdAt: serverTimestamp()
      });
      logger.info('Admin:Chat', `Message sent to #${activeChannel}`);
    } catch (err: any) {
      logger.error('Admin:Chat:send', err);
      toast.error('Failed to send message: ' + err.message);
    }
  };

  const handleDeleteChatMessage = async (msgId: string) => {
    if (!isAdmin && !isOwner) return;
    try {
      await deleteDoc(doc(db, 'team_messages', msgId));
      toast.success('Message deleted');
    } catch (err: any) {
      logger.error('Admin:Chat:delete', err);
      toast.error('Could not delete message');
    }
  };

  // --- Ticket Actions ---
  const handleClaimTicket = async (ticket: any) => {
    try {
      if (ticket.reporterId === user.uid) {
        toast.error(t('selfHandlingWarning'));
        return;
      }
      const isAlreadyClaimedByMe = ticket.assignedTo === user.uid;
      const newAssignedTo = isAlreadyClaimedByMe ? null : user.uid;
      const newAssignedName = isAlreadyClaimedByMe ? null : (username || user.email?.split('@')[0]);

      await updateDoc(doc(db, 'tickets', ticket.id), {
        assignedTo: newAssignedTo,
        assignedToName: newAssignedName,
        status: isAlreadyClaimedByMe ? 'open' : 'in_progress',
        updatedAt: serverTimestamp()
      });

      // Add system note in ticket thread
      await addDoc(collection(db, `tickets/${ticket.id}/messages`), {
        text: isAlreadyClaimedByMe 
          ? `🔄 Fall freigegeben von ${username || user.email}` 
          : `⚡ Fall übernommen von ${username || user.email}`,
        senderId: 'SYSTEM',
        senderName: 'GodHand System',
        senderRole: 'system',
        isInternal: true,
        createdAt: serverTimestamp()
      });

      toast.success(isAlreadyClaimedByMe ? t('unclaimCase') : t('caseClaimed', { name: newAssignedName || 'Dir' }));
      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket({ ...ticket, assignedTo: newAssignedTo, assignedToName: newAssignedName });
      }
    } catch (err: any) {
      logger.error('Admin:claimTicket', err);
      toast.error('Error claiming ticket: ' + err.message);
    }
  };

  const handleOpenReasonModal = (actionType: 'status_change' | 'delete_team_member' | 'assign_member' | 'delete_ticket' | 'delete_quarantined_project' | 'ban_user', targetId: string, title: string, extraData?: any) => {
    setReasonModal({
      open: true,
      title,
      actionType,
      targetId,
      extraData,
      reason: ''
    });
  };

  const handleExecuteReasonAction = async () => {
    const { actionType, targetId, reason, extraData } = reasonModal;
    if (!reason.trim()) {
      toast.error(t('reasonRequired'));
      return;
    }

    try {
      if (actionType === 'status_change') {
        const { newStatus, ticketTitle } = extraData;
        await updateDoc(doc(db, 'tickets', targetId), {
          status: newStatus,
          resolutionReason: reason.trim(),
          updatedAt: serverTimestamp()
        });

        // Add internal message with reason
        await addDoc(collection(db, `tickets/${targetId}/messages`), {
          text: `📌 Status geändert zu [${newStatus.toUpperCase()}] von ${username || user.email}\nBegründung: ${reason.trim()}`,
          senderId: user.uid,
          senderName: username || user.email?.split('@')[0],
          senderRole: role,
          isInternal: true,
          createdAt: serverTimestamp()
        });

        await recordAuditAction('TICKET_STATUS_CHANGED', `Ticket #${targetId} (${ticketTitle})`, reason, { newStatus });
        toast.success(`Status updated to ${newStatus}`);
        if (selectedTicket?.id === targetId) {
          setSelectedTicket({ ...selectedTicket, status: newStatus, resolutionReason: reason.trim() });
        }
      } else if (actionType === 'delete_team_member') {
        if (!isOwner) {
          toast.error('Only the Owner can delete team members');
          return;
        }

        const targetUser = users.find(u => u.id === targetId);
        await updateDoc(doc(db, 'users', targetId), {
          role: 'user',
          updatedAt: serverTimestamp()
        });

        await recordAuditAction(
          'TEAM_MEMBER_REMOVED',
          `${targetUser?.email || targetId} (${targetUser?.role})`,
          reason,
          { previousRole: targetUser?.role }
        );

        setUsers(users.map(u => u.id === targetId ? { ...u, role: 'user' } : u));
        toast.success(t('memberRemovedSuccess'));
      } else if (actionType === 'assign_member') {
        const { memberId, memberName } = extraData;
        await updateDoc(doc(db, 'tickets', targetId), {
          assignedTo: memberId,
          assignedToName: memberName,
          status: 'in_progress',
          updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, `tickets/${targetId}/messages`), {
          text: `🎯 Zugewiesen an @${memberName} durch ${username || user.email}\nNotiz: ${reason.trim()}`,
          senderId: user.uid,
          senderName: username || user.email?.split('@')[0],
          senderRole: role,
          isInternal: true,
          createdAt: serverTimestamp()
        });

        toast.success(t('assignedTo', { name: memberName }));
        if (selectedTicket?.id === targetId) {
          setSelectedTicket({ ...selectedTicket, assignedTo: memberId, assignedToName: memberName });
        }
      } else if (actionType === 'delete_ticket') {
        const { ticketTitle } = extraData || {};
        await updateDoc(doc(db, 'tickets', targetId), {
          status: 'deleted',
          isDeleted: true,
          deletionReason: reason.trim(),
          deletedBy: user.email,
          deletedAt: serverTimestamp()
        });

        await recordAuditAction(
          'TICKET_DELETED',
          `Ticket #${targetId} (${ticketTitle || 'Unknown'})`,
          reason.trim(),
          { ticketTitle }
        );

        toast.success(t('ticketDeletedSuccess') || 'Ticket erfolgreich gelöscht');
        if (selectedTicket?.id === targetId) {
          setSelectedTicket(null);
        }
      } else if (actionType === 'delete_quarantined_project') {
        const { projectName } = extraData || {};
        await updateDoc(doc(db, 'projects', targetId), {
          status: 'deleted',
          isDeleted: true,
          deletionReason: reason.trim(),
          deletedBy: user.email,
          deletedAt: serverTimestamp()
        });

        await recordAuditAction(
          'QUARANTINED_PROJECT_DELETED',
          `Project #${targetId} (${projectName || 'Unknown'})`,
          reason.trim(),
          { projectName }
        );

        toast.success(language === 'de' ? 'Quarantäne-Projekt endgültig gelöscht' : 'Quarantined project permanently deleted');
      } else if (actionType === 'ban_user') {
        const { projectName } = extraData || {};
        const targetUserObj = users.find(u => u.id === targetId);
        await updateDoc(doc(db, 'users', targetId), {
          isBanned: true,
          role: 'banned',
          banReason: reason.trim(),
          bannedBy: user.email,
          bannedAt: serverTimestamp()
        });

        await recordAuditAction(
          'USER_BANNED',
          `${targetUserObj?.email || targetId}`,
          reason.trim(),
          { projectName }
        );

        setUsers(prev => prev.map(u => u.id === targetId ? { ...u, isBanned: true, role: 'banned' } : u));
        toast.success(t('userBannedSuccess') || 'Benutzer erfolgreich gesperrt');
      }

      setReasonModal({ open: false, title: '', actionType: 'status_change', targetId: '', reason: '' });
    } catch (err: any) {
      logger.error('Admin:handleExecuteReasonAction', err);
      toast.error('Operation failed: ' + err.message);
    }
  };

  // Resize listener for Admin Sidebar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingAdminSidebar) {
        const newWidth = Math.min(Math.max(160, e.clientX), 480);
        setAdminSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizingAdminSidebar) {
        setIsResizingAdminSidebar(false);
      }
    };

    if (isResizingAdminSidebar) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAdminSidebar]);

  // Export ticket to standalone styled HTML
  const handleDownloadTicketHtml = (ticket: any, messages: any[]) => {
    try {
      const html = generateTicketHtml(ticket, messages, false);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GodHand-Ticket-${(ticket.id || 'export').slice(0, 8)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'de' ? 'Ticket als HTML exportiert' : 'Ticket exported as HTML');
    } catch (e: any) {
      toast.error('HTML export error: ' + e.message);
    }
  };

  // Invite team member or user into ticket
  const handleInviteUserToTicket = async (ticketId: string, emailOrName: string) => {
    if (!emailOrName.trim()) return;
    setIsInvitingUser(true);
    try {
      const clean = emailOrName.trim();
      await updateDoc(doc(db, 'tickets', ticketId), {
        invitedUsers: arrayUnion({
          identifier: clean,
          invitedBy: user.email,
          invitedByName: username || user.email?.split('@')[0],
          invitedAt: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, `tickets/${ticketId}/messages`), {
        text: `👥 @${clean} wurde von ${username || user.email?.split('@')[0]} (${role}) ins Ticket eingeladen.`,
        senderId: 'SYSTEM',
        senderName: 'GodHand Support Engine',
        senderRole: 'system',
        isInternal: false,
        createdAt: serverTimestamp()
      });

      toast.success(language === 'de' ? `Nutzer "${clean}" erfolgreich eingeladen!` : `User "${clean}" invited!`);
      setShowInviteModal(false);
      setInviteEmailOrUsername('');
    } catch (err: any) {
      toast.error('Invite failed: ' + err.message);
    } finally {
      setIsInvitingUser(false);
    }
  };

  const handleSendTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketReplyText.trim() || !selectedTicket?.id) return;

    try {
      await addDoc(collection(db, `tickets/${selectedTicket.id}/messages`), {
        text: ticketReplyText.trim(),
        senderId: user.uid,
        senderName: username || user.email?.split('@')[0],
        senderRole: role,
        isInternal: isInternalNote,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'tickets', selectedTicket.id), {
        updatedAt: serverTimestamp()
      });

      setTicketReplyText('');
      toast.success(isInternalNote ? t('internalNote') + ' gespeichert' : t('sendToUser') + ' gesendet');
    } catch (err: any) {
      logger.error('Admin:sendTicketReply', err);
      toast.error('Failed to post reply: ' + err.message);
    }
  };

  // Filter staff members for mentions and assignments
  const staffMembers = users.filter(u => u.role === 'owner' || u.role === 'admin' || u.role === 'mod' || u.role === 'supporter' || u.email === OWNER_EMAIL);

  return (
    <div className="flex flex-col h-screen bg-[#131316] text-slate-100 font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-[#25252b] bg-[#1a1a20] px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsAdminSidebarCollapsed(prev => !prev)}
            className="p-1.5 hover:bg-[#282834] rounded-lg text-slate-300 hover:text-white transition-colors"
            title={isAdminSidebarCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
          >
            {isAdminSidebarCollapsed ? (
              <PanelLeft className="h-5 w-5 text-indigo-400" />
            ) : (
              <PanelLeftClose className="h-5 w-5 text-slate-400" />
            )}
          </button>
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-md text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-white tracking-wide">
                {t('teamDashboard')}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isOwner ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                role === 'admin' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' :
                role === 'mod' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              }`}>
                {isOwner ? '👑 Owner' : role === 'admin' ? '🛡️ Admin' : role === 'mod' ? '⚡ Moderator' : '🎧 Supporter'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              GodHand Staff Hub & Operations
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Language Switch */}
          <LanguageSwitcher />

          <button
            onClick={() => navigate('/')}
            className="px-3 py-1.5 bg-[#25252d] hover:bg-[#32323c] text-xs font-semibold text-slate-200 rounded-lg border border-[#353540] transition-colors"
          >
            {t('backToDashboard')}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation (Resizable & Collapsible) */}
        {!isAdminSidebarCollapsed && (
          <aside 
            style={{ width: `${adminSidebarWidth}px` }}
            className="bg-[#17171d] border-r border-[#25252b] p-3 flex flex-col justify-between shrink-0 select-none transition-width"
          >
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('chat')}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#202028]'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                <span>{t('staffChat')}</span>
              </button>

              <button
                onClick={() => setActiveTab('tickets')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'tickets'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#202028]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <LifeBuoy className="h-4 w-4" />
                  <span>{t('ticketCenter')}</span>
                </div>
                {tickets.filter(t => t.status === 'open').length > 0 && (
                  <span className="bg-amber-500 text-black px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                    {tickets.filter(t => t.status === 'open').length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('moderation')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'moderation'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#202028]'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <FileWarning className="h-4 w-4" />
                  <span>{t('modModeration')}</span>
                </div>
                {reports.filter(r => r.status === 'pending').length > 0 && (
                  <span className="bg-rose-500 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                    {reports.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>

              {/* Admin+ tabs */}
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('team')}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'team'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#202028]'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>{t('teamManagement')}</span>
                </button>
              )}

              {/* Owner Exclusive tab */}
              {isOwner && (
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'audit'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-400 hover:text-amber-300 hover:bg-amber-950/20'
                  }`}
                >
                  <Crown className="h-4 w-4 text-amber-300" />
                  <span>{t('ownerAuditLog')}</span>
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => setActiveTab('system')}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'system'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#202028]'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span>System</span>
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => setActiveTab('arm32mod')}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'arm32mod'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-400/90 hover:text-amber-300 hover:bg-amber-950/20'
                  }`}
                >
                  <Cpu className="h-4 w-4" />
                  <span>{t('systemCoreModsTab')}</span>
                </button>
              )}
            </nav>

            <div className="p-3 bg-[#1e1e26] border border-[#2d2d38] rounded-xl space-y-1 text-[11px] text-slate-400">
              <div className="font-semibold text-slate-300 truncate">{username || user.email}</div>
              <div className="text-slate-500 truncate">{user.email}</div>
            </div>
          </aside>
        )}

        {/* Draggable Resizer Bar for Admin Sidebar */}
        {!isAdminSidebarCollapsed && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingAdminSidebar(true);
            }}
            onDoubleClick={() => setAdminSidebarWidth(230)}
            className="w-1.5 hover:w-2 bg-[#1c1c24] hover:bg-indigo-500 active:bg-indigo-600 cursor-col-resize transition-all shrink-0 flex items-center justify-center group z-10 select-none"
            title={t('dragToResizeSidebar')}
          >
            <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
          </div>
        )}

        {/* Tab Content Body */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#141418]">
          {/* ================= TAB 1: DISCORD-STYLE STAFF CHAT ================= */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Channel list */}
              <div className="w-52 bg-[#191920] border-r border-[#25252b] p-3 flex flex-col space-y-2 shrink-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  Kanäle
                </span>
                <div className="space-y-1">
                  <button
                    onClick={() => setActiveChannel('allgemein-team')}
                    className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeChannel === 'allgemein-team'
                        ? 'bg-[#292934] text-white font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-[#202028]'
                    }`}
                  >
                    <Hash className="h-3.5 w-3.5 text-slate-400" />
                    <span>allgemein-team</span>
                  </button>

                  <button
                    onClick={() => setActiveChannel('support-desk')}
                    className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeChannel === 'support-desk'
                        ? 'bg-[#292934] text-white font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-[#202028]'
                    }`}
                  >
                    <Hash className="h-3.5 w-3.5 text-sky-400" />
                    <span>support-desk</span>
                  </button>

                  {/* Admin Only */}
                  <button
                    disabled={!isAdmin}
                    onClick={() => setActiveChannel('admin-only')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      !isAdmin ? 'opacity-40 cursor-not-allowed text-slate-500' :
                      activeChannel === 'admin-only'
                        ? 'bg-[#292934] text-white font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-[#202028]'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Hash className="h-3.5 w-3.5 text-indigo-400" />
                      <span>admin-only</span>
                    </div>
                    {!isAdmin && <Lock className="h-3 w-3" />}
                  </button>

                  {/* Owner Audit Log */}
                  <button
                    disabled={!isOwner}
                    onClick={() => setActiveChannel('owner-audit-log')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      !isOwner ? 'opacity-40 cursor-not-allowed text-slate-500' :
                      activeChannel === 'owner-audit-log'
                        ? 'bg-amber-950/40 text-amber-300 font-semibold border border-amber-500/30'
                        : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/20'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Crown className="h-3.5 w-3.5 text-amber-400" />
                      <span>owner-audit-log</span>
                    </div>
                    {!isOwner && <Lock className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {/* Chat Messages Feed */}
              <div className="flex-1 flex flex-col bg-[#141418] overflow-hidden">
                {/* Channel Header */}
                <div className="h-11 px-4 border-b border-[#25252b] flex items-center justify-between bg-[#181820]">
                  <div className="flex items-center space-x-2">
                    <Hash className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white tracking-wide">#{activeChannel}</span>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      {activeChannel === 'allgemein-team' ? t('channelDescGeneral') :
                       activeChannel === 'support-desk' ? t('channelDescSupport') :
                       activeChannel === 'admin-only' ? t('channelDescAdmin') :
                       t('channelDescOwner')}
                    </span>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-16 space-y-2 text-slate-500">
                      <Hash className="h-8 w-8 mx-auto opacity-40" />
                      <p className="text-xs">{t('channelWelcomeEmpty', { channel: activeChannel })}</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isSystem = msg.isSystem || msg.senderRole === 'system';
                      return (
                        <div
                          key={msg.id}
                          className={`group flex items-start space-x-3 p-2 rounded-xl transition-colors ${
                            isSystem ? 'bg-amber-950/20 border border-amber-500/20' : 'hover:bg-[#1a1a22]'
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isSystem ? 'bg-amber-600 text-white' :
                            msg.senderRole === 'owner' ? 'bg-amber-500 text-black' :
                            msg.senderRole === 'admin' ? 'bg-indigo-600 text-white' :
                            msg.senderRole === 'mod' ? 'bg-emerald-600 text-white' :
                            'bg-sky-600 text-white'
                          }`}>
                            {isSystem ? '🛡️' : (msg.senderName || 'U').charAt(0).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-white">{msg.senderName}</span>
                              <span className="text-[10px] text-slate-500">
                                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'gerade eben'}
                              </span>
                              {msg.senderRole && !isSystem && (
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  msg.senderRole === 'owner' ? 'bg-amber-500/20 text-amber-300' :
                                  msg.senderRole === 'admin' ? 'bg-indigo-500/20 text-indigo-300' :
                                  'bg-emerald-500/20 text-emerald-300'
                                }`}>
                                  {msg.senderRole}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed break-words">
                              {msg.text}
                            </div>
                          </div>

                          {(isAdmin || isOwner) && !isSystem && (
                            <button
                              onClick={() => handleDeleteChatMessage(msg.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition-all"
                              title={t('delete')}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Box with @ Mention dropdown */}
                <div className="p-3 bg-[#191920] border-t border-[#25252b] relative">
                  {mentionMenu.open && (
                    <div className="absolute bottom-full left-4 mb-2 bg-[#22222b] border border-[#353544] rounded-xl shadow-2xl p-1.5 w-60 z-30 max-h-48 overflow-y-auto">
                      <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase">
                        Teammitglieder erwähnen
                      </div>
                      {staffMembers
                        .filter(m => (m.username || m.email || '').toLowerCase().includes(mentionMenu.search.toLowerCase()))
                        .map(m => (
                          <div
                            key={m.id}
                            onClick={() => {
                              const mentionTag = `@${m.username || m.email?.split('@')[0]} `;
                              setMessageInput(prev => prev.replace(/@\w*$/, mentionTag));
                              setMentionMenu({ open: false, search: '' });
                            }}
                            className="flex items-center space-x-2 px-2 py-1.5 hover:bg-indigo-600 rounded-lg text-xs cursor-pointer transition-colors"
                          >
                            <span className="font-semibold text-white">@{m.username || m.email?.split('@')[0]}</span>
                            <span className="text-[10px] text-slate-400">({m.role})</span>
                          </div>
                        ))}
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMessageInput(val);
                          const lastWord = val.split(' ').pop() || '';
                          if (lastWord.startsWith('@')) {
                            setMentionMenu({ open: true, search: lastWord.slice(1) });
                          } else {
                            setMentionMenu({ open: false, search: '' });
                          }
                        }}
                        placeholder={t('typeMessagePlaceholder', { channel: '#' + activeChannel })}
                        className="w-full bg-[#131317] border border-[#2d2d38] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!messageInput.trim()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Senden</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Discord Right Staff Member List */}
              <div className="w-56 bg-[#17171d] border-l border-[#25252b] p-3 hidden md:flex flex-col space-y-3 shrink-0 overflow-y-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  Team ({staffMembers.length})
                </span>
                <div className="space-y-1">
                  {staffMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-[#202028] text-xs transition-colors"
                    >
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                        m.role === 'owner' || m.email === OWNER_EMAIL ? 'bg-amber-500' :
                        m.role === 'admin' ? 'bg-indigo-600' :
                        m.role === 'mod' ? 'bg-emerald-600' : 'bg-sky-600'
                      }`}>
                        {(m.username || m.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate min-w-0">
                        <div className="font-semibold text-slate-200 truncate text-[11px]">
                          {m.username || m.email?.split('@')[0]}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase font-medium">
                          {m.email === OWNER_EMAIL ? '👑 Owner' : m.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: TICKETS & REPORTS HUB ================= */}
          {activeTab === 'tickets' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Ticket Queue List */}
              <div className="w-80 bg-[#17171d] border-r border-[#25252b] flex flex-col shrink-0">
                <div className="p-3 border-b border-[#25252b] space-y-2 bg-[#1b1b22]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white tracking-wide">
                      {t('ticketCenter')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {t('ticketsCount', { count: String(tickets.length) })}
                    </span>
                  </div>
                  {/* Status filter pills */}
                  <div className="grid grid-cols-5 gap-1 text-[10px] font-semibold text-center">
                    {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setTicketFilter(f)}
                        className={`py-1 rounded-md transition-colors ${
                          ticketFilter === f ? 'bg-indigo-600 text-white shadow-sm' : 'bg-[#25252f] text-slate-400 hover:text-white'
                        }`}
                      >
                        {f === 'all' ? t('filterAll') :
                         f === 'open' ? t('filterOpen') :
                         f === 'in_progress' ? t('filterInProgress') :
                         f === 'resolved' ? t('filterResolved') :
                         t('filterClosed')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {tickets
                    .filter(t => ticketFilter === 'all' || t.status === ticketFilter)
                    .map((tItem) => {
                      const isSelected = selectedTicket?.id === tItem.id;
                      return (
                        <div
                          key={tItem.id}
                          onClick={() => setSelectedTicket(tItem)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                            isSelected
                              ? 'bg-[#252533] border-indigo-500 shadow-md'
                              : 'bg-[#1e1e26] border-[#292934] hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-white line-clamp-1 pr-2">
                              {tItem.title}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold shrink-0 border ${
                              tItem.status === 'open' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                              tItem.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                              tItem.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                              'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}>
                              {tItem.status === 'open' ? t('statusOpen') :
                               tItem.status === 'in_progress' ? t('statusInProgress') :
                               tItem.status === 'resolved' ? t('statusResolved') :
                               t('statusClosed')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                            {tItem.description}
                          </p>
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#292934]">
                            <span className="flex items-center space-x-1">
                              <span className="text-slate-500">{t('from')}</span>
                              <span className="font-semibold text-cyan-300 bg-cyan-950/50 px-1.5 py-0.2 rounded border border-cyan-500/30">
                                👤 {tItem.reporterUsername || tItem.reporterEmail}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              {tItem.assignedToName ? `👤 ${tItem.assignedToName}` : `❌ ${t('unassigned')}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Ticket Details & Action Thread */}
              <div className="flex-1 flex flex-col bg-[#141418] overflow-hidden">
                {selectedTicket ? (
                  <>
                    {/* Ticket Header & Action Bar */}
                    <div className="p-4 bg-[#1b1b22] border-b border-[#25252b] space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <h2 className="text-sm font-bold text-white">{selectedTicket.title}</h2>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300">
                              {t('categoryLabel')} {selectedTicket.category || 'Support'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              selectedTicket.status === 'open' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                              selectedTicket.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                              selectedTicket.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                              'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}>
                              {selectedTicket.status === 'open' ? t('statusOpen') :
                               selectedTicket.status === 'in_progress' ? t('statusInProgress') :
                               selectedTicket.status === 'resolved' ? t('statusResolved') :
                               t('statusClosed')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {t('createdBy')}{' '}
                            <span className="text-cyan-300 font-bold bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-500/30">
                              {selectedTicket.reporterEmail}
                            </span>{' '}
                            {t('atDate')}{' '}
                            {selectedTicket.createdAt?.toDate ? selectedTicket.createdAt.toDate().toLocaleString() : 'N/A'}
                          </p>
                        </div>

                        {/* Top action buttons */}
                        <div className="flex items-center space-x-2">
                          {(() => {
                            const isMyTicket = selectedTicket.reporterId === user.uid;
                            return (
                              <button
                                disabled={isMyTicket}
                                onClick={() => !isMyTicket && handleClaimTicket(selectedTicket)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                                  isMyTicket
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                    : selectedTicket.assignedTo === user.uid
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                }`}
                                title={isMyTicket ? t('selfHandlingWarning') : ''}
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>{isMyTicket ? t('selfHandlingWarning') : selectedTicket.assignedTo === user.uid ? t('unclaimCase') : t('claimCase')}</span>
                              </button>
                            );
                          })()}

                          {/* Assign to another member */}
                          <div className="relative">
                            <button
                              onClick={() => setAssignDropdownTicketId(assignDropdownTicketId ? null : selectedTicket.id)}
                              className="px-3 py-1.5 bg-[#292934] hover:bg-[#343444] text-slate-200 border border-[#3a3a4c] rounded-lg text-xs font-semibold flex items-center space-x-1.5"
                            >
                              <AtSign className="h-3.5 w-3.5 text-indigo-400" />
                              <span>{t('assign')}</span>
                            </button>

                            {assignDropdownTicketId === selectedTicket.id && (
                              <div className="absolute right-0 top-full mt-1 bg-[#22222b] border border-[#353544] rounded-xl shadow-2xl p-1 w-52 z-30 space-y-0.5">
                                <span className="block px-2 py-1 text-[10px] font-bold text-slate-400 uppercase">
                                  {t('selectTeamMember')}
                                </span>
                                {staffMembers.map(m => {
                                  const isReporter = m.id === selectedTicket.reporterId;
                                  return (
                                    <button
                                      key={m.id}
                                      disabled={isReporter}
                                      onClick={() => {
                                        if (isReporter) {
                                          toast.error(t('selfHandlingWarning'));
                                          return;
                                        }
                                        setAssignDropdownTicketId(null);
                                        handleOpenReasonModal(
                                          'assign_member',
                                          selectedTicket.id,
                                          `${t('assignCase')} @${m.username || m.email}`,
                                          { memberId: m.id, memberName: m.username || m.email?.split('@')[0] }
                                        );
                                      }}
                                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                                        isReporter ? 'opacity-40 cursor-not-allowed bg-black/20 text-slate-500' : 'hover:bg-indigo-600 text-slate-200'
                                      }`}
                                      title={isReporter ? t('selfHandlingWarning') : ''}
                                    >
                                      <span>{m.username || m.email?.split('@')[0]} {isReporter ? `(${t('ticketRequesterBadge')})` : ''}</span>
                                      <span className="text-[10px] text-slate-400">{m.role}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Status actions: Resolve and Close with mandatory reasons */}
                          {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                            <>
                              <button
                                onClick={() => handleOpenReasonModal(
                                  'status_change',
                                  selectedTicket.id,
                                  t('resolveCase'),
                                  { newStatus: 'resolved', ticketTitle: selectedTicket.title }
                                )}
                                className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1.5"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{t('resolveCase')}</span>
                              </button>
                              <button
                                onClick={() => handleOpenReasonModal(
                                  'status_change',
                                  selectedTicket.id,
                                  t('closeTicket'),
                                  { newStatus: 'closed', ticketTitle: selectedTicket.title }
                                )}
                                className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1.5"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{t('closeTicket')}</span>
                              </button>
                            </>
                          )}

                          {/* Invite user to ticket button */}
                          <button
                            onClick={() => {
                              setInviteEmailOrUsername('');
                              setShowInviteModal(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1.5"
                            title={t('inviteToTicket')}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>{t('inviteToTicket')}</span>
                          </button>

                          {/* HTML Export button */}
                          <button
                            onClick={() => handleDownloadTicketHtml(selectedTicket, ticketMessages)}
                            className="px-3 py-1.5 bg-[#262632] hover:bg-[#323242] text-slate-200 border border-[#39394c] rounded-lg text-xs font-semibold flex items-center space-x-1.5"
                            title={t('downloadTicketHtml')}
                          >
                            <Download className="h-3.5 w-3.5 text-emerald-400" />
                            <span>HTML</span>
                          </button>

                          {/* Delete Ticket with mandatory reason */}
                          {(isAdmin || isOwner) && (
                            <button
                              onClick={() => handleOpenReasonModal(
                                'delete_ticket',
                                selectedTicket.id,
                                t('deleteTicketWithReason') || 'Ticket löschen (Begründung erforderlich)',
                                { ticketTitle: selectedTicket.title }
                              )}
                              className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1.5"
                              title={t('deleteTicket')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{t('deleteTicket')}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Assignment, Resolution Notice & Invited Members */}
                      <div className="flex items-center flex-wrap gap-3 text-xs pt-2 border-t border-[#292934]">
                        <span className="text-slate-400">
                          {t('currentlyAssigned')} <strong className="text-white">{selectedTicket.assignedToName || t('unassigned')}</strong>
                        </span>
                        {selectedTicket.resolutionReason && (
                          <span className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20">
                            {t('reasonLabel')} {selectedTicket.resolutionReason}
                          </span>
                        )}
                        {selectedTicket.invitedUsers && selectedTicket.invitedUsers.length > 0 && (
                          <div className="flex items-center space-x-1.5 text-slate-400">
                            <span className="text-slate-500 font-medium">{t('invitedUsers')}:</span>
                            {selectedTicket.invitedUsers.map((inv: any, idx: number) => (
                              <span key={idx} className="bg-indigo-950/70 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded text-[10px] font-mono">
                                @{inv.identifier}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Messages & Internal Notes Feed */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {/* Ticket Original Description */}
                      <div className="p-3 bg-[#1e1e26] border border-[#2d2d38] rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{t('originalDescription')}</span>
                        <p className="text-xs text-slate-200 whitespace-pre-wrap">{selectedTicket.description}</p>
                      </div>

                      {ticketMessages.map((msg) => {
                        const isRequester = msg.senderId === selectedTicket.reporterId || msg.senderRole === 'user';
                        const isInternal = msg.isInternal;

                        return (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-xl border text-xs space-y-1 ${
                              isInternal
                                ? 'bg-amber-950/25 border-amber-500/35 text-amber-200 shadow-sm'
                                : isRequester
                                ? 'bg-[#0a2327] border-cyan-500/40 text-cyan-100 shadow-sm'
                                : 'bg-[#1b1b26] border-indigo-500/30 text-slate-200 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-white flex items-center space-x-1.5">
                                <span className={isRequester ? 'text-cyan-300' : 'text-slate-200'}>{msg.senderName}</span>
                                {isInternal ? (
                                  <span className="bg-amber-500/30 text-amber-300 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase">
                                    🔒 {t('internalNoteBadge')}
                                  </span>
                                ) : isRequester ? (
                                  <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                    {t('ticketRequesterBadge')}
                                  </span>
                                ) : (
                                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                    {t('staffSupportBadge')}
                                  </span>
                                )}
                              </span>
                              <span className="text-slate-500">
                                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Reply form or Closed status */}
                    {selectedTicket.status === 'resolved' || selectedTicket.status === 'closed' ? (
                      <div className="p-3 bg-[#1b1b22] border-t border-[#25252b] flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span>{t('ticketClosedNotice')}</span>
                        </div>
                        <button
                          onClick={() => handleOpenReasonModal('status_change', selectedTicket.id, t('reopenTicket'), { newStatus: 'open', ticketTitle: selectedTicket.title })}
                          className="px-3 py-1.5 bg-[#252530] hover:bg-[#2d2d3a] text-slate-200 border border-[#3b3b4a] rounded-lg text-xs font-semibold"
                        >
                          {t('reopenTicket')}
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSendTicketReply} className="p-3 bg-[#1b1b22] border-t border-[#25252b] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isInternalNote}
                              onChange={(e) => setIsInternalNote(e.target.checked)}
                              className="rounded bg-[#131317] border-slate-700 text-indigo-600 focus:ring-0"
                            />
                            <span className={isInternalNote ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                              {t('internalNoteVisible')}
                            </span>
                          </label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={ticketReplyText}
                            onChange={(e) => setTicketReplyText(e.target.value)}
                            placeholder={isInternalNote ? t('internalNotePlaceholder') : t('userReplyPlaceholder')}
                            className="flex-1 bg-[#131317] border border-[#2d2d38] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="submit"
                            disabled={!ticketReplyText.trim()}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors ${
                              isInternalNote
                                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            }`}
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>{isInternalNote ? t('sendInternal') : t('sendToUser')}</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 space-y-2">
                    <LifeBuoy className="h-12 w-12 opacity-30" />
                    <p className="text-xs">{t('selectTicketOrReport')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 3: MOD MODERATION ================= */}
          {activeTab === 'moderation' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-white mb-1">Mod-Moderation & Sicherheitsprüfungen</h2>
                <p className="text-xs text-slate-400">{t('manageReportsSubtitle')}</p>
              </div>

              {/* Pending reports */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <FileWarning className="h-4 w-4 text-rose-400" />
                  <span>Ausstehende Meldungen ({reports.filter(r => r.status === 'pending').length})</span>
                </h3>

                {reports.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="p-4 bg-[#1e1e26] border border-[#292934] rounded-xl text-xs text-slate-400 text-center">
                    Keine ausstehenden Meldungen vorhanden.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {reports.filter(r => r.status === 'pending').map((r) => (
                      <div key={r.id} className="p-4 bg-[#1e1e26] border border-[#292934] rounded-xl space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold text-white">Projekt-ID: {r.projectId}</span>
                            <p className="text-[11px] text-slate-400">Gemeldet von {r.reporterId}</p>
                          </div>
                          <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold">Meldung</span>
                        </div>
                        <p className="text-xs bg-[#131317] p-2.5 rounded-lg border border-[#25252f] text-slate-300">
                          "{r.reason}"
                        </p>
                        <div className="flex justify-end space-x-2 pt-1">
                          <button
                            onClick={async () => {
                              await updateDoc(doc(db, 'reports', r.id), { status: 'resolved', updatedAt: serverTimestamp() });
                              toast.success('Meldung verworfen');
                            }}
                            className="px-3 py-1.5 bg-[#2b2b36] hover:bg-[#383846] text-xs text-slate-300 rounded-lg font-medium"
                          >
                            Verwerfen
                          </button>
                          <button
                            onClick={async () => {
                              await updateDoc(doc(db, 'reports', r.id), { status: 'resolved', updatedAt: serverTimestamp() });
                              await updateDoc(doc(db, 'projects', r.projectId), { status: 'quarantined', updatedAt: serverTimestamp() });
                              toast.success('Projekt in Quarantäne verschoben');
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-xs text-white rounded-lg font-medium"
                          >
                            In Quarantäne verschieben
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quarantined projects */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <span>Projekte in Quarantäne ({quarantinedProjects.length})</span>
                </h3>

                {quarantinedProjects.length === 0 ? (
                  <div className="p-4 bg-[#1e1e26] border border-[#292934] rounded-xl text-xs text-slate-400 text-center">
                    Keine Projekte aktuell in Quarantäne.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {quarantinedProjects.map((p) => {
                      const ownerObj = users.find(u => u.id === p.ownerId);
                      const ownerDisplay = ownerObj ? `${ownerObj.username || ownerObj.email} (${ownerObj.email})` : (p.ownerId || 'Unbekannt');
                      const isOwnerBanned = ownerObj?.isBanned || ownerObj?.role === 'banned';

                      return (
                        <div key={p.id} className="p-4 bg-[#1e1e26] border border-amber-500/30 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{p.name || p.id}</span>
                            <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">Quarantäne</span>
                          </div>

                          <div className="text-[11px] text-slate-400 space-y-1 bg-[#15151c] p-2.5 rounded-lg border border-[#272734]">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="text-slate-500 font-medium">Owner:</span>
                              <span className="font-mono text-cyan-300 font-semibold">{ownerDisplay}</span>
                            </div>
                            {isOwnerBanned && (
                              <div className="text-[10px] text-rose-400 font-bold flex items-center space-x-1">
                                <span>⚠️</span>
                                <span>Owner ist bereits systemweit gesperrt</span>
                              </div>
                            )}
                            {p.reportsCount !== undefined && (
                              <div className="text-[10px] text-slate-400">
                                Vorherige Meldungen: <strong className="text-rose-400">{p.reportsCount}</strong>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end flex-wrap gap-2 pt-1 border-t border-[#292934]">
                            {/* Ban Owner Button */}
                            {p.ownerId && !isOwnerBanned && (
                              <button
                                onClick={() => handleOpenReasonModal(
                                  'ban_user',
                                  p.ownerId,
                                  `Projekt-Owner sperren (${ownerDisplay})`,
                                  { projectName: p.name || p.id }
                                )}
                                className="px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-xs text-rose-300 rounded-lg font-medium flex items-center space-x-1 transition-colors"
                                title={t('banUserFromProject')}
                              >
                                <Ban className="h-3.5 w-3.5" />
                                <span>{t('banUserFromProject')}</span>
                              </button>
                            )}

                            {/* Permanently Delete Project Button */}
                            <button
                              onClick={() => handleOpenReasonModal(
                                'delete_quarantined_project',
                                p.id,
                                `Projekt "${p.name || p.id}" endgültig löschen`,
                                { projectName: p.name || p.id }
                              )}
                              className="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs rounded-lg font-medium flex items-center space-x-1 transition-colors"
                              title={t('deleteQuarantinedProject')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{t('delete')}</span>
                            </button>

                            {/* Unquarantine Button */}
                            <button
                              onClick={async () => {
                                await updateDoc(doc(db, 'projects', p.id), { status: 'active', updatedAt: serverTimestamp() });
                                toast.success('Quarantäne aufgehoben');
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs text-white rounded-lg font-medium shadow-sm transition-colors"
                            >
                              {t('unquarantine')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 4: TEAM MANAGEMENT (Admin / Owner) ================= */}
          {activeTab === 'team' && isAdmin && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Team- & Rechteverwaltung</h2>
                  <p className="text-xs text-slate-400">{t('manageTeamSubtitle')}</p>
                </div>
              </div>

              {/* Members Table */}
              <div className="bg-[#1b1b22] border border-[#25252b] rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#20202a] text-slate-400 text-[11px] uppercase tracking-wider border-b border-[#292934]">
                    <tr>
                      <th className="py-3 px-4">Nutzer</th>
                      <th className="py-3 px-4">E-Mail</th>
                      <th className="py-3 px-4">Rolle</th>
                      <th className="py-3 px-4 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252530]">
                    {users.map((u) => {
                      const isTargetOwner = u.email === OWNER_EMAIL || u.role === 'owner';
                      return (
                        <tr key={u.id} className="hover:bg-[#202028] transition-colors">
                          <td className="py-3 px-4 font-semibold text-white">
                            {u.username || 'Unbekannt'}
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {u.email}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isTargetOwner ? 'bg-amber-500/20 text-amber-300' :
                              u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-300' :
                              u.role === 'mod' ? 'bg-emerald-500/20 text-emerald-300' :
                              u.role === 'supporter' ? 'bg-sky-500/20 text-sky-300' :
                              'bg-slate-700/50 text-slate-400'
                            }`}>
                              {isTargetOwner ? '👑 Owner' : u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5">
                            {!isTargetOwner && (
                              <>
                                <select
                                  value={u.role}
                                  onChange={async (e) => {
                                    const newRole = e.target.value;
                                    await updateDoc(doc(db, 'users', u.id), { role: newRole, updatedAt: serverTimestamp() });
                                    setUsers(users.map(item => item.id === u.id ? { ...item, role: newRole } : item));
                                    await recordAuditAction('ROLE_UPDATED', `${u.email} -> ${newRole}`, 'Rollenwechsel im Team-Dashboard');
                                    toast.success('Rolle aktualisiert');
                                  }}
                                  className="bg-[#2a2a36] text-white text-[11px] px-2 py-1 rounded border border-[#3c3c4c] focus:outline-none"
                                >
                                  <option value="user">User</option>
                                  <option value="supporter">Supporter</option>
                                  <option value="mod">Mod</option>
                                  {isOwner && <option value="admin">Admin</option>}
                                </select>

                                {/* Delete / Remove Team Member (Owner only with mandatory reason) */}
                                {isOwner && (u.role === 'admin' || u.role === 'mod' || u.role === 'supporter') && (
                                  <button
                                    onClick={() => handleOpenReasonModal(
                                      'delete_team_member',
                                      u.id,
                                      `Teammitglied ${u.username || u.email} entfernen`,
                                      { memberEmail: u.email }
                                    )}
                                    className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition-colors"
                                    title={t('deleteMember')}
                                  >
                                    <UserX className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 5: OWNER AUDIT LOG (Owner Only) ================= */}
          {activeTab === 'audit' && isOwner && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#25252b]">
                <div>
                  <h2 className="text-base font-bold text-amber-300 flex items-center space-x-2">
                    <Crown className="h-5 w-5" />
                    <span>Owner Audit-Log & Revisionssicherheit</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Lückenlose Erfassung aller kritischen Vorgänge (Löschungen, Rollenänderungen, Begründungen).
                  </p>
                </div>
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-bold">
                  {auditLogs.length} Einträge
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <ShieldCheck className="h-10 w-10 mx-auto opacity-30 text-amber-400" />
                  <p className="text-xs">Noch keine Revisionsereignisse im Protokoll.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 bg-[#1b1b22] border border-[#292934] rounded-xl space-y-2 hover:border-amber-500/40 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono">
                            {log.action}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            Ziel: {log.target}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A'}
                        </span>
                      </div>

                      <div className="bg-[#131317] p-2 rounded-lg border border-[#24242e] text-xs text-slate-300">
                        <span className="text-amber-400/90 font-medium mr-1.5">Begründung:</span>
                        {log.reason || 'Keine Begründung angegeben'}
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-[#252530]">
                        <span>Akteur: <strong className="text-slate-200">{log.actorEmail}</strong> ({log.actorRole})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 6: SYSTEM SETTINGS ================= */}
          {activeTab === 'system' && isAdmin && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-white mb-1">System-Einstellungen & Wartung</h2>
                <p className="text-xs text-slate-400">{t('manageSystemSubtitle')}</p>
              </div>

              {/* Offline mode toggle */}
              <div className="p-4 bg-[#1b1b22] border border-[#25252b] rounded-2xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Wartungsmodus (Offline-Schaltung)</h3>
                  <p className="text-xs text-slate-400">
                    {systemSettings?.isOffline ? t('systemLockedForUsers') : t('systemPublic')}
                  </p>
                </div>
                <button
                  onClick={() => setShowOfflinePrompt(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    systemSettings?.isOffline
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  {systemSettings?.isOffline ? 'System online schalten' : 'System sperren (Offline)'}
                </button>
              </div>

              {/* Password resets */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Passwort-Reset-Codes einlösen ({resets.length})
                </h3>
                <div className="bg-[#1b1b22] p-4 rounded-2xl border border-[#25252b] space-y-3">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="6-stelligen Code eingeben..."
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value)}
                      className="flex-1 bg-[#131317] border border-[#2d2d38] rounded-xl px-3 py-2 text-xs text-white"
                    />
                    <button
                      onClick={async () => {
                        const target = resets.find(r => r.code === inputCode);
                        if (!target) {
                          toast.error(t('codeNotFound'));
                          return;
                        }
                        await sendPasswordResetEmail(auth, target.email);
                        await updateDoc(doc(db, 'password_resets', target.id), { status: 'completed', updatedAt: serverTimestamp() });
                        toast.success(`Reset-E-Mail gesendet an ${target.email}`);
                        setInputCode('');
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                    >
                      Einlösen & E-Mail senden
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 7: SYSTEM CORE MODS (OWNER WORKSPACE) ================= */}
          {activeTab === 'arm32mod' && isAdmin && (
            <SystemCoreMods />
          )}
        </main>
      </div>

      {/* Mandatory Reason Modal */}
      {reasonModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#1e1e24] border border-[#383844] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-white">
              <AlertCircle className="h-5 w-5 text-indigo-400" />
              <h3 className="text-sm font-bold">{reasonModal.title}</h3>
            </div>
            <p className="text-xs text-slate-400">
              {t('mandatoryReasonNotice')}
            </p>

            <textarea
              required
              rows={4}
              autoFocus
              value={reasonModal.reason}
              onChange={(e) => setReasonModal({ ...reasonModal, reason: e.target.value })}
              placeholder={t('reasonPlaceholder')}
              className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-sans"
            />

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setReasonModal({ ...reasonModal, open: false })}
                className="px-3.5 py-2 bg-[#2a2a34] hover:bg-[#343440] text-xs font-semibold text-slate-300 rounded-xl"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={!reasonModal.reason.trim()}
                onClick={handleExecuteReasonAction}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white rounded-xl shadow-sm"
              >
                Bestätigen & Protokollieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member to Ticket Modal */}
      {showInviteModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#1e1e24] border border-[#383844] rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#2d2d38]">
              <div className="flex items-center space-x-2 text-white">
                <UserPlus className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold">{t('inviteToTicket')}</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {t('enterEmailToInvite')}
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              handleInviteUserToTicket(selectedTicket.id, inviteEmailOrUsername);
            }} className="space-y-3">
              <input
                type="text"
                autoFocus
                required
                placeholder="name@example.com oder Username"
                value={inviteEmailOrUsername}
                onChange={(e) => setInviteEmailOrUsername(e.target.value)}
                className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 bg-[#2a2a34] text-xs font-semibold text-slate-300 rounded-xl hover:bg-[#343440]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isInvitingUser || !inviteEmailOrUsername.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white rounded-xl shadow-sm flex items-center space-x-1.5"
                >
                  {isInvitingUser && <RefreshCw className="h-3 w-3 animate-spin" />}
                  <span>{t('confirm')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Offline Confirmation Modal */}
      {showOfflinePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#1e1e24] border border-[#383844] rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Wartungsmodus umschalten</h3>
            <p className="text-xs text-slate-400">{t('typeConfirmToProceed')}</p>
            <input
              type="text"
              value={offlinePassword}
              onChange={(e) => setOfflinePassword(e.target.value)}
              placeholder="CONFIRM"
              className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl px-3 py-2 text-xs text-white"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowOfflinePrompt(false)}
                className="px-3 py-1.5 bg-[#2a2a34] text-xs text-slate-300 rounded-lg"
              >
                {t('cancel')}
              </button>
              <button
                disabled={offlinePassword !== 'CONFIRM'}
                onClick={async () => {
                  const newStatus = !systemSettings?.isOffline;
                  await setDoc(doc(db, 'settings', 'system'), { isOffline: newStatus, updatedAt: serverTimestamp() }, { merge: true });
                  setShowOfflinePrompt(false);
                  setOfflinePassword('');
                  toast.success(newStatus ? 'System offline' : 'System online');
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs text-white rounded-lg font-semibold"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
