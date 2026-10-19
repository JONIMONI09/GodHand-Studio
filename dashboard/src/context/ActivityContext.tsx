import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  category?: string;
}

export interface ActivityState {
  isActive: boolean;
  title: string;
  detail: string;
  progress: number; // 0 to 100
  status: 'idle' | 'running' | 'success' | 'error';
  logs: ActivityLogEntry[];
}

interface ActivityContextType {
  activity: ActivityState;
  startOperation: (title: string, detail?: string, initialProgress?: number) => void;
  updateProgress: (progress: number, detail?: string) => void;
  completeOperation: (message?: string) => void;
  failOperation: (errorMessage: string) => void;
  addLog: (message: string, level?: 'info' | 'success' | 'warning' | 'error', category?: string) => void;
  clearLogs: () => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const ActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activity, setActivity] = useState<ActivityState>({
    isActive: false,
    title: 'Bereit / System bereit',
    detail: 'Keine aktiven Hintergrund-Aufgaben',
    progress: 100,
    status: 'idle',
    logs: [
      {
        id: 'init-1',
        timestamp: new Date().toLocaleTimeString(),
        message: 'GodHand Activity & Build Monitor initialisiert',
        level: 'info',
        category: 'SYSTEM'
      }
    ]
  });

  const completeTimeoutRef = useRef<any>(null);

  const addLog = useCallback((message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info', category: string = 'OP') => {
    const entry: ActivityLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toLocaleTimeString(),
      message,
      level,
      category
    };

    setActivity(prev => ({
      ...prev,
      logs: [...prev.logs.slice(-150), entry]
    }));
  }, []);

  const startOperation = useCallback((title: string, detail: string = '', initialProgress: number = 10) => {
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }

    setActivity(prev => {
      const entry: ActivityLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toLocaleTimeString(),
        message: `${title}${detail ? `: ${detail}` : ''}`,
        level: 'info',
        category: 'START'
      };

      return {
        ...prev,
        isActive: true,
        title,
        detail,
        progress: Math.min(Math.max(initialProgress, 5), 100),
        status: 'running',
        logs: [...prev.logs.slice(-150), entry]
      };
    });
  }, []);

  const updateProgress = useCallback((progress: number, detail?: string) => {
    setActivity(prev => ({
      ...prev,
      progress: Math.min(Math.max(progress, 0), 100),
      detail: detail !== undefined ? detail : prev.detail
    }));

    if (detail) {
      addLog(detail, 'info', 'PROGRESS');
    }
  }, [addLog]);

  const completeOperation = useCallback((message?: string) => {
    setActivity(prev => {
      const successMsg = message || `${prev.title} erfolgreich abgeschlossen`;
      const entry: ActivityLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toLocaleTimeString(),
        message: successMsg,
        level: 'success',
        category: 'DONE'
      };

      return {
        ...prev,
        isActive: true,
        detail: successMsg,
        progress: 100,
        status: 'success',
        logs: [...prev.logs.slice(-150), entry]
      };
    });

    if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
    completeTimeoutRef.current = setTimeout(() => {
      setActivity(prev => ({
        ...prev,
        isActive: false,
        status: 'idle',
        title: 'Bereit',
        detail: 'System bereit für nächste Operation'
      }));
      completeTimeoutRef.current = null;
    }, 4000);
  }, []);

  const failOperation = useCallback((errorMessage: string) => {
    setActivity(prev => {
      const entry: ActivityLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toLocaleTimeString(),
        message: `Fehler: ${errorMessage}`,
        level: 'error',
        category: 'FAIL'
      };

      return {
        ...prev,
        isActive: true,
        detail: errorMessage,
        progress: 100,
        status: 'error',
        logs: [...prev.logs.slice(-150), entry]
      };
    });

    if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
    completeTimeoutRef.current = setTimeout(() => {
      setActivity(prev => ({
        ...prev,
        isActive: false,
        status: 'idle'
      }));
      completeTimeoutRef.current = null;
    }, 6000);
  }, []);

  const clearLogs = useCallback(() => {
    setActivity(prev => ({
      ...prev,
      logs: []
    }));
  }, []);

  return (
    <ActivityContext.Provider
      value={{
        activity,
        startOperation,
        updateProgress,
        completeOperation,
        failOperation,
        addLog,
        clearLogs
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
};

export const useActivity = () => {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
};
