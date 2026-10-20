import { useBackendStatus, BackendOfflineModal } from './components/BackendOffline';
import { useTranslation } from "./i18n/translations";
import { toast } from "react-hot-toast";
import React from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { 
  Code, LogOut, LayoutDashboard, Plus, Folder, File, Play, Save, 
  ChevronRight, ChevronDown, Download, Menu, X, ShieldAlert, Flag, 
  Globe, Trash2, Heart, GripVertical, ArrowUp, ArrowDown, ArrowUpDown, 
  FolderInput, CornerLeftUp, BookOpen, HelpCircle, Check, RefreshCw, 
  FolderGit2, LifeBuoy, Crown, ListOrdered, Loader2
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import Login from './pages/Login';
import Admin from './pages/Admin';
import UserProfile from './pages/UserProfile';
import { db, auth } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, doc, getDoc, getDocs, deleteDoc, updateDoc, setDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { GitStudio } from './components/GitStudio';
import { SupportTicketModal } from './components/SupportTicketModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useActivity } from './context/ActivityContext';
import { diagnoseJava, applyJavaFix, DiagnosticItem } from './lib/diagnostics';
import { compileModToJar, downloadBlob } from './lib/jarCompiler';
import { BrowserVFS } from './lib/vfs';
import { isVFSMode, probeBackendStatus } from './lib/api';
import { PipelineStep, RunErrorDetail, RunArtifact } from './components/ide/IDERunProgressView';
import { CiSession, subscribeCiSession, pollCiSession, createCiSession, saveCiSession, resolveReleaseDownloadUrl } from './lib/ciSession';

import ModDetails from './pages/ModDetails';
import { IDEHeader } from './components/ide/IDEHeader';
import { IDEFileExplorer } from './components/ide/IDEFileExplorer';
import { IDEEditorArea } from './components/ide/IDEEditorArea';
import { IDEConsole } from './components/ide/IDEConsole';
import { IDETaskStatusBar } from './components/ide/IDETaskStatusBar';

function IDE() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, username, role, isStaff, isOwner } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const { startOperation, updateProgress, completeOperation, failOperation, addLog } = useActivity();
  const [nodeToDelete, setNodeToDelete] = React.useState<{ path: string; name: string; type: 'file' | 'folder' } | null>(null);
  const [isDeletingNode, setIsDeletingNode] = React.useState(false);
  const [activeFile, setActiveFile] = React.useState('src/main/java/com/yourcompany/godhand/GodHand.java');
  const [fileTree, setFileTree] = React.useState<any[]>([]);
  const [code, setCode] = React.useState('// Loading code...');
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [buildLogs, setBuildLogs] = React.useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [reportReason, setReportReason] = React.useState('');
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [showPublishModal, setShowPublishModal] = React.useState(false);
  const [showGitStudio, setShowGitStudio] = React.useState(false);
  const [showSupportModal, setShowSupportModal] = React.useState(false);
  const [publishTitle, setPublishTitle] = React.useState('My First Mod');
  const [publishDescription, setPublishDescription] = React.useState('A test project for the Web IDE.');
  const [publishCoverImage, setPublishCoverImage] = React.useState('');
  const [publishDetails, setPublishDetails] = React.useState('');
  const [javaVersion, setJavaVersion] = React.useState('21');
  const [includeJar, setIncludeJar] = React.useState(true);
  const [isCodePublic, setIsCodePublic] = React.useState(true);
  const isBackendOffline = useBackendStatus();
  const [projectStatus, setProjectStatus] = React.useState<string | null>(null);

  // Console, Diagnostics & Task Status Bar state
  const [activeConsoleTab, setActiveConsoleTab] = React.useState<'logs' | 'tasks' | 'diagnose' | 'gameplay'>('logs');
  const [diagnosticErrors, setDiagnosticErrors] = React.useState(0);
  const [diagnosticWarnings, setDiagnosticWarnings] = React.useState(0);
  const [clientStatus, setClientStatus] = React.useState<'stopped' | 'starting' | 'running' | 'crashed'>('stopped');
  const [isScanning, setIsScanning] = React.useState(false);

  // Center View & Dedicated Run Progress View state
  const [centerView, setCenterView] = React.useState<'editor' | 'run' | 'gameplay'>('editor');
  const [runStatus, setRunStatus] = React.useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [runType, setRunType] = React.useState<'browser-compile' | 'cloud-issueops' | 'client-run'>('browser-compile');
  const [runProgress, setRunProgress] = React.useState(0);
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [pipelineSteps, setPipelineSteps] = React.useState<PipelineStep[]>([]);
  const [runErrorDetails, setRunErrorDetails] = React.useState<RunErrorDetail | null>(null);
  const [runArtifact, setRunArtifact] = React.useState<RunArtifact | null>(null);
  const [ciSession, setCiSession] = React.useState<CiSession | null>(null);

  // Subscribe to CI session updates from IssueOps
  React.useEffect(() => {
    const unsub = subscribeCiSession((sess) => {
      setCiSession(sess);
      if (sess) {
        if (sess.status === 'pending') {
          setRunType('cloud-issueops');
          setRunStatus('running');
          setRunProgress(20);
          setCenterView('run');
          setPipelineSteps([
            { id: 'issue', stepNum: 1, title: language === 'de' ? 'GitHub Issue & Labels [build, task]' : 'GitHub Issue & Labels [build, task]', description: language === 'de' ? 'IssueOps-Anfrage für Cloud-Build übermittelt' : 'IssueOps cloud build request dispatched', status: 'completed' },
            { id: 'checkout', stepNum: 2, title: language === 'de' ? 'Repository Checkout & JDK 21' : 'Repository Checkout & JDK 21', description: language === 'de' ? 'GitHub Actions Runner bereitet Umgebung vor' : 'GitHub Actions runner preparing environment', status: 'running' },
            { id: 'compile', stepNum: 3, title: language === 'de' ? 'Gradle Loom Kompilierung' : 'Gradle Loom Compilation', description: language === 'de' ? 'Kompiliert Java-Quellen und remappt Mod-JAR' : 'Compiling Java sources and remapping mod JAR', status: 'pending' },
            { id: 'artifact', stepNum: 4, title: language === 'de' ? 'Artefakt-Upload' : 'Artifact Upload', description: language === 'de' ? 'Speichert kompilierte Mod auf GitHub Actions' : 'Uploading compiled mod archive to GitHub Actions', status: 'pending' },
            { id: 'delivery', stepNum: 5, title: language === 'de' ? 'Direkt-Lieferung an IDE-Session' : 'Direct Delivery to IDE Session', description: language === 'de' ? 'Verbindet Download-Link direkt im Studio' : 'Connecting mod download link directly into studio', status: 'pending' }
          ]);
          setBuildLogs(prev => [
            ...prev,
            `[IssueOps] Cloud CI Session initialized: ${sess.id}`,
            `[IssueOps] Tagged with labels: [build, task]`,
            `[IssueOps] Tracking target mod: ${sess.targetMod}`
          ]);
        } else if (sess.status === 'running') {
          setRunType('cloud-issueops');
          setRunStatus('running');
          setRunProgress(60);
          setPipelineSteps(prev => prev.map((s, idx) => {
            if (idx < 2) return { ...s, status: 'completed' };
            if (idx === 2) return { ...s, status: 'running' };
            return { ...s, status: 'pending' };
          }));
        } else if (sess.status === 'success') {
          setRunType('cloud-issueops');
          setRunStatus('success');
          setRunProgress(100);
          setPipelineSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
          const cleanName = (sess.targetMod || 'godhand').replace(/^mods[\/\\]/, '').replace(/[\\\/]/g, '');
          const jarFilename = cleanName.includes('arm32') ? 'arm32-fix-1.0.0.jar' : `${cleanName}-1.0.0.jar`;
          setRunArtifact({
            filename: jarFilename,
            downloadUrl: sess.artifactDownloadUrl
          });
          setBuildLogs(prev => [
            ...prev,
            `[SUCCESS] GitHub Actions CI build succeeded for run ${sess.runId || ''}!`,
            `[DIRECT-DELIVERY] Mod JAR ready: ${sess.artifactDownloadUrl || ''}`
          ]);
        } else if (sess.status === 'failed') {
          setRunType('cloud-issueops');
          setRunStatus('failed');
          setPipelineSteps(prev => prev.map((s, idx) => {
            if (idx < 2) return { ...s, status: 'completed' };
            if (idx === 2) return { ...s, status: 'failed' };
            return { ...s, status: 'pending' };
          }));
          setRunErrorDetails({
            title: language === 'de' ? 'Cloud CI Actions Build fehlgeschlagen' : 'Cloud CI Actions Build Failed',
            message: sess.message || (language === 'de' ? 'GitHub Actions Workflow ist fehlgeschlagen. Prüfen Sie die Actions-Logs.' : 'Workflow run on GitHub Actions failed. Check Actions log.')
          });
        }
      }
    });
    return unsub;
  }, [language]);

  // Poll active CI session periodically
  React.useEffect(() => {
    if (!ciSession || ciSession.status === 'success' || ciSession.status === 'failed') return;
    const interval = setInterval(async () => {
      try {
        await pollCiSession(ciSession);
      } catch (_) {}
    }, 4500);
    return () => clearInterval(interval);
  }, [ciSession]);

  // Poll client status for task status bar
  React.useEffect(() => {
    let isMounted = true;
    const pollStatus = async () => {
      try {
        const res = await fetch('/api/client/status');
        if (res.ok && isMounted) {
          const data = await res.json();
          setClientStatus(data.status || 'stopped');
        }
      } catch (_) {}
    };
    pollStatus();
    const interval = setInterval(pollStatus, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Continuous real-time Client-Side Auto-Scan on code edits (debounced 400ms)
  React.useEffect(() => {
    if (!code || code === '// Loading code...') return;
    setIsScanning(true);
    const timer = setTimeout(() => {
      try {
        const diags = diagnoseJava(code);
        const errors = diags.filter(d => d.severity === 'error').length;
        const warnings = diags.filter(d => d.severity === 'warning').length;
        setDiagnosticErrors(errors);
        setDiagnosticWarnings(warnings);
      } catch (_) {}
      setIsScanning(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [code]);

  // Drag and drop & arrangement state for file tree
  const [draggingNode, setDraggingNode] = React.useState<any | null>(null);
  const [dragOverFolder, setDragOverFolder] = React.useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = React.useState(false);
  const [sortMode, setSortMode] = React.useState<'custom' | 'folders-first' | 'name-asc' | 'name-desc' | 'type'>(() => {
    try {
      return (localStorage.getItem('godhand_sort_mode') as any) || 'custom';
    } catch {
      return 'custom';
    }
  });
  const [customOrder, setCustomOrder] = React.useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('godhand_file_order');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showSortMenu, setShowSortMenu] = React.useState(false);
  const [dropInsertInfo, setDropInsertInfo] = React.useState<{ targetPath: string; position: 'before' | 'after' | 'inside' } | null>(null);

  // Splitter resizers
  const [sidebarWidth, setSidebarWidth] = React.useState(260);
  const [isResizingSidebar, setIsResizingSidebar] = React.useState(false);
  const [terminalHeight, setTerminalHeight] = React.useState(220);
  const [isResizingTerminal, setIsResizingTerminal] = React.useState(false);

  // Collapsible & responsive layout panels state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('godhand_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isTerminalCollapsed, setIsTerminalCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('godhand_terminal_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('godhand_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const toggleTerminalCollapse = () => {
    setIsTerminalCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('godhand_terminal_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => {
      const next = !prev;
      if (next) {
        setIsSidebarCollapsed(true);
        setIsTerminalCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
        setIsTerminalCollapsed(false);
      }
      return next;
    });
  };

  // Resize event listeners
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = Math.min(Math.max(160, e.clientX), 600);
        setSidebarWidth(newWidth);
      } else if (isResizingTerminal) {
        const newHeight = Math.min(Math.max(80, window.innerHeight - e.clientY), window.innerHeight - 150);
        setTerminalHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      if (isResizingSidebar) setIsResizingSidebar(false);
      if (isResizingTerminal) setIsResizingTerminal(false);
    };

    if (isResizingSidebar || isResizingTerminal) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize';
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
  }, [isResizingSidebar, isResizingTerminal]);

  // Documentation modal & Move modal states
  const [showDocsModal, setShowDocsModal] = React.useState(false);
  const [moveTargetNode, setMoveTargetNode] = React.useState<any | null>(null);
  const [availableFolders, setAvailableFolders] = React.useState<string[]>(['']);
  const [selectedTargetFolder, setSelectedTargetFolder] = React.useState('');
  const hoverTimerRef = React.useRef<any>(null);

  // Keyboard shortcut Ctrl+S / Cmd+S for quick save
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        toast.success(language === 'de' ? 'Gespeichert!' : 'Saved!');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, code, language]);

  React.useEffect(() => {
    if (projectId && user) {
      const docRef = doc(db, 'projects', projectId);
      getDoc(docRef).then(snap => {
        if (snap.exists()) {
          setProjectStatus(snap.data().status);
        } else {
          setDoc(docRef, {
            ownerId: user.uid,
            name: projectId,
            status: 'active',
            reportsCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }).catch(e => {
            console.error("Error creating project doc:", e);
            toast.error("Error creating project doc: " + e.message);
          });
          setProjectStatus('active');
        }
      }).catch(err => {
        console.error("Error loading the project", err); toast.error("Error loading the project: " + err.message);
        setProjectStatus('active'); // fallback
      });
    }
  }, [projectId, user]);

  if ((projectStatus === 'quarantined' || projectStatus === 'deleted') && role === 'user') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-rose-500/50 p-8 rounded-xl max-w-md w-full shadow-2xl text-center">
          <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">
            {projectStatus === 'quarantined' ? 'Project in Quarantine' : 'Project deleted'}
          </h1>
          <p className="text-slate-400 mb-6">
            {projectStatus === 'quarantined' 
              ? 'Your project has been blocked due to a report. Our Admin team is currently analyzing the code. Access is temporarily disabled.'
              : 'This project has been deleted. If this was a mistake, please contact the team within 15 days.'}
          </p>
          <button onClick={() => navigate('/dashboard')} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg">{t("back")} zum Dashboard</button>
        </div>
      </div>
    );
  }


  
  const isCoreMod = Boolean(projectId && (
    projectId.startsWith('core-') || 
    projectId.startsWith('core:') || 
    projectId.startsWith('system-core-') || 
    projectId === 'arm32-fix'
  ));
  const coreModId = isCoreMod 
    ? (projectId === 'arm32-fix' ? 'arm32-fix' : projectId!.replace(/^(core-|core:|system-core-)/, '')) 
    : null;

  const refreshFileTree = async () => {
    try {
      const url = isCoreMod && coreModId ? `/api/system-mods/${coreModId}/tree` : '/api/fs/tree';
      const res = await fetch(url);
      const data = await res.json();
      setFileTree(data.tree || []);
      if (isCoreMod && data.tree && data.tree.length > 0) {
        // Find first file in tree if activeFile default doesn't exist
        const findFirstFile = (nodes: any[]): string | null => {
          for (const n of nodes) {
            if (n.type === 'file') return n.path;
            if (n.children) {
              const res = findFirstFile(n.children);
              if (res) return res;
            }
          }
          return null;
        };
        const first = findFirstFile(data.tree);
        if (first) setActiveFile(first);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load tree
  React.useEffect(() => {
    refreshFileTree();
  }, [projectId, isCoreMod, coreModId]);

  // Load active file
  React.useEffect(() => {
    if (!activeFile) return;
    const url = isCoreMod && coreModId
      ? `/api/system-mods/${coreModId}/file?path=${encodeURIComponent(activeFile)}`
      : `/api/fs/file?path=${encodeURIComponent(activeFile)}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.content !== undefined) setCode(data.content);
      })
      .catch(console.error);
  }, [activeFile, isCoreMod, coreModId]);

  // Handle build via existing /api/build or core-mod build endpoint
  const handleBuild = async (cmdOrTask?: string) => {
    setIsBuilding(true);
    setCenterView('run');
    setRunStatus('running');
    setRunProgress(5);
    setCurrentStepIndex(0);
    setRunErrorDetails(null);
    setRunArtifact(null);
    setBuildLogs(['[INFO] Starting compiler build pipeline...']);

    const initialSteps: PipelineStep[] = [
      { id: 'init', stepNum: 1, title: t('runStepInit'), description: 'Checking environment & VFS storage...', status: 'running' },
      { id: 'metadata', stepNum: 2, title: t('runStepMetadata'), description: 'Verifying mod loader & fabric.mod.json...', status: 'pending' },
      { id: 'validate', stepNum: 3, title: t('runStepValidate'), description: 'Parsing Java AST and inspecting syntax...', status: 'pending' },
      { id: 'bytecode', stepNum: 4, title: t('runStepBytecode'), description: 'Synthesizing JVM 21 bytecode (0xCAFEBABE)...', status: 'pending' },
      { id: 'bundle', stepNum: 5, title: t('runStepBundle'), description: 'Packing MANIFEST.MF and compressing ZIP entries...', status: 'pending' },
      { id: 'ready', stepNum: 6, title: t('runStepReady'), description: 'Delivering compiled .jar mod binary...', status: 'pending' },
    ];
    setPipelineSteps(initialSteps);
    
    try {
      // 1. Probe backend status first to verify if native compiler terminal is available
      setBuildLogs(prev => [...prev, '[Environment Check] Probing compiler backend...']);
      const backendAlive = await probeBackendStatus();

      if (!backendAlive || isVFSMode()) {
        const targetProj = isCoreMod && coreModId ? coreModId : (projectId || 'godhand');
        setRunType('browser-compile');
        setBuildLogs(prev => [
          ...prev,
          '[Environment Check] No local terminal/backend detected (standalone mode). Switching to GitHub CI & In-Browser Compiler...',
          `[Client-Compiler] Initializing Zero-PAT In-Browser compilation for ${targetProj}...`
        ]);

        // 2. Comprehensive Pre-flight Syntax & Typo Check across all Java files in project
        let allSyntaxErrors: Array<{ file: string; line: number; message: string; suggestedFix?: string; typo?: string }> = [];
        try {
          await BrowserVFS.ensureInitialized(targetProj);
          const tree = await BrowserVFS.getTree(targetProj);
          const javaFiles: string[] = [];
          const collectJava = (nodes: any[]) => {
            for (const n of nodes) {
              if (n.type === 'file' && typeof n.path === 'string' && n.path.endsWith('.java')) {
                javaFiles.push(n.path);
              }
              if (n.children && Array.isArray(n.children)) {
                collectJava(n.children);
              }
            }
          };
          collectJava(tree);

          for (const jFile of javaFiles) {
            const jCode = (activeFile === jFile) ? code : await BrowserVFS.getFile(jFile, targetProj);
            const diags = diagnoseJava(jCode);
            for (const d of diags) {
              if (d.severity === 'error' || d.type === 'typo' || d.type === 'syntax') {
                allSyntaxErrors.push({
                  file: jFile,
                  line: d.line,
                  message: d.message,
                  suggestedFix: d.suggestedFix,
                  typo: d.typo
                });
              }
            }
          }
        } catch (_) {
          if (activeFile && activeFile.endsWith('.java')) {
            const diags = diagnoseJava(code);
            allSyntaxErrors = diags
              .filter(d => d.severity === 'error' || d.type === 'typo' || d.type === 'syntax')
              .map(d => ({ file: activeFile, line: d.line, message: d.message, suggestedFix: d.suggestedFix, typo: d.typo }));
          }
        }

        if (allSyntaxErrors.length > 0) {
          const firstErr = allSyntaxErrors[0];
          setRunStatus('failed');
          setRunErrorDetails({
            title: language === 'de' ? 'Java-Syntaxfehler / Tippfehler erkannt' : 'Java Syntax Error / Typo Detected',
            message: firstErr.message,
            file: firstErr.file,
            line: firstErr.line,
            suggestedFix: firstErr.suggestedFix,
            typo: firstErr.typo
          });
          setPipelineSteps(prev => prev.map((s, idx) => idx === 2 ? { ...s, status: 'failed' } : s));
          setBuildLogs(prev => [
            ...prev,
            `[Syntax Check] Java syntax check failed with ${allSyntaxErrors.length} error(s):`,
            ...allSyntaxErrors.map(e => `  -> [${e.file}:${e.line}] ${e.message}${e.suggestedFix ? ` (Fix: ${e.suggestedFix})` : ''}`),
            `[ERROR] Build aborted due to syntax errors. Please fix before building.`
          ]);
          toast.error(language === 'de' ? 'Kompilierung abgebrochen: Syntaxfehler gefunden!' : 'Build aborted: Syntax errors found!');
          setIsBuilding(false);
          return;
        } else {
          setBuildLogs(prev => [...prev, `[Syntax Check] Java AST syntax check passed (0 errors across workspace).`]);
        }

        // 3. Initialize & sync CI session without opening external GitHub tabs
        const activeCiSession = createCiSession(targetProj);
        setCiSession(activeCiSession);
        setBuildLogs(prev => [
          ...prev,
          `[GitHub CI Session] Initialized session ${activeCiSession.id} (Zero-PAT mode, website-driven).`,
          `[Client-Compiler] Launching Zero-PAT In-Browser compilation pipeline for ${targetProj}...`
        ]);

        const res = await compileModToJar(
          targetProj,
          (msg) => {
            setBuildLogs(prev => [...prev, msg]);
          },
          (step) => {
            setRunProgress(step.percent);
            setCurrentStepIndex(step.step - 1);
            setPipelineSteps(prev => prev.map((s, idx) => {
              if (idx < step.step - 1) {
                return { ...s, status: 'completed' };
              } else if (idx === step.step - 1) {
                return { ...s, status: 'running', description: step.detail };
              } else {
                return { ...s, status: 'pending' };
              }
            }));
          }
        );

        if (res.success && res.blob) {
          setRunProgress(100);
          setRunStatus('success');
          setPipelineSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
          const artifact: RunArtifact = {
            filename: res.filename,
            blob: res.blob,
            sizeBytes: res.blob.size
          };
          setRunArtifact(artifact);
          downloadBlob(res.blob, res.filename);
          setBuildLogs(prev => [
            ...prev,
            `[SUCCESS] Compiled ${res.filename} (${(res.blob!.size / 1024).toFixed(1)} KB)`,
            `[Zero-Token Delivery] Production JAR ready for download directly in browser.`
          ]);
          // Sync CI session state
          activeCiSession.status = 'success';
          activeCiSession.artifactDownloadUrl = resolveReleaseDownloadUrl(targetProj, '1.0.0');
          activeCiSession.logs.push(`[Client-Build] Successfully compiled ${res.filename} in-browser (Zero-PAT)`);
          saveCiSession(activeCiSession);
          setCiSession({ ...activeCiSession });
          toast.success(language === 'de' ? `Kompilierung erfolgreich: ${res.filename} heruntergeladen!` : `Build successful: Downloaded ${res.filename}!`);
        } else {
          setRunStatus('failed');
          activeCiSession.status = 'failed';
          activeCiSession.message = language === 'de' ? 'Kompilierung fehlgeschlagen' : 'Build failed';
          saveCiSession(activeCiSession);
          setCiSession({ ...activeCiSession });
          const javaDiags = diagnoseJava(code);
          const typoDiag = javaDiags.find(d => d.type === 'typo' || d.suggestedFix);
          const firstError = res.diagnostics.find(d => d.severity === 'error') || res.diagnostics[0];

          if (typoDiag) {
            setRunErrorDetails({
              title: language === 'de' ? 'Java-Syntaxfehler / Tippfehler erkannt' : 'Java Syntax Error / Typo Detected',
              message: typoDiag.message,
              file: activeFile,
              line: typoDiag.line,
              suggestedFix: typoDiag.suggestedFix,
              typo: typoDiag.typo
            });
          } else if (firstError) {
            setRunErrorDetails({
              title: language === 'de' ? 'Kompilierfehler' : 'Compilation Error',
              message: firstError.message,
              file: firstError.file,
              line: firstError.line,
              suggestedFix: firstError.suggestedFix || (firstError.message.includes(';') ? 'Add missing semicolon' : undefined),
              typo: firstError.typo
            });
          } else {
            setRunErrorDetails({
              title: language === 'de' ? 'Build fehlgeschlagen' : 'Build Failed',
              message: language === 'de' ? 'Unbekannter Compilerfehler aufgetreten.' : 'Unknown compilation error occurred.'
            });
          }

          const failedStepIdx = currentStepIndex >= 0 ? currentStepIndex : 2;
          setPipelineSteps(prev => prev.map((s, idx) => {
            if (idx < failedStepIdx) return { ...s, status: 'completed' };
            if (idx === failedStepIdx) return { ...s, status: 'failed' };
            return { ...s, status: 'pending' };
          }));
          setBuildLogs(prev => [...prev, `[ERROR] Build aborted with ${res.diagnostics.length} error(s).`]);
          toast.error(language === 'de' ? 'Kompilierung fehlgeschlagen' : 'Build failed');
        }
        setIsBuilding(false);
        return;
      }

      setRunType('client-run');
      if (isCoreMod && coreModId) {
        await fetch(`/api/system-mods/${coreModId}/build`, { method: 'POST' });
        const interval = setInterval(async () => {
          const res = await fetch('/api/system-mods');
          const data = await res.json();
          const found = (data.mods || []).find((m: any) => m.id === coreModId);
          if (found) {
            setBuildLogs(found.logs || []);
            if (found.status !== 'building') {
              clearInterval(interval);
              setIsBuilding(false);
              if (found.status === 'ready') {
                setRunStatus('success');
                setRunProgress(100);
                setPipelineSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
              } else {
                setRunStatus('failed');
                setRunErrorDetails({
                  title: 'Core Mod Build Failed',
                  message: 'Inspect build logs for stack trace details.'
                });
              }
            }
          }
        }, 1000);
      } else {
        await fetch('/api/build', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ javaVersion, cmd: cmdOrTask })
        });
        const interval = setInterval(async () => {
          const res = await fetch('/api/logs');
          const data = await res.json();
          setBuildLogs(data.buildLogs || []);
          
          const statusRes = await fetch('/api/status');
          const statusData = await statusRes.json();
          
          if (statusData.buildStatus !== 'building') {
            clearInterval(interval);
            setIsBuilding(false);
            if (statusData.buildStatus === 'ready' || statusData.buildStatus === 'idle') {
              setRunStatus('success');
              setRunProgress(100);
              setPipelineSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
            } else {
              setRunStatus('failed');
              setRunErrorDetails({
                title: 'Backend Gradle Build Failed',
                message: 'Check terminal logs for error output.'
              });
            }
          }
        }, 1000);
      }
    } catch (err: any) {
      setBuildLogs(prev => [...prev, '[ERROR] Failed to start build.']);
      setRunStatus('failed');
      setRunErrorDetails({
        title: 'Build Process Error',
        message: err?.message || 'Could not communicate with build pipeline.'
      });
      setIsBuilding(false);
    }
  };

  const handleApplyFixAndRerun = () => {
    if (runErrorDetails?.suggestedFix) {
      const fixObj: Partial<DiagnosticItem> = {
        line: runErrorDetails.line || 1,
        type: runErrorDetails.typo ? 'typo' : 'syntax',
        typo: runErrorDetails.typo,
        suggestedFix: runErrorDetails.suggestedFix
      };
      const fixed = applyJavaFix(code, fixObj);
      if (fixed) {
        setCode(fixed);
        toast.success(language === 'de' ? 'Fix angewendet! Starte Build erneut...' : 'Fix applied! Re-running build...');
        setTimeout(() => {
          handleBuild();
        }, 300);
        return;
      }
    }
    handleBuild();
  };

  const handleDownloadArtifact = () => {
    if (runArtifact?.blob) {
      downloadBlob(runArtifact.blob, runArtifact.filename);
      toast.success(language === 'de' ? 'Artefakt heruntergeladen!' : 'Artifact downloaded!');
    } else if (runArtifact?.downloadUrl) {
      window.open(runArtifact.downloadUrl, '_blank');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const url = isCoreMod && coreModId
        ? `/api/system-mods/${coreModId}/file`
        : '/api/fs/file';
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFile, content: code })
      });
      toast.success(language === 'de' ? 'Erfolgreich gespeichert' : 'Saved successfully');
    } catch (err: any) {
      console.error(err);
      toast.error('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const submitReport = async () => {
    if (!reportReason || !user) return;
    try {
      await addDoc(collection(db, 'reports'), {
        projectId: projectId || 'unknown',
        reporterId: user.uid,
        reason: reportReason,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowReportModal(false);
      setReportReason('');
      toast.success('Report has been sent!');
    } catch (e) {
      console.error(e);
      toast.error('Error sending the report.');
    }
  };

  const submitPublish = async () => {
    if (!publishTitle.trim() || !user) return;
    try {
      await addDoc(collection(db, 'published_projects'), {
        title: publishTitle,
        description: publishDescription,
        coverImage: publishCoverImage,
        details: publishDetails,
        authorId: user.uid,
        authorEmail: user.email,
        authorUsername: username || user.email?.split('@')[0] || 'User',
        isPublic: true,
        includeJar,
        isCodePublic,
        javaVersion,
        likesCount: 0,
        likedBy: [],
        originalProjectId: projectId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setShowPublishModal(false);
      toast.success('Project has been published!');
    } catch (e) {
      console.error(e);
      toast.error('Error publishing.');
    }
  };

  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set(['']));
  const [creatingFileIn, setCreatingFileIn] = React.useState<string | null>(null);
  const [newFileName, setNewFileName] = React.useState('');

  const handleCreateFile = async (folderPath: string) => {
    if (!newFileName.trim()) {
      setCreatingFileIn(null);
      return;
    }
    const fullPath = folderPath ? `${folderPath}/${newFileName}` : newFileName;
    try {
      const url = isCoreMod && coreModId
        ? `/api/system-mods/${coreModId}/file`
        : '/api/fs/file';
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fullPath, content: '// Neuer Inhalt' })
      });
      // Refresh tree
      await refreshFileTree();
      setCreatingFileIn(null);
      setNewFileName('');
      setActiveFile(fullPath);
    } catch (e) {
      console.error(e);
      toast.error('Error creating the file.');
    }
  };

  const toggleFolder = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const fetchFolders = async () => {
    try {
      const url = isCoreMod && coreModId
        ? `/api/system-mods/${coreModId}/folders`
        : '/api/fs/folders';
      const res = await fetch(url);
      const data = await res.json();
      if (data.folders) setAvailableFolders(data.folders);
    } catch (e) {
      console.error(e);
    }
  };

  const openMoveModal = (node: any) => {
    setMoveTargetNode(node);
    fetchFolders();
    const currentParent = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/')) : '';
    setSelectedTargetFolder(currentParent);
  };

  const handleMoveModalConfirm = async () => {
    if (!moveTargetNode) return;
    const fileName = moveTargetNode.name;
    const destinationPath = selectedTargetFolder ? `${selectedTargetFolder}/${fileName}` : fileName;

    if (destinationPath === moveTargetNode.path) {
      setMoveTargetNode(null);
      return;
    }

    if (moveTargetNode.type === 'folder' && (destinationPath === moveTargetNode.path || destinationPath.startsWith(moveTargetNode.path + '/'))) {
      toast.error(t('cannotMoveIntoOwnSubfolder'));
      return;
    }

    try {
      const moveUrl = isCoreMod && coreModId
        ? `/api/system-mods/${coreModId}/move`
        : '/api/fs/move';
      const res = await fetch(moveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: moveTargetNode.path, destinationPath, projectId: coreModId || 'godhand' })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('failedToMove'));
        return;
      }

      if (activeFile === moveTargetNode.path) {
        setActiveFile(destinationPath);
      } else if (activeFile.startsWith(moveTargetNode.path + '/')) {
        setActiveFile(destinationPath + activeFile.substring(moveTargetNode.path.length));
      }

      await refreshFileTree();

      if (selectedTargetFolder) {
        setExpandedFolders(prev => new Set(prev).add(selectedTargetFolder));
      }

      toast.success(t('movedSuccessfully', { name: fileName }));
      setMoveTargetNode(null);
    } catch (err: any) {
      toast.error(err.message || t('failedToMove'));
    }
  };

  const handleMoveUp = async (node: any) => {
    if (!node || !node.path.includes('/')) return;
    const parts = node.path.split('/');
    const fileName = parts.pop()!;
    parts.pop(); // remove immediate parent
    const targetFolder = parts.join('/');
    const destinationPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    try {
      const moveUrl = isCoreMod && coreModId
        ? `/api/system-mods/${coreModId}/move`
        : '/api/fs/move';
      const res = await fetch(moveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath: node.path, destinationPath, projectId: coreModId || 'godhand' })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('failedToMove'));
        return;
      }

      if (activeFile === node.path) {
        setActiveFile(destinationPath);
      } else if (activeFile.startsWith(node.path + '/')) {
        setActiveFile(destinationPath + activeFile.substring(node.path.length));
      }

      await refreshFileTree();

      if (targetFolder) {
        setExpandedFolders(prev => new Set(prev).add(targetFolder));
      }

      toast.success(t('movedSuccessfully', { name: fileName }));
    } catch (err: any) {
      toast.error(err.message || t('failedToMove'));
    }
  };

  const handleDeleteNode = (node: any) => {
    setNodeToDelete(node);
  };

  const executeDeleteNode = async () => {
    if (!nodeToDelete) return;
    setIsDeletingNode(true);
    const isFolder = nodeToDelete.type === 'folder';
    const opTitle = isFolder 
      ? (language === 'de' ? `Lösche Ordner "${nodeToDelete.name}"` : `Deleting folder "${nodeToDelete.name}"`)
      : (language === 'de' ? `Lösche Datei "${nodeToDelete.name}"` : `Deleting file "${nodeToDelete.name}"`);

    startOperation(opTitle, nodeToDelete.path, 15);
    addLog(`Löschauftrag initiiert: ${nodeToDelete.path} (${nodeToDelete.type})`, 'info', 'FS_DELETE');

    try {
      updateProgress(35, language === 'de' ? 'Sende Löschanforderung an Server...' : 'Sending delete request to server...');
      const deleteUrl = isCoreMod && coreModId
        ? `/api/system-mods/${coreModId}/file?path=${encodeURIComponent(nodeToDelete.path)}`
        : `/api/fs/file?path=${encodeURIComponent(nodeToDelete.path)}`;

      const res = await fetch(deleteUrl, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Delete failed');
      }

      updateProgress(75, language === 'de' ? 'Aktualisiere Verzeichnisstruktur...' : 'Refreshing file tree...');
      if (isCoreMod && coreModId) {
        const treeRes = await fetch(`/api/system-mods/${coreModId}/tree`);
        const treeData = await treeRes.json();
        setFileTree(treeData.tree || []);
      } else {
        const treeRes = await fetch('/api/fs/tree');
        const treeData = await treeRes.json();
        setFileTree(treeData.tree || []);
      }

      updateProgress(90, language === 'de' ? 'Bereinige aktiven Editor-Puffer...' : 'Cleaning active editor buffer...');
      if (activeFile === nodeToDelete.path || activeFile.startsWith(nodeToDelete.path + '/')) {
        setActiveFile('');
        setCode('// Select a file to view and edit');
      }

      const successMsg = isFolder
        ? (language === 'de' ? `Ordner "${nodeToDelete.name}" und Inhalt erfolgreich gelöscht` : `Folder "${nodeToDelete.name}" and contents deleted`)
        : (language === 'de' ? `Datei "${nodeToDelete.name}" gelöscht` : `File "${nodeToDelete.name}" deleted`);

      completeOperation(successMsg);
      toast.success(successMsg);
      setNodeToDelete(null);
    } catch (err: any) {
      failOperation(err.message || 'Delete operation failed');
      toast.error(err.message || 'Delete failed');
    } finally {
      setIsDeletingNode(false);
    }
  };

  // Helper to find children by path in file tree
  const getChildrenByPath = (tree: any[], targetPath: string): any[] => {
    if (!targetPath) return tree;
    const parts = targetPath.split('/');
    let current = tree;
    for (const part of parts) {
      const found = current.find(n => n.name === part && n.type === 'folder');
      if (!found || !found.children) return [];
      current = found.children;
    }
    return current;
  };

  // Sort nodes based on sortMode ('custom', 'folders-first', 'name-asc', 'name-desc', 'type')
  const sortNodes = (nodes: any[], parentPath: string): any[] => {
    if (!nodes || nodes.length <= 1) return nodes || [];

    if (sortMode === 'folders-first') {
      return [...nodes].sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    if (sortMode === 'name-asc') {
      return [...nodes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }

    if (sortMode === 'name-desc') {
      return [...nodes].sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
    }

    if (sortMode === 'type') {
      return [...nodes].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        const extA = a.name.includes('.') ? a.name.split('.').pop()!.toLowerCase() : '';
        const extB = b.name.includes('.') ? b.name.split('.').pop()!.toLowerCase() : '';
        if (extA !== extB) return extA.localeCompare(extB);
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    // Default 'custom' sort mode
    const orderList = customOrder[parentPath];
    if (!orderList || !Array.isArray(orderList) || orderList.length === 0) {
      return [...nodes].sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    return [...nodes].sort((a, b) => {
      const idxA = orderList.indexOf(a.name);
      const idxB = orderList.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  // Move item up or down within its sibling container
  const moveItemOrder = (parentPath: string, nodeName: string, direction: 'up' | 'down', currentSiblings: any[]) => {
    const sorted = sortNodes(currentSiblings, parentPath);
    const names = sorted.map(n => n.name);
    const index = names.indexOf(nodeName);
    if (index === -1) return;

    if (direction === 'up') {
      if (index === 0) return;
      const prev = names[index - 1];
      names[index - 1] = names[index];
      names[index] = prev;
    } else {
      if (index >= names.length - 1) return;
      const next = names[index + 1];
      names[index + 1] = names[index];
      names[index] = next;
    }

    const updated = { ...customOrder, [parentPath]: names };
    setCustomOrder(updated);
    setSortMode('custom');
    try {
      localStorage.setItem('godhand_sort_mode', 'custom');
      localStorage.setItem('godhand_file_order', JSON.stringify(updated));
    } catch (e) {
      console.warn("Storage write error", e);
    }
    toast.success(t('arrangementUpdated'));
  };

  const handleFileDrop = async (
    e: React.DragEvent, 
    targetNode: any | null, 
    directTargetFolder?: string,
    dropPosition?: 'before' | 'after' | 'inside'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);
    setDragOverFolder(null);
    const pos = dropPosition || dropInsertInfo?.position || 'inside';
    setDropInsertInfo(null);

    if (!draggingNode) return;

    const sourcePath = draggingNode.path;
    const fileName = sourcePath.includes('/') ? sourcePath.split('/').pop()! : sourcePath;
    const sourceParent = sourcePath.includes('/') ? sourcePath.substring(0, sourcePath.lastIndexOf('/')) : '';

    // Reordering relative to targetNode ('before' or 'after')
    if (targetNode && (pos === 'before' || pos === 'after')) {
      const targetParent = targetNode.path.includes('/') ? targetNode.path.substring(0, targetNode.path.lastIndexOf('/')) : '';

      // Pure in-directory reorder:
      if (sourceParent === targetParent) {
        if (draggingNode.name === targetNode.name) {
          setDraggingNode(null);
          return;
        }

        const currentList = sortNodes(
          targetParent ? getChildrenByPath(fileTree, targetParent) : fileTree, 
          targetParent
        ).map(n => n.name).filter(n => n !== fileName);

        const targetIndex = currentList.indexOf(targetNode.name);
        const insertIndex = pos === 'before' ? Math.max(0, targetIndex) : targetIndex + 1;
        currentList.splice(insertIndex, 0, fileName);

        const updated = { ...customOrder, [targetParent]: currentList };
        setCustomOrder(updated);
        setSortMode('custom');
        try {
          localStorage.setItem('godhand_sort_mode', 'custom');
          localStorage.setItem('godhand_file_order', JSON.stringify(updated));
        } catch {}
        toast.success(t('arrangementUpdated'));
        setDraggingNode(null);
        return;
      } else {
        // Cross-directory move AND insert before/after target
        const destinationPath = targetParent ? `${targetParent}/${fileName}` : fileName;
        if (draggingNode.type === 'folder' && (destinationPath === sourcePath || destinationPath.startsWith(sourcePath + '/'))) {
          toast.error(t('cannotMoveIntoOwnSubfolder'));
          setDraggingNode(null);
          return;
        }

        try {
          const moveUrl = isCoreMod && coreModId
            ? `/api/system-mods/${coreModId}/move`
            : '/api/fs/move';
          const res = await fetch(moveUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePath, destinationPath, projectId: coreModId || 'godhand' })
          });
          const data = await res.json();
          if (!res.ok) {
            toast.error(data.error || t('failedToMove'));
            setDraggingNode(null);
            return;
          }

          if (activeFile === sourcePath) {
            setActiveFile(destinationPath);
          } else if (activeFile.startsWith(sourcePath + '/')) {
            setActiveFile(destinationPath + activeFile.substring(sourcePath.length));
          }

          const treeUrl = isCoreMod && coreModId
            ? `/api/system-mods/${coreModId}/tree`
            : '/api/fs/tree';
          const treeRes = await fetch(treeUrl);
          const treeData = await treeRes.json();
          const newTree = treeData.tree || [];
          setFileTree(newTree);

          // Update custom order in target directory
          const currentList = sortNodes(
            targetParent ? getChildrenByPath(newTree, targetParent) : newTree,
            targetParent
          ).map(n => n.name).filter(n => n !== fileName);

          const targetIndex = currentList.indexOf(targetNode.name);
          const insertIndex = pos === 'before' ? Math.max(0, targetIndex) : targetIndex + 1;
          currentList.splice(insertIndex, 0, fileName);

          const updated = { ...customOrder, [targetParent]: currentList };
          setCustomOrder(updated);
          setSortMode('custom');
          try {
            localStorage.setItem('godhand_sort_mode', 'custom');
            localStorage.setItem('godhand_file_order', JSON.stringify(updated));
          } catch {}

          if (targetParent) {
            setExpandedFolders(prev => new Set(prev).add(targetParent));
          }
          toast.success(t('movedSuccessfully', { name: fileName }));
        } catch (err: any) {
          toast.error(err.message || t('failedToMove'));
        } finally {
          setDraggingNode(null);
        }
        return;
      }
    }

    // Default: 'inside' target folder or root
    let targetFolder = '';
    if (directTargetFolder !== undefined) {
      targetFolder = directTargetFolder;
    } else if (targetNode) {
      if (targetNode.type === 'folder') {
        targetFolder = targetNode.path;
      } else {
        targetFolder = targetNode.path.includes('/') ? targetNode.path.substring(0, targetNode.path.lastIndexOf('/')) : '';
      }
    }

    const destinationPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    if (destinationPath === sourcePath) {
      setDraggingNode(null);
      return;
    }

    if (draggingNode.type === 'folder' && (destinationPath === sourcePath || destinationPath.startsWith(sourcePath + '/'))) {
      toast.error(t('cannotMoveIntoOwnSubfolder'));
      setDraggingNode(null);
      return;
    }

    try {
      const moveUrl = isCoreMod && coreModId
        ? `/api/system-mods/${coreModId}/move`
        : '/api/fs/move';
      const res = await fetch(moveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, destinationPath, projectId: coreModId || 'godhand' })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('failedToMove'));
        setDraggingNode(null);
        return;
      }

      if (activeFile === sourcePath) {
        setActiveFile(destinationPath);
      } else if (activeFile.startsWith(sourcePath + '/')) {
        const updatedActiveFile = destinationPath + activeFile.substring(sourcePath.length);
        setActiveFile(updatedActiveFile);
      }

      await refreshFileTree();

      if (targetFolder) {
        setExpandedFolders(prev => new Set(prev).add(targetFolder));
      }

      toast.success(t('movedSuccessfully', { name: fileName }));
    } catch (err: any) {
      console.error("Drop error", err);
      toast.error(err.message || t('failedToMove'));
    } finally {
      setDraggingNode(null);
    }
  };


  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-[#1e1e1e] text-slate-300 overflow-hidden">
      <IDEHeader
        projectId={projectId}
        isCoreMod={isCoreMod}
        javaVersion={javaVersion}
        setJavaVersion={setJavaVersion}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebarCollapse}
        isTerminalCollapsed={isTerminalCollapsed}
        onToggleTerminal={toggleTerminalCollapse}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        showGitStudio={showGitStudio}
        setShowGitStudio={setShowGitStudio}
        setShowSupportModal={setShowSupportModal}
        setShowDocsModal={setShowDocsModal}
        setShowReportModal={setShowReportModal}
        setShowPublishModal={setShowPublishModal}
        isSaving={isSaving}
        handleSave={handleSave}
        isBuilding={isBuilding}
        handleBuild={() => handleBuild()}
        onNavigateDashboard={() => navigate('/dashboard')}
        onRefreshTree={refreshFileTree}
        onSelectMod={(newId) => navigate(`/ide/${newId}`)}
        onToggleRunView={() => setCenterView(prev => prev === 'run' ? 'editor' : 'run')}
        hasActiveRun={runStatus === 'running' || isBuilding}
        activeRunProgress={runProgress}
        centerView={centerView}
        isBackendOffline={isBackendOffline}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Modular Collapsible & Responsive File Explorer */}
        <IDEFileExplorer
          onRefreshTree={refreshFileTree}
          onSelectMod={(newId) => navigate(`/ide/${newId}`)}
          projectId={isCoreMod && coreModId ? coreModId : (projectId || 'godhand')}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebarCollapse}
          sidebarWidth={sidebarWidth}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          onResizeStart={(e) => {
            e.preventDefault();
            setIsResizingSidebar(true);
          }}
          onResetWidth={() => setSidebarWidth(260)}
          fileTree={fileTree}
          activeFile={activeFile}
          setActiveFile={setActiveFile}
          sortMode={sortMode}
          setSortMode={setSortMode}
          showSortMenu={showSortMenu}
          setShowSortMenu={setShowSortMenu}
          customOrder={customOrder}
          setCustomOrder={setCustomOrder}
          creatingFileIn={creatingFileIn}
          setCreatingFileIn={setCreatingFileIn}
          newFileName={newFileName}
          setNewFileName={setNewFileName}
          handleCreateFile={handleCreateFile}
          handleDeleteFile={(path, isFolder) => {
            handleDeleteNode({ path, type: isFolder ? 'folder' : 'file', name: path.split('/').pop() || path });
          }}
          openMoveModal={openMoveModal}
          draggingNode={draggingNode}
          setDraggingNode={setDraggingNode}
          dragOverFolder={dragOverFolder}
          setDragOverFolder={setDragOverFolder}
          isDragOverRoot={isDragOverRoot}
          setIsDragOverRoot={setIsDragOverRoot}
          dropInsertInfo={dropInsertInfo}
          setDropInsertInfo={setDropInsertInfo}
          handleFileDrop={handleFileDrop}
        />

        {/* Center Canvas: Responsive Monaco Editor + Resizable & Collapsible Build Console */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <IDEEditorArea
            activeFile={activeFile}
            code={code}
            onChangeCode={setCode}
            onSave={handleSave}
            isSaving={isSaving}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebarCollapse}
            isTerminalCollapsed={isTerminalCollapsed}
            onToggleTerminal={toggleTerminalCollapse}
            centerView={centerView}
            onSelectCenterView={setCenterView}
            projectId={isCoreMod && coreModId ? coreModId : (projectId || 'godhand')}
            runStatus={runStatus}
            runType={runType}
            runProgress={runProgress}
            currentStepIndex={currentStepIndex}
            pipelineSteps={pipelineSteps}
            runLogs={buildLogs}
            runErrorDetails={runErrorDetails}
            runArtifact={runArtifact}
            ciSession={ciSession}
            onApplyFix={handleApplyFixAndRerun}
            onDownloadArtifact={handleDownloadArtifact}
            onRerun={() => handleBuild()}
            isBackendOffline={isBackendOffline}
          />

          <IDEConsole
            buildLogs={buildLogs}
            terminalHeight={terminalHeight}
            isTerminalCollapsed={isTerminalCollapsed}
            isBuilding={isBuilding}
            onToggleCollapse={toggleTerminalCollapse}
            onClearLogs={() => setBuildLogs([])}
            onResizeStart={(e) => {
              e.preventDefault();
              setIsResizingTerminal(true);
            }}
            onResetHeight={() => setTerminalHeight(220)}
            activeCode={code}
            onCodeChange={setCode}
            activeFile={activeFile}
            onRunTask={(cmd) => handleBuild(cmd)}
            activeTab={activeConsoleTab}
            onTabChange={setActiveConsoleTab}
            onDiagnosticsUpdate={(errs, warns) => {
              setDiagnosticErrors(errs);
              setDiagnosticWarnings(warns);
            }}
          />
        </div>

        {/* Git Studio Side Panel */}
        {showGitStudio && (
          <div className="w-80 md:w-96 border-l border-[#2d2d2d] h-full flex flex-col z-20 shrink-0">
            <GitStudio 
              onClose={() => setShowGitStudio(false)} 
              onFileSelect={(filePath) => setActiveFile(filePath)} 
              onRefreshFiles={() => {
                refreshFileTree();
                fetchFolders();
                if (activeFile) {
                  fetch(`/api/fs/file?path=${encodeURIComponent(activeFile)}`)
                    .then(res => res.json())
                    .then(data => {
                      if (data.content !== undefined) setCode(data.content);
                    })
                    .catch(console.error);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Real-time Task, Errors & Health Monitor Status Bar */}
      <IDETaskStatusBar
        isBuilding={isBuilding}
        isScanning={isScanning}
        errorCount={diagnosticErrors}
        warningCount={diagnosticWarnings}
        clientStatus={clientStatus}
        isTerminalCollapsed={isTerminalCollapsed}
        onToggleTerminal={toggleTerminalCollapse}
        onSelectTab={(tab) => {
          setActiveConsoleTab(tab);
          if (isTerminalCollapsed) toggleTerminalCollapse();
        }}
      />

      {/* Delete File / Folder Confirmation Modal */}
      {nodeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#1e1e24] border border-[#383844] rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 text-slate-200">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {nodeToDelete.type === 'folder' 
                    ? (language === 'de' ? 'Ordner unwiderruflich löschen?' : 'Delete folder permanently?')
                    : (language === 'de' ? 'Datei löschen?' : 'Delete file?')}
                </h3>
                <p className="text-xs text-slate-400">
                  {nodeToDelete.type === 'folder'
                    ? (language === 'de' ? 'Alle enthaltenen Unterordner und Dateien werden ebenfalls gelöscht.' : 'All contained subfolders and files will also be removed.')
                    : (language === 'de' ? 'Diese Aktion kann nicht rückgängig gemacht werden.' : 'This action cannot be undone.')}
                </p>
              </div>
            </div>
            <div className="bg-[#141418] border border-white/5 rounded-lg p-2.5 font-mono text-xs text-rose-300 break-all">
              {nodeToDelete.path}
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setNodeToDelete(null)}
                disabled={isDeletingNode}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {language === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                onClick={executeDeleteNode}
                disabled={isDeletingNode}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                {isDeletingNode && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{language === 'de' ? 'Unwiderruflich löschen' : 'Delete permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Ticket Modal */}
      <SupportTicketModal 
        isOpen={showSupportModal} 
        onClose={() => setShowSupportModal(false)} 
      />

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Flag className="h-5 w-5 text-rose-400" />
              {t('reportProjectTitle')}
            </h3>
            <p className="text-sm text-slate-400 mb-4">{t('reportModalDesc')}</p>
            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500 focus:outline-none mb-4 min-h-[100px]"
              placeholder={t('reportReasonPlaceholder')}
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowReportModal(false)} className="px-4 py-2 text-sm font-medium hover:bg-slate-800 rounded-lg transition-colors">{t('cancel')}</button>
              <button onClick={submitReport} className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors">{t('submitReport')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-400" />
              {t('publishProject')}
            </h3>
            <p className="text-sm text-slate-400 mb-4">{t('publishModalDesc')}</p>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t('projectTitleLabel')}</label>
                <input
                  type="text"
                  value={publishTitle}
                  onChange={e => setPublishTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder={t('projectTitlePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t('projectDescLabel')}</label>
                <textarea
                  value={publishDescription}
                  onChange={e => setPublishDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:outline-none min-h-[80px]"
                  placeholder={t('projectDescPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t('coverImageLabel')}</label>
                <input 
                  type="text"
                  value={publishCoverImage}
                  onChange={e => setPublishCoverImage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder={t('coverImagePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t('detailedDetailsLabel')}</label>
                <textarea
                  value={publishDetails}
                  onChange={e => setPublishDetails(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-indigo-500 focus:outline-none min-h-[100px] font-mono"
                  placeholder={t('detailedDetailsPlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="includeJar" 
                    checked={includeJar} 
                    onChange={e => setIncludeJar(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                  />
                  <label htmlFor="includeJar" className="text-sm font-medium text-slate-300">
                    {t('provideJarDownload')}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="isCodePublic" 
                    checked={isCodePublic} 
                    onChange={e => setIsCodePublic(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                  />
                  <label htmlFor="isCodePublic" className="text-sm font-medium text-slate-300">
                    {t('makeSourcePublic')}
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowPublishModal(false)} className="px-4 py-2 text-sm font-medium hover:bg-slate-800 rounded-lg transition-colors">{t('cancel')}</button>
              <button onClick={submitPublish} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">{t('publishSubmit')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {moveTargetNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
              <FolderInput className="h-5 w-5 text-indigo-400" />
              {t('moveTo')}
            </h3>
            <div className="mb-4 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
              <div className="text-slate-400 mb-1">{t('currentLocation')}:</div>
              <div className="font-mono text-indigo-300 break-all flex items-center gap-1.5">
                {moveTargetNode.type === 'folder' ? <Folder className="h-4 w-4 shrink-0 text-blue-400" /> : <File className="h-4 w-4 shrink-0 text-amber-400" />}
                <span>{moveTargetNode.path}</span>
              </div>
            </div>

            <label className="block text-xs font-medium text-slate-300 mb-2">{t('selectTargetFolder')}:</label>
            <div className="max-h-60 overflow-y-auto space-y-1 mb-6 border border-slate-800 rounded-lg p-2 bg-slate-950">
              <div 
                onClick={() => setSelectedTargetFolder('')}
                className={`p-2 rounded cursor-pointer text-xs flex items-center gap-2 transition-colors ${
                  selectedTargetFolder === '' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Folder className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>/ {t('rootFolder')}</span>
              </div>
              {availableFolders.filter(f => f !== '' && f !== moveTargetNode.path && !f.startsWith(moveTargetNode.path + '/')).map((f) => (
                <div 
                  key={f}
                  onClick={() => setSelectedTargetFolder(f)}
                  className={`p-2 rounded cursor-pointer text-xs flex items-center gap-2 transition-colors ${
                    selectedTargetFolder === f ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                  style={{ paddingLeft: `${8 + (f.split('/').length - 1) * 12}px` }}
                >
                  <Folder className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="truncate">{f}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setMoveTargetNode(null)} className="px-4 py-2 text-sm font-medium hover:bg-slate-800 rounded-lg transition-colors text-slate-300">
                {t('cancel')}
              </button>
              <button onClick={handleMoveModalConfirm} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                {t('confirmMove')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documentation Modal */}
      <DocumentationModal isOpen={showDocsModal} onClose={() => setShowDocsModal(false)} language={language} />
    </div>
  );
}

function DocumentationModal({ isOpen, onClose, language }: { isOpen: boolean; onClose: () => void; language: string }) {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'filemanager' | 'build' | 'community' | 'shortcuts'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-6 w-6 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-white">
                {language === 'de' ? 'GodHand Studio — Dokumentation & Anleitung' : 'GodHand Studio — Documentation & Guide'}
              </h2>
              <p className="text-xs text-slate-400">
                {language === 'de' ? 'Vollständige Anleitung für Web-IDE, Build-System und Dateiverwaltung' : 'Complete guide for the Web IDE, build system and file manager'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-4 gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: language === 'de' ? '🚀 Übersicht' : '🚀 Overview' },
            { id: 'filemanager', label: language === 'de' ? '📁 Dateien verschieben' : '📁 Move & Files' },
            { id: 'build', label: language === 'de' ? '☕ Java & Build' : '☕ Java & Build' },
            { id: 'community', label: language === 'de' ? '🌐 Community' : '🌐 Community' },
            { id: 'shortcuts', label: language === 'de' ? '⌨️ Tastenkürzel' : '⌨️ Shortcuts' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm text-slate-300 leading-relaxed flex-1">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Code className="h-5 w-5 text-indigo-400" />
                {language === 'de' ? 'Willkommen in der GodHand Mod-Entwicklungsumgebung' : 'Welcome to GodHand Mod Development Studio'}
              </h3>
              <p>
                {language === 'de' 
                  ? 'GodHand ist eine vollwertige Cloud-IDE zur Erstellung, Kompilierung und Veröffentlichung von Minecraft- und Java-Mods. Mit Monaco Editor, Live-Gradle-Builds und integrierter Dateiverwaltung hast du alle Werkzeuge direkt im Browser.'
                  : 'GodHand is a full-featured Cloud IDE to build, compile, and publish Minecraft and Java mods. With Monaco Editor, live Gradle builds, and built-in file management, you have all tools right inside your browser.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-white text-xs mb-1">⚡ Monaco Editor Engine</h4>
                  <p className="text-xs text-slate-400">
                    {language === 'de' ? 'Syntax-Highlighting für Java, JSON, TypeScript und CSS mit Autovervollständigung.' : 'Syntax highlighting for Java, JSON, TypeScript, and CSS with auto-completion.'}
                  </p>
                </div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-white text-xs mb-1">☕ Java 17 & Java 21</h4>
                  <p className="text-xs text-slate-400">
                    {language === 'de' ? 'Unterstützung für moderne Java-Versionen und automatische Gradle-Kompilierung.' : 'Support for modern Java versions and automatic Gradle compilation.'}
                  </p>
                </div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-white text-xs mb-1">📁 Vollständige Dateiverwaltung</h4>
                  <p className="text-xs text-slate-400">
                    {language === 'de' ? 'Drag & Drop, Verschieben nach oben, Ordnerauswahl-Dialog und Löschen.' : 'Drag & drop, move up, folder picker dialog, and deletion.'}
                  </p>
                </div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <h4 className="font-bold text-white text-xs mb-1">🌍 Community Hub</h4>
                  <p className="text-xs text-slate-400">
                    {language === 'de' ? 'Veröffentliche Mods, teile JAR-Dateien und entdecke Projekte anderer Modder.' : 'Publish mods, share JAR files, and discover projects by other modders.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'filemanager' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">
                {language === 'de' ? 'Dateien und Ordner verschieben & verwalten' : 'Managing & Moving Files and Folders'}
              </h3>
              
              <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/40 space-y-3">
                <h4 className="font-bold text-indigo-300 text-sm flex items-center gap-2">
                  <ArrowUp className="h-4 w-4" />
                  {language === 'de' ? '1. "Eine Ebene nach oben verschieben" (Move Up)' : '1. "Move Up One Level"'}
                </h4>
                <p className="text-xs text-slate-300">
                  {language === 'de'
                    ? 'Befindet sich eine Datei in einem Unterordner (z.B. src/main/java/Mod.java), hast du 2 Möglichkeiten sie nach oben zu verschieben:'
                    : 'If a file is inside a subfolder, you have 2 easy ways to move it up:'}
                </p>
                <ul className="text-xs list-disc pl-5 space-y-1 text-slate-400">
                  <li>
                    <strong className="text-white">{language === 'de' ? 'Per Klick:' : 'Via click:'}</strong> {language === 'de' ? 'Fahre mit der Maus über die Datei und klicke auf das Pfeilsymbol (↑). Die Datei wird sofort in den übergeordneten Ordner verschoben.' : 'Hover over the file and click the arrow up button (↑). The file instantly moves to the parent folder.'}
                  </li>
                  <li>
                    <strong className="text-white">{language === 'de' ? 'Per Drag & Drop:' : 'Via Drag & Drop:'}</strong> {language === 'de' ? 'Sobald du eine Datei ziehst, erscheint oben eine violette Leiste: "[↑ Eine Ebene nach oben verschieben]". Lass die Datei dort los!' : 'When dragging a file, a purple bar appears at the top: "[↑ Move up one level]". Drop the file right onto it!'}
                  </li>
                </ul>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                  <FolderInput className="h-4 w-4" />
                  {language === 'de' ? '2. Verschieben-Dialog (Move-to Modal)' : '2. Move Dialog (Move-to Modal)'}
                </h4>
                <p className="text-xs text-slate-300">
                  {language === 'de'
                    ? 'Klicke auf das Symbol (⇄) neben einer Datei oder einem Ordner. Ein übersichtliches Fenster öffnet sich, in dem du jeden Ordner im Projekt oder das Hauptverzeichnis (Root) mit einem Klick auswählen kannst.'
                    : 'Click the (⇄) icon next to any file or folder. A dialog opens where you can select any destination folder or root directory with a single click.'}
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-blue-400 text-sm flex items-center gap-2">
                  <GripVertical className="h-4 w-4" />
                  {language === 'de' ? '3. Drag & Drop in Ordner & Auto-Aufklappen' : '3. Drag & Drop into Folders & Auto-Expand'}
                </h4>
                <p className="text-xs text-slate-300">
                  {language === 'de'
                    ? 'Ziehe eine Datei direkt auf einen Ordner. Der Ordner wird hervorgehoben ("Hier ablegen"). Verweilst du 500ms mit der Maus über einem geschlossenen Ordner, klappt dieser automatisch auf, sodass du auch in tief verschachtelte Ordner zielsicher ablegen kannst.'
                    : 'Drag a file directly onto a folder. The folder is highlighted with "Drop here". Hovering for 500ms over a closed folder automatically expands it.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'build' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">
                {language === 'de' ? 'Java-Versionen & Gradle Build-System' : 'Java Versions & Gradle Build System'}
              </h3>
              <p>
                {language === 'de'
                  ? 'GodHand führt echte Gradle-Builds auf dem Server aus. Das fertige Mod-Artefakt (.jar) wird im Verzeichnis godhand/build/libs/ erzeugt.'
                  : 'GodHand executes real Gradle builds on the server. The compiled mod artifact (.jar) is created in godhand/build/libs/.'}
              </p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-white">
                  {language === 'de' ? 'Java 17 vs. Java 21 Auswahl:' : 'Java 17 vs. Java 21 Selection:'}
                </div>
                <p className="text-slate-400">
                  {language === 'de'
                    ? 'Wähle in der oberen Menüleiste Java 17 für ältere Minecraft-Versionen (1.18 - 1.20.4) oder Java 21 für moderne Versionen (1.20.5+ / 1.21).'
                    : 'Select Java 17 from the top bar for Minecraft 1.18 - 1.20.4, or Java 21 for modern releases (1.20.5+ / 1.21).'}
                </p>
                <div className="font-bold text-white pt-2">
                  {language === 'de' ? 'Build ausführen & Logs beobachten:' : 'Run Build & Watch Logs:'}
                </div>
                <p className="text-slate-400">
                  {language === 'de'
                    ? 'Klicke auf "Mod kompilieren" (grüner Play-Button). Die Build-Konsole am unteren Rand zeigt Ausgaben und Fehlerzeilen in Echtzeit an. Ein erfolgreicher Build schließt mit BUILD SUCCESSFUL ab.'
                    : 'Click "Build Mod" (green play button). The build console at the bottom shows real-time output and syntax error line numbers. Successful builds end with BUILD SUCCESSFUL.'}
                </p>
                <div className="font-bold text-white pt-2">
                  {language === 'de' ? 'JAR herunterladen:' : 'Download JAR:'}
                </div>
                <p className="text-slate-400">
                  {language === 'de'
                    ? 'Klicke nach erfolgreichem Build auf den Button "JAR" in der oberen Leiste, um deine Mod-Datei herunterzuladen.'
                    : 'After a successful build, click the "JAR" button in the top bar to download your mod file.'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'community' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">
                {language === 'de' ? 'Community Hub & Projekte teilen' : 'Community Hub & Sharing Projects'}
              </h3>
              <p>
                {language === 'de'
                  ? 'Teile deine Mods mit der GodHand-Community oder entdecke Kreationen anderer Entwickler.'
                  : 'Share your mods with the GodHand community or explore creations made by other developers.'}
              </p>
              <ul className="text-xs list-disc pl-5 space-y-2 text-slate-400">
                <li>
                  <strong className="text-white">{language === 'de' ? 'Projekt veröffentlichen:' : 'Publish Project:'}</strong> {language === 'de' ? 'Klicke in der IDE auf "Veröffentlichen" (Globus-Icon). Gib Titel, Beschreibung, Screenshots und optionale JAR/Quellcode-Freigabe an.' : 'Click "Publish" (Globe icon) in the IDE. Enter title, description, cover image, and options.'}
                </li>
                <li>
                  <strong className="text-white">{language === 'de' ? 'Privat & Öffentlich schalten:' : 'Toggle Private / Public:'}</strong> {language === 'de' ? 'Veröffentlichte Mods können im Dashboard jederzeit mit einem Klick auf "Privat machen" wieder verborgen werden.' : 'Published mods can be toggled to private at any time in the Dashboard.'}
                </li>
                <li>
                  <strong className="text-white">{language === 'de' ? 'Likes & Interaktion:' : 'Likes & Interaction:'}</strong> {language === 'de' ? 'Nutzer können Projekte herzen/liken und Details ansehen.' : 'Users can like projects and view mod detail pages.'}
                </li>
                <li>
                  <strong className="text-white">{language === 'de' ? 'Meldesystem:' : 'Reporting System:'}</strong> {language === 'de' ? 'Verdächtige Projekte können gemeldet werden. Moderatoren und Administratoren prüfen gemeldete Inhalte.' : 'Suspicious projects can be reported and reviewed by moderators in the admin panel.'}
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">
                {language === 'de' ? 'Tastatur-Kurzbefehle & Bedienung' : 'Keyboard Shortcuts & Controls'}
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-medium text-slate-300">{language === 'de' ? 'Datei speichern' : 'Save active file'}</span>
                  <kbd className="px-2 py-1 bg-slate-800 text-slate-200 rounded font-mono font-bold">Strg + S / Cmd + S</kbd>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-medium text-slate-300">{language === 'de' ? 'Seitenleiste zurücksetzen' : 'Reset sidebar width'}</span>
                  <span className="text-slate-400">{language === 'de' ? 'Doppelklick auf Trennbalken' : 'Double click sidebar divider'}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-medium text-slate-300">{language === 'de' ? 'Konsole zurücksetzen' : 'Reset console height'}</span>
                  <span className="text-slate-400">{language === 'de' ? 'Doppelklick auf Konsolenbalken' : 'Double click console divider'}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-medium text-slate-300">{language === 'de' ? 'Sprache wechseln' : 'Switch language'}</span>
                  <span className="text-slate-400">{language === 'de' ? 'DE / EN Schalter in der Leiste' : 'DE / EN toggle in header'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {language === 'de' ? 'Schließen' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, role, isStaff, isOwner, username, setUsername, bio, setBio, isProfilePublic, setIsProfilePublic, logout } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();
  const [publishedProjects, setPublishedProjects] = React.useState<any[]>([]);
  const [myProjects, setMyProjects] = React.useState<any[]>([]);
  const [isEditingUsername, setIsEditingUsername] = React.useState(false);
  const [newUsername, setNewUsername] = React.useState(username || '');
  const [newBio, setNewBio] = React.useState(bio || '');
  const [newIsPublic, setNewIsPublic] = React.useState(isProfilePublic);
  const isBackendOffline = useBackendStatus();
  const [projectToDelete, setProjectToDelete] = React.useState<any | null>(null);
  const [publishedProjectToDelete, setPublishedProjectToDelete] = React.useState<any | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
  const [deletePrivateToo, setDeletePrivateToo] = React.useState(false);
  const [showDashboardDocs, setShowDashboardDocs] = React.useState(false);
  const [showDashboardSupport, setShowDashboardSupport] = React.useState(false);

  React.useEffect(() => {
      // Fetch published projects
      const qPublic = query(collection(db, 'published_projects'), where('isPublic', '==', true));
      getDocs(qPublic).then(snapshot => {
        const publicProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (user) {
          const qUserAll = query(collection(db, 'published_projects'), where('authorId', '==', user.uid));
          getDocs(qUserAll).then(userSnap => {
            const userProjects = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Merge and deduplicate by ID
            const projectMap = new Map();
            publicProjects.forEach(p => projectMap.set(p.id, p));
            userProjects.forEach(p => projectMap.set(p.id, p));
            
            const allProjects = Array.from(projectMap.values());
            
            allProjects.sort((a: any, b: any) => {
              const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
              const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
              return timeB - timeA;
            });
            setPublishedProjects(allProjects);
          }).catch(e => {
            console.error("Error fetching user published projects", e);
            setPublishedProjects(publicProjects);
          });
        } else {
          publicProjects.sort((a: any, b: any) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          });
          setPublishedProjects(publicProjects);
        }
      }).catch(err => {
        console.error("Error fetching public projects:", err); toast.error("Error fetching public projects: " + err.message);
        if (user) {
          const qUserAll = query(collection(db, 'published_projects'), where('authorId', '==', user.uid));
          getDocs(qUserAll).then(userSnap => {
            setPublishedProjects(userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }).catch(console.error);
        }
      });

      // Fetch user projects
      if (user) {
        const userProjectsQ = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
        getDocs(userProjectsQ).then(snapshot => {
          const now = Date.now();
          const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;
          const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((p: any) => {
            if (p.status === 'deleted') {
              const deletedAt = p.deletedAt?.toMillis ? p.deletedAt.toMillis() : now;
              return (now - deletedAt) <= fifteenDaysInMs;
            }
            return true;
          });
          setMyProjects(projects);
        }).catch(e => {
          console.error("My projects error:", e);
          toast.error("My projects error: " + e.message);
        });
      } else {
        setMyProjects([]);
      }
  }, [user]);



  const handleSaveProfile = async () => {
    try {
      if (newUsername.trim()) {
        await setUsername(newUsername.trim());
      }
      await setBio(newBio.trim());
      await setIsProfilePublic(newIsPublic);
      setIsEditingUsername(false);
      toast.success("Profile saved!");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDownloadJar = async () => {
    try {
      const res = await fetch('/api/download-jar');
      if (!res.ok) {
        toast.error("JAR file has not been compiled yet! The developer must build the mod first.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'godhand-1.0.0.jar';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      toast.error("Error downloading the JAR.");
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Code className="h-6 w-6 text-emerald-400 shrink-0" />
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">{t("javaModIde")} Dashboard</h1>
        </div>
        <div className="flex items-center space-x-3 sm:space-x-4">
          <LanguageSwitcher />
          <button 
            onClick={() => setShowDashboardDocs(true)} 
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 rounded-lg font-medium text-xs sm:text-sm transition-colors"
            title={t('documentation')}
          >
            <BookOpen className="h-4 w-4 text-emerald-400" />
            <span className="hidden sm:inline">{t('documentation')}</span>
          </button>
          {/* Support Ticket Modal Button */}
          <button 
            onClick={() => setShowDashboardSupport(true)} 
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-lg font-medium text-xs sm:text-sm transition-colors"
            title={t('openTicket')}
          >
            <LifeBuoy className="h-4 w-4 text-indigo-400" />
            <span className="hidden sm:inline">{t('openTicket')}</span>
          </button>

          {isStaff && (
            <button 
              onClick={() => navigate('/admin')} 
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-medium text-xs sm:text-sm transition-all shadow-md"
            >
              <ShieldAlert className="h-4 w-4" />
              <span>{isOwner ? '👑 Owner' : t('teamDashboard')}</span>
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end hidden sm:flex">
              <span 
                className="text-sm font-medium cursor-pointer hover:text-indigo-400 transition-colors truncate max-w-[150px]"
                onClick={() => { 
                  setIsEditingUsername(true); 
                  setNewUsername(username || user.email || ''); 
                  setNewBio(bio || '');
                  setNewIsPublic(isProfilePublic);
                }}
              >
                {username || user.email}
              </span>
              {role !== 'user' && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 rounded-full border border-emerald-500/30 font-bold tracking-wider mt-0.5 uppercase">{role}</span>}
            </div>
            
            <button
              onClick={() => { 
                setIsEditingUsername(true); 
                setNewUsername(username || user.email || ''); 
                setNewBio(bio || '');
                setNewIsPublic(isProfilePublic);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-base sm:text-lg hover:bg-indigo-500/30 transition-colors flex-shrink-0 relative"
              title={t('editProfile')}
            >
              {(username || user.email || 'U').charAt(0).toUpperCase()}
              {role !== 'user' && <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500 rounded-full border-2 border-slate-900 sm:hidden"></span>}
            </button>
          </div>
          <button onClick={logout} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      
      {isEditingUsername && (
        <div className="absolute top-16 right-4 sm:right-6 bg-slate-900 border border-slate-700 p-5 rounded-xl shadow-xl z-50 w-72">
          <h4 className="text-sm font-bold mb-4 text-white">{t('editProfile')}</h4>
          
          <label className="block text-xs font-medium text-slate-400 mb-1">{t('username')}</label>
          <input 
            type="text" 
            value={newUsername} 
            onChange={e => setNewUsername(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm mb-4 w-full focus:outline-none focus:border-indigo-500 text-white"
            placeholder={t('username')}
          />

          <label className="block text-xs font-medium text-slate-400 mb-1">{t('bio')}</label>
          <textarea 
            value={newBio} 
            onChange={e => setNewBio(e.target.value)}
            rows={3}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm mb-4 w-full focus:outline-none focus:border-indigo-500 text-white resize-none"
            placeholder={language === 'de' ? 'Erzähle etwas über dich...' : 'Tell us about yourself...'}
          />

          <div className="flex items-center gap-2 mb-6">
            <input 
              type="checkbox" 
              id="isPublicToggle"
              checked={newIsPublic}
              onChange={e => setNewIsPublic(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500"
            />
            <label htmlFor="isPublicToggle" className="text-sm text-slate-300 cursor-pointer">
              {t('profileIsPublic')}
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setIsEditingUsername(false)} className="text-sm text-slate-400 hover:text-white transition-colors">{t('cancel')}</button>
            <button onClick={handleSaveProfile} className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-medium transition-colors">{t('save')}</button>
          </div>
        </div>
      )}
      
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6" />
            {t('yourProjects')}
          </h2>
          <div className="flex gap-2">
            {isStaff && (
              <button onClick={() => navigate('/admin')} className="sm:hidden flex-1 flex justify-center items-center space-x-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-lg font-medium transition-colors">
                <ShieldAlert className="h-5 w-5" />
                <span>Admin</span>
              </button>
            )}
            <button onClick={() => navigate('/ide/mod-' + Math.random().toString(36).substring(7))} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all">
              <Plus className="h-5 w-5" />
              {t('newProject')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {myProjects.length === 0 ? (
            <p className="text-slate-500 col-span-full">{t('noProjectsYet')}</p>
          ) : (
            myProjects.map((project: any) => (
              <div 
                key={project.id}
                onClick={() => {
                  if (project.status !== 'deleted') {
                    navigate(`/ide/${project.id}`);
                  }
                }}
                className={`bg-slate-900 border ${project.status === 'deleted' ? 'border-rose-900/50 opacity-75' : 'border-slate-800 hover:border-slate-700'} rounded-xl p-5 transition-all group ${project.status !== 'deleted' ? 'cursor-pointer' : ''} flex flex-col`}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg">{project.name}</h3>
                  <div className="flex gap-1">
                    {project.status === 'quarantined' && (
                      <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-1 rounded font-bold uppercase">{language === 'de' ? 'In Quarantäne' : 'Quarantined'}</span>
                    )}
                    {project.status === 'deleted' && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded font-bold uppercase">{language === 'de' ? 'Gelöscht' : 'Deleted'}</span>
                    )}
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded">Java</span>
                  </div>
                </div>
                <div className="text-slate-400 text-sm mb-6 flex-1">
                  {project.status === 'quarantined' && (
                    <p>{t('quarantineDesc')}</p>
                  )}
                  {project.status === 'deleted' && project.deletedBy === 'admin' && (
                    <div className="bg-rose-950/50 border border-rose-900/50 p-3 rounded-lg text-rose-300">
                      <p className="font-bold mb-1 flex items-center gap-1"><ShieldAlert className="w-4 h-4" /> {language === 'de' ? 'Admin-Löschung' : 'Admin Deletion'}</p>
                      <p className="mb-2">{language === 'de' ? 'Grund' : 'Reason'}: {project.deleteReason}</p>
                      <p className="text-xs">{t('deletedDesc')}</p>
                    </div>
                  )}
                  {project.status === 'deleted' && project.deletedBy === 'user' && (
                    <p className="text-rose-400/70">{language === 'de' ? 'Dieses Projekt wurde von Ihnen gelöscht.' : 'This project was deleted by you and will be permanently removed shortly.'}</p>
                  )}
                  {project.status === 'active' && (
                    <p>{t('testProjectDesc')}</p>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-auto pt-4 border-t border-slate-800/50">
                  <span>{language === 'de' ? 'Erstellt' : 'Created'}: {project.createdAt?.toDate ? project.createdAt.toDate().toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US') : (language === 'de' ? 'heute' : 'today')}</span>
                  
                  <div className="flex gap-2">
                    {project.status === 'deleted' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDoc(doc(db, 'projects', project.id)).then(() => {
                            setMyProjects(prev => prev.filter(p => p.id !== project.id));
                          });
                        }}
                        className="text-rose-500 hover:text-rose-400 text-xs transition-colors z-10 relative bg-rose-500/10 px-2 py-1 rounded font-medium"
                      >
                        {language === 'de' ? 'Ausblenden / Entfernen' : 'Hide / Remove'}
                      </button>
                    )}
                    {project.status !== 'deleted' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(project);
                          setDeleteConfirmation('');
                        }}
                        className="text-slate-500 hover:text-rose-400 transition-colors z-10 relative"
                        title={t("delete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {project.status !== 'deleted' && (
                      <button className="text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-medium">
                        {t("open")} <span className="text-lg leading-none">&rarr;</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-indigo-400" />
            {t('communityProjects')}
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publishedProjects.length === 0 ? (
            <p className="text-slate-500 col-span-full">{t('noPublishedProjects')}</p>
          ) : (
            publishedProjects.map((project: any) => (
              <div 
                key={project.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all flex flex-col cursor-pointer"
                onClick={() => navigate(`/mod/${project.id}`)}
              >
                {project.coverImage && (
                  <div className="w-full h-32 bg-slate-800 relative">
                    <img src={project.coverImage} alt={project.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-indigo-300">{project.title}</h3>
                    <div className="flex gap-1">
                      {!project.isPublic && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-1 rounded">Private</span>
                      )}
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded">Java {project.javaVersion || '21'}</span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm mb-4 flex-1">{project.description}</p>
                  <div className="flex items-center justify-between text-xs text-slate-500 mt-auto pt-4 border-t border-slate-800/50">
                    <span 
                      className="truncate pr-2 hover:text-indigo-400 cursor-pointer transition-colors"
                      onClick={(e) => { e.stopPropagation(); navigate(`/user/${project.authorId}`); }}
                    >
                      {language === 'de' ? 'Von' : 'By'}: {project.authorUsername || project.authorEmail}
                    </span>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-rose-400">
                        <Heart className="w-3 h-3 fill-current" />
                        <span>{project.likesCount || 0}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {project.includeJar && (
                          <button onClick={(e) => { e.stopPropagation(); window.open(`/api/download-jar?id=${project.id}`, '_blank'); }} className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 font-medium bg-emerald-500/10 px-2 py-1 rounded">
                            {t('downloadJar')}
                          </button>
                        )}
                      
                      {user && (user.uid === project.authorId || role === 'admin' || role === 'mod') && (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDoc(doc(db, 'published_projects', project.id), { isPublic: !project.isPublic }).then(() => {
                                setPublishedProjects(prev => prev.map(p => p.id === project.id ? { ...p, isPublic: !p.isPublic } : p));
                              });
                            }} 
                            className={`${project.isPublic ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10' : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10'} transition-colors flex items-center gap-1 font-medium px-2 py-1 rounded`}
                          >
                            {project.isPublic ? t('makePrivate') : t('makePublic')}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPublishedProjectToDelete(project);
                              setDeleteConfirmation('');
                            }} 
                            className="text-rose-400 hover:text-rose-300 bg-rose-500/10 transition-colors flex items-center gap-1 font-medium px-2 py-1 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      
                      <button className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 font-medium bg-indigo-500/10 px-2 py-1 rounded">
                        {t('view')}
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {projectToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-rose-900/50 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trash2 className="text-rose-500 w-6 h-6" />
              {t('deleteProjectModalTitle')}
            </h2>
            <p className="text-slate-300 mb-4">
              {t('deleteProjectModalText', { name: projectToDelete.name })}
            </p>
            <p className="text-sm text-slate-400 mb-6 bg-slate-950 p-3 rounded border border-slate-800">
              {t('confirmTypePrompt', { name: projectToDelete.name })}
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={t('typeConfirmPlaceholder', { name: projectToDelete.name })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white mb-6 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmation.trim().toLowerCase() === `confirm ${projectToDelete.name}`.trim().toLowerCase()) {
                    updateDoc(doc(db, 'projects', projectToDelete.id), {
                      status: 'deleted',
                      deletedBy: 'user',
                      deletedAt: serverTimestamp(),
                      updatedAt: serverTimestamp()
                    }).then(() => {
                      setMyProjects(prev => prev.map(p => p.id === projectToDelete.id ? { ...p, status: 'deleted', deletedBy: 'user' } : p));
                      setProjectToDelete(null);
                    }).catch(e => { 
                      console.error("User Delete Error:", e); 
                      toast.error("Error: " + e.message);
                    });
                  }
                }}
                disabled={deleteConfirmation.trim().toLowerCase() !== `confirm ${projectToDelete.name}`.trim().toLowerCase()}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {t('confirmDeletion')}
              </button>
            </div>
          </div>
        </div>
      )}

      {publishedProjectToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-rose-900/50 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trash2 className="text-rose-500 w-6 h-6" />
              {t('deletePublishedProject')}
            </h2>
            <p className="text-slate-300 mb-4">
              {t('deletePublishedModalText', { name: publishedProjectToDelete.title })}
            </p>
            
            {user && user.uid === publishedProjectToDelete.authorId && (
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

            <p className="text-sm text-slate-400 mb-4 bg-slate-950 p-3 rounded border border-slate-800">
              {t('confirmTypePrompt', { name: publishedProjectToDelete.title })}
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={t('typeConfirmPlaceholder', { name: publishedProjectToDelete.title })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white mb-6 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPublishedProjectToDelete(null)}
                className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmation.trim().toLowerCase() === `confirm ${publishedProjectToDelete.title}`.trim().toLowerCase()) {
                    deleteDoc(doc(db, 'published_projects', publishedProjectToDelete.id)).then(() => {
                      if (deletePrivateToo) {
                        if (publishedProjectToDelete.originalProjectId) {
                          deleteDoc(doc(db, 'projects', publishedProjectToDelete.originalProjectId)).catch(console.warn);
                        } else {
                          toast.error(t('olderVersionDeleteWarning'));
                        }
                      }
                      setPublishedProjects(prev => prev.filter(p => p.id !== publishedProjectToDelete.id));
                      setPublishedProjectToDelete(null);
                    }).catch(e => {
                      console.error("Delete published project error:", e);
                      toast.error(t('deleteError'));
                    });
                  }
                }}
                disabled={deleteConfirmation.trim().toLowerCase() !== `confirm ${publishedProjectToDelete.title}`.trim().toLowerCase()}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {t('confirmDeletion')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Documentation Modal for Dashboard */}
      <DocumentationModal isOpen={showDashboardDocs} onClose={() => setShowDashboardDocs(false)} language={language} />

      {/* Support Ticket Modal for Dashboard */}
      <SupportTicketModal isOpen={showDashboardSupport} onClose={() => setShowDashboardSupport(false)} />
    </div>
  );
}

function AppRoutes() {
  const { user, role, loading, isStaff } = useAuth();
  const { t } = useTranslation();
  const [isSystemOffline, setIsSystemOffline] = React.useState(false);

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'system'), (snapshot) => {
      if (snapshot.exists()) {
        setIsSystemOffline(snapshot.data().isOffline);
      } else {
        setIsSystemOffline(false);
      }
    });
    return () => unsub();
  }, []);

  if (loading) return null;

  if (isSystemOffline && !isStaff) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-amber-500/50 p-8 rounded-xl max-w-md w-full shadow-2xl text-center">
          <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">{t('maintenanceModeTitle')}</h1>
          <p className="text-slate-400 mb-6">{t('maintenanceModeDesc')}</p>
          {user && (
            <button onClick={() => signOut(auth)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg">
              {t('logout')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/ide" element={<Navigate to="/ide/godhand" replace />} />
      <Route path="/ide/:projectId" element={<IDE />} />
      <Route path="/mod/:id" element={<ModDetails />} />
      <Route path="/user/:userId" element={<UserProfile />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
