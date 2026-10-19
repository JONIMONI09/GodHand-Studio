import { toast } from "react-hot-toast";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { logger } from '../lib/logger';

export type UserRole = 'owner' | 'admin' | 'mod' | 'supporter' | 'user';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole;
  isOwner: boolean;
  isAdmin: boolean;
  isMod: boolean;
  isSupporter: boolean;
  isStaff: boolean;
  banned: boolean;
  username: string | null;
  bio: string | null;
  isProfilePublic: boolean;
  setUsername: (username: string) => Promise<void>;
  setBio: (bio: string) => Promise<void>;
  setIsProfilePublic: (isPublic: boolean) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const OWNER_EMAIL = 'ggjonasgameryt@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('user');
  const [banned, setBanned] = useState(false);
  const [username, setUsernameState] = useState<string | null>(null);
  const [bio, setBioState] = useState<string | null>(null);
  const [isProfilePublic, setIsProfilePublicState] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  const isOwner = role === 'owner' || user?.email === OWNER_EMAIL;
  const isAdmin = isOwner || role === 'admin';
  const isMod = isAdmin || role === 'mod';
  const isSupporter = isMod || role === 'supporter';
  const isStaff = isSupporter;

  const updateUsername = async (newUsername: string) => {
    if (!user || !newUsername) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { username: newUsername, updatedAt: serverTimestamp() }, { merge: true });
      setUsernameState(newUsername);
      logger.info('Auth', `Username updated to ${newUsername}`);
    } catch (err: any) {
      logger.error('Auth:updateUsername', err);
      toast.error('Failed to update username');
    }
  };

  const updateBio = async (newBio: string) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { bio: newBio, updatedAt: serverTimestamp() }, { merge: true });
      setBioState(newBio);
      logger.info('Auth', 'Bio updated');
    } catch (err: any) {
      logger.error('Auth:updateBio', err);
      toast.error('Failed to update bio');
    }
  };

  const updateIsProfilePublic = async (isPublic: boolean) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { isProfilePublic: isPublic, updatedAt: serverTimestamp() }, { merge: true });
      setIsProfilePublicState(isPublic);
      logger.info('Auth', `Profile visibility: ${isPublic}`);
    } catch (err: any) {
      logger.error('Auth:updateProfileVisibility', err);
      toast.error('Failed to update visibility');
    }
  };

  useEffect(() => {
    logger.debug('Auth', 'Subscribing to onAuthStateChanged...');
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        logger.info('Auth', `User detected: ${currentUser.email} (${currentUser.uid})`);
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            let resolvedRole: UserRole = data.role || 'user';
            if (currentUser.email === OWNER_EMAIL) {
              resolvedRole = 'owner';
              if (data.role !== 'owner') {
                // Ensure owner role in Firestore
                await setDoc(userDocRef, { role: 'owner', updatedAt: serverTimestamp() }, { merge: true });
              }
            }
            
            setRole(resolvedRole);
            setBanned(data.banned || false);
            setUsernameState(data.username || currentUser.displayName || null);
            setBioState(data.bio || null);
            setIsProfilePublicState(data.isProfilePublic ?? true);
            
            if (data.banned) {
              logger.warn('Auth', `Banned user ${currentUser.email} attempted login`);
              await signOut(auth);
              setUser(null);
              setRole('user');
              setBanned(true);
              setUsernameState(null);
              setBioState(null);
            } else {
              setUser(currentUser);
              logger.debug('Auth', `Authenticated successfully as ${resolvedRole}`);
            }
          } else {
            // Create user doc
            const defaultRole: UserRole = currentUser.email === OWNER_EMAIL ? 'owner' : 'user';
            const initialUsername = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
            await setDoc(userDocRef, {
              email: currentUser.email,
              role: defaultRole,
              banned: false,
              username: initialUsername,
              bio: '',
              isProfilePublic: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            setRole(defaultRole);
            setBanned(false);
            setUsernameState(initialUsername);
            setBioState('');
            setIsProfilePublicState(true);
            setUser(currentUser);
            logger.info('Auth', `Created fresh profile for ${currentUser.email} with role ${defaultRole}`);
          }
        } catch (e: any) {
          logger.error("Auth:fetchUserData", e);
          setUser(currentUser);
          if (currentUser.email === OWNER_EMAIL) {
            setRole('owner');
          }
        }
      } else {
        logger.debug('Auth', 'No active session (logged out)');
        setUser(null);
        setRole('user');
        setBanned(false);
        setUsernameState(null);
        setBioState(null);
        setIsProfilePublicState(true);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      logger.info('Auth', 'Signed in via Google');
    } catch (error) {
      logger.error("Auth:signInWithGoogle", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      logger.info('Auth', 'Signed out');
    } catch (error) {
      logger.error("Auth:logout", error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, role, isOwner, isAdmin, isMod, isSupporter, isStaff,
      banned, username, bio, isProfilePublic, 
      setUsername: updateUsername, setBio: updateBio, setIsProfilePublic: updateIsProfilePublic, 
      signInWithGoogle, logout 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
