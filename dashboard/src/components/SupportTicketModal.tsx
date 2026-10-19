import React, { useState, useEffect } from 'react';
import { 
  LifeBuoy, 
  Plus, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  MessageSquare, 
  X, 
  ChevronRight,
  ShieldCheck,
  User,
  Inbox,
  Lock,
  Download,
  UserPlus
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  getDocs,
  arrayUnion
} from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../i18n/translations';
import { generateTicketHtml } from '../lib/ticketHtmlExport';
import { logger } from '../lib/logger';

interface SupportTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportTicketModal({ isOpen, onClose }: SupportTicketModalProps) {
  const { user, username } = useAuth();
  const { t, language } = useTranslation();

  const [view, setView] = useState<'list' | 'create' | 'details'>('list');
  const [ticketListFilter, setTicketListFilter] = useState<'all' | 'open' | 'recent'>('all');
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'bug' | 'question' | 'report' | 'other'>('bug');
  const [targetUser, setTargetUser] = useState('');
  const [description, setDescription] = useState('');

  // Invite state
  const [showUserInviteModal, setShowUserInviteModal] = useState(false);
  const [inviteTarget, setInviteTarget] = useState('');
  const [isInvitingTarget, setIsInvitingTarget] = useState(false);

  const handleDownloadTicketHtml = async (ticket: any, msgs: any[]) => {
    try {
      let finalMsgs = msgs;
      if (!finalMsgs || finalMsgs.length === 0) {
        const snap = await getDocs(query(collection(db, `tickets/${ticket.id}/messages`), orderBy('createdAt', 'asc')));
        finalMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const html = generateTicketHtml(ticket, finalMsgs, true);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GodHand-Ticket-${(ticket.id || 'export').slice(0, 8)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'de' ? 'Ticket als HTML heruntergeladen' : 'Ticket downloaded as HTML');
    } catch (e: any) {
      toast.error('Download error: ' + e.message);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !inviteTarget.trim() || !selectedTicket?.id) return;
    setIsInvitingTarget(true);
    try {
      const clean = inviteTarget.trim();
      await updateDoc(doc(db, 'tickets', selectedTicket.id), {
        invitedUsers: arrayUnion({
          identifier: clean,
          invitedBy: user.email || 'User',
          invitedByName: username || user.email?.split('@')[0] || 'User',
          invitedAt: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, `tickets/${selectedTicket.id}/messages`), {
        text: `👥 @${clean} wurde von ${username || user.email?.split('@')[0]} zu diesem Ticket hinzugefügt.`,
        senderId: 'SYSTEM',
        senderName: 'GodHand Support System',
        senderRole: 'system',
        isInternal: false,
        createdAt: serverTimestamp()
      });

      toast.success(language === 'de' ? `Nutzer "${clean}" erfolgreich eingeladen!` : `User "${clean}" invited!`);
      setShowUserInviteModal(false);
      setInviteTarget('');
    } catch (err: any) {
      toast.error('Invite failed: ' + err.message);
    } finally {
      setIsInvitingTarget(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !user) return;

    logger.debug('SupportTicketModal', 'Subscribing to user tickets...');
    const q = query(
      collection(db, 'tickets'),
      where('reporterId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setTickets(docs);
    }, (err) => {
      logger.error('SupportTicketModal:fetchTickets', err);
    });

    return () => unsubscribe();
  }, [isOpen, user]);

  useEffect(() => {
    if (!selectedTicket?.id) return;

    logger.debug('SupportTicketModal', `Subscribing to ticket messages: ${selectedTicket.id}`);
    const q = query(
      collection(db, `tickets/${selectedTicket.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((m: any) => !m.isInternal); // filter out internal staff notes from regular users
      setTicketMessages(msgs);
    }, (err) => {
      logger.error('SupportTicketModal:fetchMessages', err);
    });

    return () => unsubscribe();
  }, [selectedTicket?.id]);

  if (!isOpen) return null;

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error(language === 'de' ? 'Bitte Titel und Beschreibung ausfüllen' : 'Please fill in title and description');
      return;
    }

    // Protection 1: Self-report and self-ticket opening prevention
    const userEmail = (user?.email || '').toLowerCase();
    const currentUsername = (username || user?.displayName || '').toLowerCase();
    const currentUid = (user?.uid || '').toLowerCase();
    const trimmedTarget = targetUser.trim().toLowerCase();

    if (category === 'report') {
      if (
        (trimmedTarget && (trimmedTarget === userEmail || trimmedTarget === currentUsername || trimmedTarget === currentUid || (userEmail && trimmedTarget.includes(userEmail)))) ||
        (userEmail && (`${title} ${description}`.toLowerCase().includes(userEmail))) ||
        (currentUsername && (`${title} ${description}`.toLowerCase().includes(currentUsername)))
      ) {
        toast.error(t('selfReportError'));
        return;
      }
    }

    // Protection 2: Duplicate open ticket prevention
    const hasDuplicateOpen = tickets.some(
      t => (t.status === 'open' || t.status === 'in_progress') &&
           t.title.trim().toLowerCase() === title.trim().toLowerCase()
    );
    if (hasDuplicateOpen) {
      toast.error(language === 'de' ? 'Ein offenes Ticket mit diesem Titel existiert bereits.' : 'An open ticket with this title already exists.');
      return;
    }

    setIsSubmitting(true);
    try {
      logger.info('SupportTicketModal', `Creating support ticket: ${title}`);
      const newTicket = {
        title: title.trim(),
        category,
        targetUser: category === 'report' ? targetUser.trim() : null,
        description: description.trim(),
        reporterId: user?.uid,
        reporterEmail: user?.email,
        reporterUsername: username || user?.displayName || user?.email?.split('@')[0] || 'User',
        status: 'open', // open, in_progress, resolved, closed
        priority: 'normal',
        assignedTo: null,
        assignedToName: null,
        resolutionReason: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'tickets'), newTicket);
      
      // Add first user message to subcollection
      await addDoc(collection(db, `tickets/${docRef.id}/messages`), {
        text: description.trim(),
        senderId: user?.uid,
        senderName: username || user?.displayName || 'User',
        senderRole: 'user',
        isInternal: false,
        createdAt: serverTimestamp()
      });

      toast.success(language === 'de' ? 'Support-Ticket erfolgreich erstellt!' : 'Support ticket submitted!');
      setTitle('');
      setDescription('');
      setView('list');
    } catch (err: any) {
      logger.error('SupportTicketModal:create', err);
      toast.error(err.message || 'Error creating ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket?.id) return;
    try {
      await updateDoc(doc(db, 'tickets', selectedTicket.id), {
        status: 'closed',
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await addDoc(collection(db, `tickets/${selectedTicket.id}/messages`), {
        text: language === 'de' ? '🔒 Ticket wurde geschlossen.' : '🔒 Ticket was closed.',
        senderId: user?.uid,
        senderName: username || user?.displayName || 'User',
        senderRole: 'system',
        isInternal: false,
        createdAt: serverTimestamp()
      });
      setSelectedTicket((prev: any) => ({ ...prev, status: 'closed' }));
      toast.success(t('ticketClosedSuccess'));
    } catch (e: any) {
      toast.error(e.message || 'Error closing ticket');
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket?.id) return;
    try {
      await updateDoc(doc(db, 'tickets', selectedTicket.id), {
        status: 'open',
        updatedAt: serverTimestamp()
      });
      await addDoc(collection(db, `tickets/${selectedTicket.id}/messages`), {
        text: language === 'de' ? '🔓 Ticket wiedereröffnet.' : '🔓 Ticket reopened.',
        senderId: user?.uid,
        senderName: username || user?.displayName || 'User',
        senderRole: 'system',
        isInternal: false,
        createdAt: serverTimestamp()
      });
      setSelectedTicket((prev: any) => ({ ...prev, status: 'open' }));
      toast.success(t('ticketReopenedSuccess'));
    } catch (e: any) {
      toast.error(e.message || 'Error reopening ticket');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket?.id) return;

    try {
      await addDoc(collection(db, `tickets/${selectedTicket.id}/messages`), {
        text: replyText.trim(),
        senderId: user?.uid,
        senderName: username || user?.displayName || 'User',
        senderRole: 'user',
        isInternal: false,
        createdAt: serverTimestamp()
      });

      setReplyText('');
    } catch (err: any) {
      logger.error('SupportTicketModal:sendReply', err);
      toast.error('Failed to send message');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded text-[11px] font-medium">{t('statusOpen')}</span>;
      case 'in_progress':
        return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] font-medium">{t('statusInProgress')}</span>;
      case 'resolved':
        return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-medium">{t('statusResolved')}</span>;
      case 'closed':
        return <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[11px] font-medium">{t('statusClosed')}</span>;
      default:
        return <span className="bg-slate-500/20 text-slate-400 border border-slate-500/30 px-2 py-0.5 rounded text-[11px] font-medium">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-[#1e1e20] border border-[#38383c] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#26262a] border-b border-[#38383c] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-500/15 rounded-xl border border-indigo-500/30 text-indigo-400">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                {language === 'de' ? 'Support & Hilfe-Center' : 'Support & Help Center'}
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'de' ? 'Tickets erstellen und direkten Support vom GodHand-Team erhalten' : 'Submit tickets and communicate directly with staff'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#38383c] rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content View */}
        <div className="flex-1 overflow-y-auto p-5">
          {view === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Filter Tabs: Alle, Offen, Letzte Tickets */}
                <div className="flex items-center space-x-1 bg-[#1e1e24] p-1 rounded-xl border border-[#32323a]">
                  <button
                    onClick={() => setTicketListFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      ticketListFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('filterAll')} ({tickets.length})
                  </button>
                  <button
                    onClick={() => setTicketListFilter('open')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      ticketListFilter === 'open' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('filterOpen')} ({tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length})
                  </button>
                  <button
                    onClick={() => setTicketListFilter('recent')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      ticketListFilter === 'recent' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('recentTickets')} ({tickets.filter(t => t.status === 'resolved' || t.status === 'closed' || t.status === 'deleted').length})
                  </button>
                </div>

                <button
                  onClick={() => setView('create')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('openTicket')}</span>
                </button>
              </div>

              {(() => {
                const filteredTickets = tickets.filter(tItem => {
                  if (ticketListFilter === 'open') return tItem.status === 'open' || tItem.status === 'in_progress';
                  if (ticketListFilter === 'recent') return tItem.status === 'resolved' || tItem.status === 'closed' || tItem.status === 'deleted';
                  return true;
                });

                if (filteredTickets.length === 0) {
                  return (
                    <div className="text-center py-12 border border-dashed border-[#38383c] rounded-xl space-y-3 bg-[#26262a]/40">
                      <LifeBuoy className="h-10 w-10 text-slate-500 mx-auto" />
                      <p className="text-sm text-slate-400">{t('noTicketsYet')}</p>
                      {ticketListFilter === 'all' && (
                        <button
                          onClick={() => setView('create')}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          <span>{t('openTicket')}</span>
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {filteredTickets.map((tItem) => (
                      <div
                        key={tItem.id}
                        onClick={() => {
                          setSelectedTicket(tItem);
                          setView('details');
                        }}
                        className="p-3.5 bg-[#26262a] hover:bg-[#2d2d32] border border-[#38383c] rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1 pr-3">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                              {tItem.title}
                            </span>
                            {getStatusBadge(tItem.status)}
                            <span className="text-[10px] text-slate-500 font-mono">#{tItem.id.slice(0, 6)}</span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1">{tItem.description}</p>
                          
                          <div className="flex items-center flex-wrap gap-2 text-[11px] pt-1">
                            {tItem.assignedToName && (
                              <div className="text-indigo-300 flex items-center space-x-1">
                                <ShieldCheck className="h-3 w-3" />
                                <span>{t('assignedTo', { name: tItem.assignedToName })}</span>
                              </div>
                            )}
                            {tItem.resolutionReason && (
                              <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                                {t('reasonLabel')} {tItem.resolutionReason}
                              </span>
                            )}
                            {tItem.deletionReason && (
                              <span className="text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                                Löschung: {tItem.deletionReason}
                              </span>
                            )}
                            {tItem.invitedUsers && tItem.invitedUsers.length > 0 && (
                              <span className="text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded text-[10px] border border-indigo-500/20">
                                👥 {tItem.invitedUsers.length} eingeladen
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadTicketHtml(tItem, []);
                            }}
                            className="p-1.5 hover:bg-[#383840] rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                            title={t('downloadTicketHtml')}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {view === 'create' && (
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#38383c]">
                <h3 className="text-sm font-semibold text-white">{t('openTicket')}</h3>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  {t('back')}
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('ticketCategory')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-[#26262a] border border-[#38383c] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="bug">🐛 {t('categoryBug')}</option>
                  <option value="question">❓ {t('categoryQuestion')}</option>
                  <option value="report">🚨 {t('categoryReport')}</option>
                  <option value="other">💬 {t('categoryOther')}</option>
                </select>
              </div>

              {category === 'report' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t('targetUserLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('targetUserPlaceholder')}
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                    className="w-full bg-[#26262a] border border-[#38383c] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('ticketTitle')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('ticketTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#26262a] border border-[#38383c] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('ticketDescription')}</label>
                <textarea
                  required
                  rows={5}
                  placeholder={t('ticketDescPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#26262a] border border-[#38383c] rounded-lg p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-4 py-2 bg-[#2d2d32] hover:bg-[#38383c] text-xs font-semibold text-slate-300 rounded-lg transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                >
                  {isSubmitting ? t('loading') : t('confirm')}
                </button>
              </div>
            </form>
          )}

          {view === 'details' && selectedTicket && (
            <div className="flex flex-col h-[55vh]">
              {/* Ticket header */}
              <div className="pb-3 border-b border-[#38383c] flex items-center justify-between">
                <div>
                  <button
                    onClick={() => setView('list')}
                    className="text-xs text-indigo-400 hover:underline mb-1 inline-block"
                  >
                    ← {t('back')}
                  </button>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-white">{selectedTicket.title}</h3>
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                </div>
                <div className="flex items-center space-x-2 flex-wrap gap-1">
                  {/* HTML Export Button */}
                  <button
                    onClick={() => handleDownloadTicketHtml(selectedTicket, ticketMessages)}
                    className="px-2.5 py-1 bg-[#26262e] hover:bg-[#32323c] text-slate-200 border border-[#3e3e4a] rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                    title={t('downloadTicketHtml')}
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-400" />
                    <span>HTML</span>
                  </button>

                  {/* Invite Collaborator Button */}
                  <button
                    onClick={() => {
                      setInviteTarget('');
                      setShowUserInviteModal(true);
                    }}
                    className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                    title={t('inviteToTicket')}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t('inviteToTicket')}</span>
                  </button>

                  {selectedTicket.assignedToName && (
                    <span className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-1 rounded-lg">
                      {t('assignedTo', { name: selectedTicket.assignedToName })}
                    </span>
                  )}
                  {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && selectedTicket.status !== 'deleted' ? (
                    <button
                      onClick={handleCloseTicket}
                      className="px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                      title={t('closeTicket')}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{t('closeTicket')}</span>
                    </button>
                  ) : selectedTicket.status === 'closed' ? (
                    <span className="text-[11px] font-semibold text-rose-300 px-2.5 py-0.5 rounded-md bg-rose-950/40 border border-rose-500/30">
                      {t('statusClosed')}
                    </span>
                  ) : selectedTicket.status === 'deleted' ? (
                    <span className="text-[11px] font-semibold text-slate-300 px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-700">
                      Gelöscht
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-emerald-300 px-2.5 py-0.5 rounded-md bg-emerald-950/40 border border-emerald-500/30">
                      {t('statusResolved')}
                    </span>
                  )}
                </div>
              </div>

              {/* Messages feed */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {ticketMessages.map((msg) => {
                  const isMe = msg.senderId === user?.uid;
                  const isRequester = msg.senderId === selectedTicket.reporterId || msg.senderRole === 'user';
                  const isSystem = msg.senderRole === 'system';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isSystem ? 'items-center my-1' : isMe ? 'items-end' : 'items-start'}`}
                    >
                      {!isSystem && (
                        <div className="flex items-center space-x-1.5 text-[11px] mb-1">
                          <span className={`font-semibold ${isRequester ? 'text-cyan-300' : 'text-slate-300'}`}>{msg.senderName}</span>
                          {isRequester ? (
                            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded text-[10px] font-bold">
                              {t('ticketRequesterBadge')}
                            </span>
                          ) : (
                            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.2 rounded text-[10px] font-bold">
                              {t('staffSupportBadge')}
                            </span>
                          )}
                        </div>
                      )}
                      <div
                        className={`p-3 rounded-xl text-xs max-w-[85%] whitespace-pre-wrap ${
                          isSystem
                            ? 'bg-[#18181f] text-slate-400 border border-[#2e2e38] text-center text-[11px] px-4 py-1.5 rounded-full'
                            : isRequester
                            ? isMe
                              ? 'bg-cyan-600 text-white rounded-tr-xs shadow-md'
                              : 'bg-[#092226] text-cyan-100 border border-cyan-500/40 rounded-tl-xs shadow-sm'
                            : isMe
                              ? 'bg-indigo-600 text-white rounded-tr-xs shadow-md'
                              : 'bg-[#222234] text-indigo-100 border border-indigo-500/40 rounded-tl-xs shadow-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply box or Closed notice: Writing is disabled if closed, resolved or deleted */}
              {selectedTicket.status === 'closed' || selectedTicket.status === 'resolved' || selectedTicket.status === 'deleted' ? (
                <div className="pt-3 border-t border-[#38383c] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 bg-[#191920] p-3 rounded-xl border border-[#2d2d38]">
                  <div className="flex items-center space-x-2 text-amber-300 font-medium">
                    <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{t('writingDisabledClosedTicket')}</span>
                  </div>
                  {selectedTicket.status !== 'deleted' && (
                    <button
                      type="button"
                      onClick={handleReopenTicket}
                      className="px-2.5 py-1 bg-[#282830] hover:bg-[#343440] text-slate-200 border border-[#3e3e4a] rounded-lg text-xs font-medium"
                    >
                      {t('reopenTicket')}
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSendReply} className="pt-2 border-t border-[#38383c] flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder={language === 'de' ? 'Antwort schreiben...' : 'Type a reply...'}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 bg-[#26262a] border border-[#38383c] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User Invite to Ticket Modal */}
      {showUserInviteModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#1e1e24] border border-[#383844] rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#2d2d38]">
              <div className="flex items-center space-x-2 text-white">
                <UserPlus className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold">{t('inviteToTicket')}</h3>
              </div>
              <button
                onClick={() => setShowUserInviteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {t('enterEmailToInvite')}
            </p>

            <form onSubmit={handleInviteUser} className="space-y-3">
              <input
                type="text"
                autoFocus
                required
                placeholder="name@example.com oder Username"
                value={inviteTarget}
                onChange={(e) => setInviteTarget(e.target.value)}
                className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowUserInviteModal(false)}
                  className="px-3 py-1.5 bg-[#2a2a34] text-xs font-semibold text-slate-300 rounded-xl hover:bg-[#343440]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isInvitingTarget || !inviteTarget.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white rounded-xl shadow-sm flex items-center space-x-1.5"
                >
                  {isInvitingTarget && <Clock className="h-3 w-3 animate-spin" />}
                  <span>{t('confirm')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
