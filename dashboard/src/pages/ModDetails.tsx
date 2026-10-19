import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, deleteDoc, arrayUnion, arrayRemove, collection, addDoc } from 'firebase/firestore';
import { toast } from "react-hot-toast";
import { ArrowLeft, Download, Edit2, Image as ImageIcon, Save, Trash2, Globe, Lock, Heart, Code, Flag } from 'lucide-react';
import { useTranslation } from "../i18n/translations";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export default function ModDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useTranslation();
  const [mod, setMod] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editCover, setEditCover] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [deletePrivateToo, setDeletePrivateToo] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchMod = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'published_projects', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMod({ id: docSnap.id, ...data });
          setEditTitle(data.title || '');
          setEditDesc(data.description || '');
          setEditDetails(data.details || '');
          setEditCover(data.coverImage || '');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchMod();
  }, [id]);

  const handleDownload = async () => {
    try {
      const res = await fetch('/api/download-jar');
      if (!res.ok) {
        toast.error(t('jarNotAvailable'));
        return;
      }
      window.location.href = '/api/download-jar';
    } catch (err) {
      toast.error(t('downloadError'));
    }
  };

  const handleSave = async () => {
    if (!mod || !id) return;
    try {
      await updateDoc(doc(db, 'published_projects', id), {
        title: editTitle,
        description: editDesc,
        details: editDetails,
        coverImage: editCover,
        updatedAt: serverTimestamp()
      });
      setMod({ ...mod, title: editTitle, description: editDesc, details: editDetails, coverImage: editCover });
      setIsEditing(false);
      toast.success(t('saveSuccess'));
    } catch (e) {
      console.error(e);
      toast.error(t('saveError'));
    }
  };

  const handleReport = async () => {
    if (!reportReason || !user) return;
    try {
      await addDoc(collection(db, 'reports'), {
        projectId: id || 'unknown',
        reporterId: user.uid,
        reason: reportReason,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowReportModal(false);
      setReportReason('');
      toast.success(t('reportSuccess'));
    } catch (e) {
      console.error(e);
      toast.error(t('reportSendError'));
    }
  };

  const handleToggleLike = async () => {
    if (!mod || !id || !user) return;
    const isLiked = mod.likedBy?.includes(user.uid);
    try {
      if (isLiked) {
        await updateDoc(doc(db, 'published_projects', id), {
          likedBy: arrayRemove(user.uid),
          likesCount: Math.max(0, (mod.likesCount || 0) - 1)
        });
        setMod({ ...mod, likedBy: mod.likedBy.filter((uId: string) => uId !== user.uid), likesCount: Math.max(0, (mod.likesCount || 0) - 1) });
      } else {
        await updateDoc(doc(db, 'published_projects', id), {
          likedBy: arrayUnion(user.uid),
          likesCount: (mod.likesCount || 0) + 1
        });
        setMod({ ...mod, likedBy: [...(mod.likedBy || []), user.uid], likesCount: (mod.likesCount || 0) + 1 });
      }
    } catch (e) {
      console.error("Error toggling like", e);
    }
  };

  const handleTogglePublic = async () => {
    if (!mod || !id) return;
    try {
      const newStatus = !mod.isPublic;
      await updateDoc(doc(db, 'published_projects', id), {
        isPublic: newStatus,
        updatedAt: serverTimestamp()
      });
      setMod({ ...mod, isPublic: newStatus });
    } catch (e) {
      console.error(e);
      toast.error(t('statusChangeError'));
    }
  };

  const handleDelete = async () => {
    if (!mod || !id) return;
    try {
      await deleteDoc(doc(db, 'published_projects', id));
      if (deletePrivateToo) {
        if (mod.originalProjectId) {
          try {
            await deleteDoc(doc(db, 'projects', mod.originalProjectId));
          } catch(e) {
            console.warn("Private project already deleted or inaccessible");
          }
        } else {
          toast.error(t('olderVersionDeleteWarning'));
        }
      }
      navigate('/dashboard');
    } catch (e) {
      console.error(e);
      toast.error(t('deleteError'));
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">{t('loading')}</div>;
  if (!mod) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">{t('projectNotFound')}</div>;

  const isOwner = user?.uid === mod.authorId;
  const canEdit = isOwner || role === 'admin' || role === 'mod';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <span>{t('back')}</span>
        </button>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {canEdit && (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleTogglePublic}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${mod.isPublic ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
              >
                {mod.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                {mod.isPublic ? t('public') : t('private')}
              </button>
              <button onClick={() => setIsEditing(!isEditing)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-lg text-sm font-medium transition-colors">
                <Edit2 className="w-4 h-4" />
                {isEditing ? t('cancel') : t('edit')}
              </button>
              <button onClick={() => { setShowDeleteModal(true); setDeleteConfirmation(''); }} className="p-2 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col gap-8">
        {isEditing ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white">{t('editProject')}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{t('titleLabel')}</label>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{t('shortDescription')}</label>
                <input 
                  type="text" 
                  value={editDesc} 
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{t('coverImageUrl')}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <ImageIcon className="h-5 w-5 text-slate-500" />
                    </div>
                    <input 
                      type="text" 
                      value={editCover} 
                      onChange={e => setEditCover(e.target.value)}
                      placeholder="https://example.com/image.png"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{t('detailsLabel')}</label>
                <textarea 
                  value={editDetails} 
                  onChange={e => setEditDetails(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none font-mono text-sm"
                  placeholder="# Features&#10;- Cool feature 1&#10;- Awesome thing 2"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
                <Save className="w-5 h-5" />
                {t("save")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="w-full md:w-1/3 aspect-video md:aspect-square bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0">
                {mod.coverImage ? (
                  <img src={mod.coverImage} alt={mod.title} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-16 h-16 text-slate-700" />
                )}
              </div>
              
              <div className="flex-1 space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">{mod.title}</h1>
                  <p className="text-lg text-slate-400">{mod.description}</p>
                </div>
                
                <div className="flex flex-wrap gap-4 items-center">
                  <div 
                    className="flex items-center gap-2 text-sm text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 cursor-pointer hover:border-indigo-500/50 hover:text-indigo-400 transition-colors"
                    onClick={() => navigate(`/user/${mod.authorId}`)}
                  >
                    {t('byAuthor', { name: mod.authorUsername || mod.authorEmail })}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="font-medium text-slate-300">Java:</span> {mod.javaVersion || '21'}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                  {mod.includeJar ? (
                    <button onClick={handleDownload} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/20">
                      <Download className="w-5 h-5" />
                      {t('downloadJar')}
                    </button>
                  ) : (
                    <button disabled className="bg-slate-800 text-slate-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 border border-slate-700 cursor-not-allowed">
                      <Download className="w-5 h-5" />
                      {t('waitingForDev')}
                    </button>
                  )}

                  <button onClick={handleToggleLike} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg ${mod.likedBy?.includes(user?.uid) ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}>
                    <Heart className={`w-5 h-5 ${mod.likedBy?.includes(user?.uid) ? 'fill-current' : ''}`} />
                    {mod.likesCount || 0} {t('likes')}
                  </button>

                  {(mod.isCodePublic || canEdit) && (
                    <button onClick={() => navigate(`/ide/${mod.originalProjectId}`)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors border border-slate-700">
                      <Code className="w-5 h-5" />
                      {mod.isCodePublic ? t('viewSource') : t('viewSourcePrivate')}
                    </button>
                  )}

                  {user && user.uid !== mod.authorId && (
                    <button onClick={() => setShowReportModal(true)} className="bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors border border-slate-700 hover:border-rose-500/30">
                      <Flag className="w-5 h-5" />
                      {t('report')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {mod.details && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 prose prose-invert max-w-none">
                <h3 className="text-xl font-bold text-white mb-4 border-b border-slate-800 pb-2">{t('aboutProject')}</h3>
                <div className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                  {mod.details}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-rose-900/50 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trash2 className="text-rose-500 w-6 h-6" />
              {t('deletePublishedProject')}
            </h2>
            <p className="text-slate-300 mb-4">
              {t('deletePublishedModalText', { name: mod.title })}
            </p>
            
            {user && user.uid === mod.authorId && (
              <label className="flex items-center gap-2 mb-6 cursor-pointer text-slate-300 hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={deletePrivateToo} 
                  onChange={(e) => setDeletePrivateToo(e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-900"
                />
                <span className="text-sm">{t('deletePrivateAlso')}</span>
              </label>
            )}

            <p className="text-sm text-slate-400 mb-6 bg-slate-950 p-3 rounded border border-slate-800">
              {t('confirmTypePrompt', { name: mod.title })}
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={t('typeConfirmPlaceholder', { name: mod.title })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white mb-6 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmation.trim().toLowerCase() !== `confirm ${mod.title}`.trim().toLowerCase()}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {t('confirmDeletion')}
              </button>
            </div>
          </div>
        </div>
      )}
    
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Flag className="h-5 w-5 text-rose-500" />
              {t('reportProjectTitle')}
            </h2>
            <p className="text-slate-400 mb-4 text-sm">{t('reportProjectPrompt')}</p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 mb-4"
              rows={4}
              placeholder={t('reportReasonPlaceholder')}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowReportModal(false); setReportReason(''); }} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">{t('cancel')}</button>
              <button onClick={handleReport} className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg transition-colors font-medium">{t('submitReport')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
