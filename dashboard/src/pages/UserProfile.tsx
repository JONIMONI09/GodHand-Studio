import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { ArrowLeft, User, LayoutDashboard, Globe, Heart, Flag } from 'lucide-react';
import { useTranslation } from '../i18n/translations';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const handleReport = async () => {
    if (!reportReason || !user || !userId) return;
    try {
      await addDoc(collection(db, 'reports'), {
        projectId: `user-profile-${userId}`,
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

  useEffect(() => {
    if (!userId) return;

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.isProfilePublic !== false) {
            setProfileUser(userData);
          } else {
            setProfileUser({ isPrivate: true });
          }
        } else {
          setProfileUser(null);
        }

        const q = query(
          collection(db, 'published_projects'), 
          where('authorId', '==', userId),
          where('isPublic', '==', true)
        );
        const snapshot = await getDocs(q);
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        projects.sort((a: any, b: any) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
        setUserProjects(projects);
      } catch (e) {
        console.error("Error fetching profile:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-6">
        {t('loading')}
      </div>
    );
  }

  if (!profileUser || profileUser.isPrivate) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <User className="w-16 h-16 text-slate-700 mb-4" />
        <h2 className="text-2xl font-bold mb-2">{t('profileNotFound')}</h2>
        <p className="text-slate-400 mb-6">{t('userNotExistOrPrivate')}</p>
        <button onClick={() => navigate('/dashboard')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition-colors">
          {t('backToDashboard')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 hover:text-white transition-colors text-slate-400">
          <ArrowLeft className="h-5 w-5" />
          <span>{t('back')}</span>
        </button>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {user && user.uid !== userId && (
            <button onClick={() => setShowReportModal(true)} className="flex items-center gap-2 hover:text-rose-400 transition-colors text-slate-400">
              <Flag className="h-5 w-5" />
              <span>{t('reportUser')}</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-12">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="w-24 h-24 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center flex-shrink-0 border border-indigo-500/30 text-4xl font-bold">
            {(profileUser.username || profileUser.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">{profileUser.username || t('defaultUserName')}</h1>
            {profileUser.bio && (
              <p className="text-slate-400 text-lg leading-relaxed max-w-2xl">{profileUser.bio}</p>
            )}
            {!profileUser.bio && (
              <p className="text-slate-500 italic">{t('noBioYet')}</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
            <LayoutDashboard className="h-6 w-6" />
            {t('publicProjectsCount', { count: String(userProjects.length) })}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userProjects.length === 0 ? (
              <p className="text-slate-500 col-span-full">{t('noPublicProjects')}</p>
            ) : (
              userProjects.map((project: any) => (
                <div 
                  key={project.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all flex flex-col cursor-pointer group"
                  onClick={() => navigate(`/mod/${project.id}`)}
                >
                  {project.coverImage && (
                    <div className="w-full h-32 bg-slate-800 relative">
                      <img src={project.coverImage} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-indigo-300 group-hover:text-indigo-200 transition-colors">{project.title}</h3>
                      <div className="flex gap-1">
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {t('public')}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded">Java {project.javaVersion || '21'}</span>
                      </div>
                    </div>
                    <p className="text-slate-400 text-sm mb-4 flex-1">{project.description}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-auto pt-4 border-t border-slate-800/50">
                      <span className="truncate pr-2">{new Date(project.createdAt?.toMillis ? project.createdAt.toMillis() : Date.now()).toLocaleDateString()}</span>
                      <div className="flex items-center gap-1 text-rose-400">
                        <Heart className="w-3 h-3 fill-current" />
                        <span>{project.likesCount || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Flag className="h-5 w-5 text-rose-500" />
              {t('reportUser')}
            </h2>
            <p className="text-slate-400 mb-4 text-sm">{t('reportUserPrompt')}</p>
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
