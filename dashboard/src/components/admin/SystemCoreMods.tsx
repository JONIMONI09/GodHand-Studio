import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Cpu, 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Play, 
  Save, 
  Download, 
  RefreshCw, 
  Plus, 
  Terminal, 
  Copy, 
  Trash2, 
  Layers, 
  ExternalLink, 
  ShieldCheck, 
  Code2, 
  FileCode, 
  Maximize2, 
  Minimize2, 
  CheckCircle2, 
  AlertCircle, 
  WrapText, 
  FolderPlus,
  Box,
  Sliders,
  Check,
  X,
  ChevronsUpDown,
  Bug,
  Sparkles
} from 'lucide-react';
import { useTranslation } from '../../i18n/translations';
import { toast } from 'react-hot-toast';

interface SystemMod {
  id: string;
  name: string;
  description: string;
  version: string;
  loader?: string;
  isSample?: boolean;
  mcVersion?: string;
  targetMinecraft: string;
  targetJava: string;
  targetArch: string;
  path: string;
  jarExists: boolean;
  jarSize: number;
  jarName: string;
  status: 'idle' | 'building' | 'success' | 'failed';
  logs: string[];
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  size?: number;
}

export const SystemCoreMods: React.FC = () => {
  const { t, language } = useTranslation();

  // Core mod list state
  const [mods, setMods] = useState<SystemMod[]>([]);
  const [selectedModId, setSelectedModId] = useState<string>('arm32-fix');
  const [isLoadingMods, setIsLoadingMods] = useState<boolean>(true);

  // File tree & editor state
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [activeFilePath, setActiveFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [isSavingFile, setIsSavingFile] = useState<boolean>(false);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [fontSize, setFontSize] = useState<number>(13);
  const [isEditorMaximized, setIsEditorMaximized] = useState<boolean>(false);

  // Compiler terminal state & Tab Palette
  const [logs, setLogs] = useState<string[]>([]);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState<boolean>(false);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [terminalTab, setTerminalTab] = useState<'logs' | 'tasks' | 'diagnose'>('logs');
  const [customCmd, setCustomCmd] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // New mod scaffold modal
  const [showNewModModal, setShowNewModModal] = useState<boolean>(false);
  const [newModId, setNewModId] = useState<string>('');
  const [newModName, setNewModName] = useState<string>('');
  const [newModDescription, setNewModDescription] = useState<string>('');
  const [newModLoader, setNewModLoader] = useState<string>('fabric');
  const [newModMcVersion, setNewModMcVersion] = useState<string>('1.21.1');
  const [newModIsSample, setNewModIsSample] = useState<boolean>(false);
  const [isCreatingMod, setIsCreatingMod] = useState<boolean>(false);

  // New file creation in mod
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileFolder, setNewFileFolder] = useState<string>('');

  // Selected mod reference
  const selectedMod = mods.find(m => m.id === selectedModId) || mods[0];
  const isDirty = activeFilePath !== '' && fileContent !== originalContent;

  // 1. Fetch system mods
  const fetchMods = async (maintainSelection = true) => {
    try {
      const res = await fetch('/api/system-mods');
      if (res.ok) {
        const data = await res.json();
        const list: SystemMod[] = data.mods || [];
        setMods(list);
        if (list.length > 0) {
          if (!maintainSelection || !list.some(m => m.id === selectedModId)) {
            setSelectedModId(list[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch system mods:', err);
    } finally {
      setIsLoadingMods(false);
    }
  };

  useEffect(() => {
    fetchMods(false);
  }, []);

  // 2. Fetch File Tree for selected mod
  const fetchTree = async (modId: string) => {
    if (!modId) return;
    setIsLoadingTree(true);
    try {
      const res = await fetch(`/api/system-mods/${modId}/tree`);
      if (res.ok) {
        const data = await res.json();
        const tree = data.tree || [];
        setFileTree(tree);

        // Auto-expand root folders
        const initialExpanded: Record<string, boolean> = {};
        const expandFirstLevel = (nodes: TreeNode[]) => {
          for (const node of nodes) {
            if (node.type === 'folder') {
              initialExpanded[node.path] = true;
              if (node.children) {
                for (const sub of node.children) {
                  if (sub.type === 'folder' && (sub.name === 'main' || sub.name === 'java' || sub.name === 'resources')) {
                    initialExpanded[sub.path] = true;
                  }
                }
              }
            }
          }
        };
        expandFirstLevel(tree);
        setExpandedFolders(prev => ({ ...prev, ...initialExpanded }));

        // Auto-open primary source file if nothing open
        const findDefaultFile = (nodes: TreeNode[]): string | null => {
          for (const node of nodes) {
            if (node.type === 'file' && (node.name.endsWith('.java') || node.name === 'build.gradle' || node.name === 'fabric.mod.json')) {
              return node.path;
            }
            if (node.children) {
              const f = findDefaultFile(node.children);
              if (f) return f;
            }
          }
          return null;
        };

        const firstFile = findDefaultFile(tree);
        if (firstFile) {
          loadFile(modId, firstFile);
        } else {
          setActiveFilePath('');
          setFileContent('');
          setOriginalContent('');
        }
      }
    } catch (err) {
      console.error('Failed to load file tree:', err);
      toast.error('Failed to load mod file hierarchy');
    } finally {
      setIsLoadingTree(false);
    }
  };

  useEffect(() => {
    if (selectedModId) {
      fetchTree(selectedModId);
      // Synchronize logs & status
      const cur = mods.find(m => m.id === selectedModId);
      if (cur) {
        setLogs(cur.logs || []);
        setIsBuilding(cur.status === 'building');
      }
    }
  }, [selectedModId]);

  // 3. Polling when building
  useEffect(() => {
    let interval: any = null;
    if (isBuilding) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/system-mods');
          if (res.ok) {
            const data = await res.json();
            const list: SystemMod[] = data.mods || [];
            setMods(list);
            const cur = list.find(m => m.id === selectedModId);
            if (cur) {
              setLogs(cur.logs || []);
              if (cur.status !== 'building') {
                setIsBuilding(false);
                if (cur.status === 'success') {
                  toast.success(language === 'de' ? `Build erfolgreich: ${cur.jarName}` : `Build successful: ${cur.jarName}`);
                } else if (cur.status === 'failed') {
                  toast.error(language === 'de' ? 'Build fehlgeschlagen' : 'Build failed');
                }
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBuilding, selectedModId, language]);

  // Auto-scroll logs
  useEffect(() => {
    if (!isTerminalCollapsed && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isTerminalCollapsed]);

  // 4. Load File Content
  const loadFile = async (modId: string, path: string) => {
    if (isDirty) {
      const confirmSwitch = window.confirm(
        language === 'de' 
          ? 'Du hast ungespeicherte Änderungen. Möchtest du die Datei trotzdem wechseln?' 
          : 'You have unsaved changes. Do you want to switch files anyway?'
      );
      if (!confirmSwitch) return;
    }

    setIsLoadingFile(true);
    try {
      const res = await fetch(`/api/system-mods/${modId}/file?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveFilePath(path);
        setFileContent(data.content || '');
        setOriginalContent(data.content || '');
      } else {
        toast.error('Could not read file content');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error fetching file content');
    } finally {
      setIsLoadingFile(false);
    }
  };

  // 5. Save File Content
  const handleSaveFile = async () => {
    if (!activeFilePath || !selectedModId || isSavingFile) return;
    setIsSavingFile(true);
    try {
      const res = await fetch(`/api/system-mods/${selectedModId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: activeFilePath,
          content: fileContent
        })
      });
      if (res.ok) {
        setOriginalContent(fileContent);
        toast.success(language === 'de' ? 'Quelldatei erfolgreich gespeichert' : 'Source file saved successfully');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save file');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving file');
    } finally {
      setIsSavingFile(false);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFilePath, fileContent, selectedModId]);

  // 6. Trigger Build
  const handleTriggerBuild = async () => {
    if (!selectedModId || isBuilding) return;
    setIsBuilding(true);
    try {
      const res = await fetch(`/api/system-mods/${selectedModId}/build`, {
        method: 'POST'
      });
      if (res.ok) {
        toast(language === 'de' ? 'Build-Pipeline gestartet...' : 'Build pipeline initiated...', {
          icon: '⚡'
        });
        // Initial fetch to get started
        setTimeout(() => fetchMods(true), 500);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to trigger build');
        setIsBuilding(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Build initiation error');
      setIsBuilding(false);
    }
  };

  // 7. Scaffold New Mod
  const handleCreateMod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModId.trim()) return;
    setIsCreatingMod(true);
    try {
      const res = await fetch('/api/system-mods/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newModId.trim(),
          name: newModName.trim() || newModId.trim(),
          description: newModDescription.trim(),
          loader: newModLoader,
          mcVersion: newModMcVersion,
          isSample: newModIsSample
        })
      });
      if (res.ok) {
        toast.success(language === 'de' ? 'Neuer System-Mod erfolgreich erstellt!' : 'New System Core Mod created!');
        setShowNewModModal(false);
        setNewModId('');
        setNewModName('');
        setNewModDescription('');
        setNewModIsSample(false);
        await fetchMods(true);
        setSelectedModId(newModId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create system mod');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating system mod');
    } finally {
      setIsCreatingMod(false);
    }
  };

  // Toggle sample mod template status
  const handleToggleSample = async (modId: string) => {
    try {
      const res = await fetch(`/api/system-mods/${modId}/toggle-sample`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.isSample 
          ? (language === 'de' ? 'Mod als Beispiel-Vorlage markiert' : 'Mod marked as Sample Template')
          : (language === 'de' ? 'Beispiel-Status entfernt' : 'Sample template status removed')
        );
        await fetchMods(true);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error toggling sample status');
    }
  };

  // Diagnostic scan in Admin
  const handleScanAdminCode = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/compiler/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: fileContent, filePath: activeFilePath })
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data.diagnostics || []);
        if (!data.diagnostics || data.diagnostics.length === 0) {
          toast.success(t('noIssuesFound'));
        } else {
          toast(t('issuesFound', { count: String(data.diagnostics.length) }), { icon: '🔍' });
        }
      }
    } catch (err: any) {
      toast.error('Diagnostic error: ' + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyAdminFix = async (item: any) => {
    try {
      const res = await fetch('/api/compiler/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: fileContent,
          line: item.line,
          typo: item.typo,
          suggestedFix: item.suggestedFix,
          type: item.type
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fixedCode) {
          setFileContent(data.fixedCode);
          setDiagnostics(prev => prev.filter(d => d !== item));
          toast.success(language === 'de' ? `Korrektur auf Zeile ${item.line} angewendet!` : `Fix applied to line ${item.line}!`);
        }
      }
    } catch (err: any) {
      toast.error('Failed to apply fix: ' + err.message);
    }
  };

  // 8. Create New File in Mod
  const handleCreateNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim() || !selectedModId) return;
    const targetPath = newFileFolder 
      ? `${newFileFolder}/${newFileName.trim()}`
      : newFileName.trim();

    try {
      const defaultContent = targetPath.endsWith('.java')
        ? `package com.yourcompany;\n\npublic class ${newFileName.replace('.java', '')} {\n    // System Core Mod Component\n}\n`
        : targetPath.endsWith('.json')
        ? `{\n  "version": "1.0.0"\n}\n`
        : '';

      const res = await fetch(`/api/system-mods/${selectedModId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: targetPath,
          content: defaultContent
        })
      });
      if (res.ok) {
        toast.success(language === 'de' ? `Datei erstellt: ${targetPath}` : `File created: ${targetPath}`);
        setShowNewFileModal(false);
        setNewFileName('');
        await fetchTree(selectedModId);
        loadFile(selectedModId, targetPath);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create file');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating file');
    }
  };

  // Language detection for Monaco
  const getEditorLanguage = (filePath: string) => {
    if (filePath.endsWith('.java')) return 'java';
    if (filePath.endsWith('.json')) return 'json';
    if (filePath.endsWith('.gradle')) return 'groovy';
    if (filePath.endsWith('.properties') || filePath.endsWith('.txt')) return 'ini';
    if (filePath.endsWith('.md')) return 'markdown';
    if (filePath.endsWith('.xml')) return 'xml';
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 'typescript';
    if (filePath.endsWith('.js')) return 'javascript';
    return 'plaintext';
  };

  // Check if a folder is currently expanded (accounting for default depth expansion)
  const isFolderExpanded = (path: string, depth = 0): boolean => {
    return expandedFolders[path] !== undefined ? Boolean(expandedFolders[path]) : depth < 2;
  };

  // Check if ANY folder in the tree is currently expanded
  const isAnyFolderOpen = (items: TreeNode[], depth = 0): boolean => {
    for (const item of items) {
      if (item.type === 'folder') {
        if (isFolderExpanded(item.path, depth)) return true;
        if (item.children && isAnyFolderOpen(item.children, depth + 1)) return true;
      }
    }
    return false;
  };

  // Toggle single folder open/closed
  const toggleFolder = (path: string, currentIsExpanded: boolean) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !currentIsExpanded }));
  };

  const handleToggleExpandAll = () => {
    const hasAnyOpen = isAnyFolderOpen(fileTree);
    const targetState = !hasAnyOpen;
    const newMap: Record<string, boolean> = {};
    const traverse = (items: TreeNode[]) => {
      for (const item of items) {
        if (item.type === 'folder') {
          newMap[item.path] = targetState;
          if (item.children) traverse(item.children);
        }
      }
    };
    traverse(fileTree);
    setExpandedFolders(newMap);
    toast(hasAnyOpen ? t('collapseAllFolders') : t('expandAllFolders'), { icon: hasAnyOpen ? '📁' : '📂' });
  };

  // Render Tree Recursive
  const renderTreeNodes = (nodes: TreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const isFolder = node.type === 'folder';
      const isExpanded = isFolderExpanded(node.path, depth);
      const isSelected = activeFilePath === node.path;

      return (
        <div key={node.path} className="select-none">
          <div
            onClick={() => {
              if (isFolder) {
                toggleFolder(node.path, isExpanded);
              } else {
                loadFile(selectedModId, node.path);
              }
            }}
            style={{ paddingLeft: `${depth * 10 + 6}px` }}
            className={`flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer text-xs transition-colors group ${
              isSelected 
                ? 'bg-amber-500/20 text-amber-300 font-semibold border-l-2 border-amber-500' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#202028]'
            }`}
          >
            <div className="flex items-center space-x-1.5 min-w-0">
              {isFolder ? (
                <>
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  )}
                  <Folder className={`h-3.5 w-3.5 shrink-0 ${isExpanded ? 'text-amber-400' : 'text-slate-400'}`} />
                </>
              ) : (
                <>
                  <span className="w-3.5 shrink-0" />
                  {node.name.endsWith('.java') ? (
                    <FileCode className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  ) : node.name.endsWith('.json') ? (
                    <Code2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : node.name.endsWith('.gradle') ? (
                    <Sliders className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  ) : (
                    <File className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  )}
                </>
              )}
              <span className="truncate text-[11px]">{node.name}</span>
            </div>

            {isFolder && (
              <button
                title="Add file in this folder"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewFileFolder(node.path);
                  setShowNewFileModal(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-amber-300 text-slate-500 transition-opacity"
              >
                <Plus className="h-3 w-3" />
              </button>
            )}
          </div>

          {isFolder && isExpanded && node.children && (
            <div>{renderTreeNodes(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131317]">
      {/* ================= TOP BAR: OWNER WORKSPACE HEADER & MOD SELECTOR ================= */}
      <div className="bg-[#17171d] border-b border-[#25252b] p-4 shrink-0 space-y-4">
        {/* Workspace Identity and Owner Scope Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider flex items-center space-x-1">
                <ShieldCheck className="h-3 w-3 text-amber-400" />
                <span>Owner Root Workspace</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {language === 'de' ? 'Vollständige Mod-Entwicklungsumgebung' : 'Complete Internal Mod Suite'}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/10 text-rose-400/90 border border-rose-500/20">
                {language === 'de' ? 'Kein Melden · Kein Veröffentlichen' : 'Private · Isolated'}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
              <Cpu className="h-5 w-5 text-amber-400" />
              <span>{t('systemCoreModsTitle')}</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl">
              {t('systemCoreModsSubtitle')}
            </p>
          </div>

          {/* Action Header: Create New Mod + Open Standalone IDE */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setShowNewModModal(true)}
              className="px-3 py-1.5 bg-[#25252e] hover:bg-[#2d2d38] text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('createNewMod')}</span>
            </button>
            <a
              href={`/ide/core-${selectedModId}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-[#202028] hover:bg-[#282834] text-slate-300 hover:text-white border border-[#2d2d38] rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              title={t('openInFullIde')}
            >
              <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
              <span>{t('openInFullIde')}</span>
            </a>
          </div>
        </div>

        {/* Mod Selector Tabs / Cards */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {isLoadingMods ? (
            <div className="text-xs text-slate-500 py-2">Loading core mods...</div>
          ) : mods.length === 0 ? (
            <div className="text-xs text-slate-500">{t('noSystemModsFound')}</div>
          ) : (
            mods.map((mod) => {
              const isSelected = mod.id === selectedModId;
              return (
                <button
                  key={mod.id}
                  onClick={() => {
                    if (mod.id !== selectedModId) {
                      if (isDirty) {
                        const ok = window.confirm(t('switchModConfirm'));
                        if (!ok) return;
                      }
                      setSelectedModId(mod.id);
                    }
                  }}
                  className={`flex items-center space-x-2.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all text-left shrink-0 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-sm ring-1 ring-amber-500/30'
                      : 'bg-[#1a1a22] border-[#25252e] text-slate-400 hover:text-slate-200 hover:bg-[#202028]'
                  }`}
                >
                  <Box className={`h-4 w-4 shrink-0 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-slate-200">{mod.name}</span>
                      <span className="text-[10px] font-mono text-slate-500">v{mod.version}</span>
                      {mod.loader && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {mod.loader}
                        </span>
                      )}
                      {mod.isSample && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          ⭐ Sample
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                      {mod.id === 'arm32-fix' ? 'ARMv7/ARMv8l Fix' : mod.id === 'godhand' ? 'Core Mod Engine' : mod.description}
                    </div>
                  </div>
                  {mod.jarExists && (
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" title="JAR Compiled" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Selected Mod Quick Info & Action Bar */}
        {selectedMod && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#25252b]/60">
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 bg-[#1f1f27] border border-[#2d2d38] rounded-md font-mono text-[11px] text-slate-300">
                {selectedMod.path}
              </span>
              <span className="px-2 py-0.5 bg-[#1f1f27] border border-[#2d2d38] rounded-md font-mono text-[11px] text-indigo-300">
                {selectedMod.targetMinecraft}
              </span>
              <span className="px-2 py-0.5 bg-[#1f1f27] border border-[#2d2d38] rounded-md font-mono text-[11px] text-amber-300">
                {selectedMod.targetJava}
              </span>
              {selectedMod.isSample && (
                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-md font-mono text-[11px] text-amber-300 flex items-center space-x-1">
                  <span>⭐</span>
                  <span>{t('sampleTemplateBadge')}</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {/* Toggle Sample Status */}
              <button
                onClick={() => handleToggleSample(selectedMod.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 border transition-colors ${
                  selectedMod.isSample
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-[#202028] text-slate-300 border-[#2d2d38] hover:bg-[#282834]'
                }`}
                title={selectedMod.isSample ? t('unmarkAsSample') : t('markAsSample')}
              >
                <span>⭐</span>
                <span>{selectedMod.isSample ? t('sampleTemplateBadge') : t('markAsSample')}</span>
              </button>

              {/* Build Button */}
              <button
                onClick={handleTriggerBuild}
                disabled={isBuilding}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isBuilding ? 'animate-spin' : ''}`} />
                <span>{isBuilding ? t('compilingCoreMod') : t('compileCoreMod')}</span>
              </button>

              {/* Download JAR */}
              <a
                href={`/api/system-mods/${selectedMod.id}/download`}
                download={selectedMod.jarName}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  selectedMod.jarExists
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-500 pointer-events-none border border-slate-700'
                }`}
                title={selectedMod.jarExists ? `Download ${selectedMod.jarName}` : 'Compile mod first'}
              >
                <Download className="h-3.5 w-3.5" />
                <span>
                  {t('downloadModJar')} {selectedMod.jarSize > 0 ? `(${(selectedMod.jarSize / 1024).toFixed(1)} KB)` : ''}
                </span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ================= MIDDLE WORKSPACE: FILE TREE & MONACO CODE EDITOR ================= */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Left: Mod File Hierarchy Tree */}
        <div className="w-64 bg-[#17171d] border-r border-[#25252b] flex flex-col shrink-0">
          <div className="h-9 px-3 bg-[#1b1b22] border-b border-[#25252b] flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Folder className="h-3.5 w-3.5 text-amber-400" />
              <span>{selectedMod ? selectedMod.id : 'Files'}</span>
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleToggleExpandAll}
                className="p-1 hover:bg-[#282834] rounded text-slate-400 hover:text-white"
                title={Object.values(expandedFolders).some(v => v === true) ? t('collapseAllFolders') : t('expandAllFolders')}
              >
                <ChevronsUpDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setNewFileFolder('');
                  setShowNewFileModal(true);
                }}
                className="p-1 hover:bg-[#282834] rounded text-slate-400 hover:text-white"
                title="Create file in root"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => selectedModId && fetchTree(selectedModId)}
                className="p-1 hover:bg-[#282834] rounded text-slate-400 hover:text-white"
                title="Refresh tree"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingTree ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {isLoadingTree ? (
              <div className="text-xs text-slate-500 p-3 text-center">Loading files...</div>
            ) : fileTree.length === 0 ? (
              <div className="text-xs text-slate-500 p-3 text-center">No source files</div>
            ) : (
              renderTreeNodes(fileTree)
            )}
          </div>
        </div>

        {/* Center / Right: Monaco Code Editor */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] relative">
          {/* Editor Header Bar */}
          <div className="h-9 bg-[#252526] border-b border-[#2d2d2d] flex items-center justify-between px-3 shrink-0">
            {/* Active file breadcrumbs */}
            <div className="flex items-center space-x-2 min-w-0">
              <div className="flex items-center space-x-1.5 text-xs bg-[#1e1e1e] px-2.5 py-1 rounded-t border-t-2 border-amber-500">
                <FileCode className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-semibold text-slate-200 truncate max-w-xs">
                  {activeFilePath ? activeFilePath.split('/').pop() : 'Select a file'}
                </span>
                {isDirty && (
                  <span className="h-2 w-2 rounded-full bg-amber-400" title="Unsaved changes (Ctrl+S to save)" />
                )}
              </div>
              <span className="text-[11px] text-slate-500 hidden md:inline truncate">
                {activeFilePath}
              </span>
            </div>

            {/* Editor Action Controls */}
            <div className="flex items-center space-x-1.5">
              {/* Word wrap */}
              <button
                onClick={() => setWordWrap(w => w === 'on' ? 'off' : 'on')}
                className={`p-1 rounded text-xs transition-colors ${
                  wordWrap === 'on' ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-white'
                }`}
                title="Toggle Word Wrap"
              >
                <WrapText className="h-3.5 w-3.5" />
              </button>

              {/* Font sizing */}
              <button
                onClick={() => setFontSize(s => Math.max(10, s - 1))}
                className="px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-400 hover:text-white hover:bg-[#333]"
                title="Decrease font size"
              >
                A-
              </button>
              <button
                onClick={() => setFontSize(s => Math.min(22, s + 1))}
                className="px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-400 hover:text-white hover:bg-[#333]"
                title="Increase font size"
              >
                A+
              </button>

              {/* Save Button */}
              <button
                onClick={handleSaveFile}
                disabled={!isDirty || isSavingFile}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded text-xs font-medium flex items-center space-x-1 transition-colors"
                title="Save source file (Ctrl+S)"
              >
                {isSavingFile ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                <span>{language === 'de' ? 'Speichern' : 'Save'}</span>
              </button>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 relative overflow-hidden">
            {isLoadingFile ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                <RefreshCw className="h-4 w-4 animate-spin mr-2 text-amber-400" />
                Loading source code...
              </div>
            ) : activeFilePath ? (
              <Editor
                height="100%"
                language={getEditorLanguage(activeFilePath)}
                value={fileContent}
                onChange={(val?: string) => setFileContent(val || '')}
                theme="vs-dark"
                options={{
                  fontSize,
                  wordWrap,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  tabSize: 4,
                  automaticLayout: true,
                  formatOnPaste: true,
                  lineNumbers: 'on',
                  cursorBlinking: 'smooth'
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 p-6 text-center">
                <FileCode className="h-8 w-8 text-slate-600" />
                <p className="text-xs">Select a source file from the hierarchy on the left to edit and inspect code.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= BOTTOM WORKSPACE: LIVE COMPILER TERMINAL CONSOLE ================= */}
      <div className={`bg-[#141418] border-t border-[#25252b] transition-all flex flex-col shrink-0 ${
        isTerminalCollapsed ? 'h-9' : 'h-48 sm:h-56'
      }`}>
        {/* Terminal Header & Mode Tabs */}
        <div 
          onClick={isTerminalCollapsed ? () => setIsTerminalCollapsed(false) : undefined}
          className={`h-9 px-4 bg-[#181820] border-b border-[#25252b] flex items-center justify-between shrink-0 select-none ${
            isTerminalCollapsed ? 'cursor-pointer hover:bg-[#202028]' : ''
          }`}
        >
          <div className="flex items-center space-x-2 text-xs font-semibold text-white">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTerminalTab('logs');
                setIsTerminalCollapsed(false);
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                terminalTab === 'logs'
                  ? 'bg-[#141418] text-white border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="h-3.5 w-3.5 text-amber-400" />
              <span>{t('modCompilerConsole')}</span>
            </button>

            {/* The + Task Palette Tab */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTerminalTab('tasks');
                setIsTerminalCollapsed(false);
              }}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                terminalTab === 'tasks'
                  ? 'bg-[#141418] text-indigo-300 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-indigo-300'
              }`}
            >
              <Plus className="h-3.5 w-3.5 text-emerald-400" />
              <span>{t('compilerTasksTitle')}</span>
            </button>

            {/* Diagnostic Scanner Tab */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTerminalTab('diagnose');
                setIsTerminalCollapsed(false);
                if (diagnostics.length === 0) handleScanAdminCode();
              }}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                terminalTab === 'diagnose'
                  ? 'bg-[#141418] text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-cyan-300'
              }`}
            >
              <Bug className="h-3.5 w-3.5 text-cyan-400" />
              <span>{t('scanBugsAndTypos')}</span>
              {diagnostics.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-[10px] font-bold">
                  {diagnostics.length}
                </span>
              )}
            </button>

            {isBuilding && (
              <span className="flex items-center space-x-1 text-[11px] text-amber-300 font-normal ml-2">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>{language === 'de' ? 'Kompilieren läuft...' : 'Compiling...'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {terminalTab === 'logs' && (
              <>
                <button
                  onClick={() => {
                    if (logs.length === 0) return;
                    navigator.clipboard.writeText(logs.join('\n'));
                    setCopiedLogs(true);
                    toast.success(language === 'de' ? 'Logs kopiert' : 'Logs copied');
                    setTimeout(() => setCopiedLogs(false), 2000);
                  }}
                  className="p-1 hover:bg-[#25252e] rounded text-slate-400 hover:text-white text-xs flex items-center space-x-1"
                  title="Copy Terminal Logs"
                >
                  {copiedLogs ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setLogs([])}
                  className="p-1 hover:bg-[#25252e] rounded text-slate-400 hover:text-white"
                  title="Clear Logs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
              className="p-1 hover:bg-[#25252e] rounded text-slate-400 hover:text-white"
              title={isTerminalCollapsed ? 'Expand Terminal' : 'Collapse Terminal'}
            >
              {isTerminalCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5 rotate-180" />}
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        {!isTerminalCollapsed && (
          <div className="flex-1 p-3 bg-black/60 font-mono text-xs text-slate-300 space-y-1 overflow-y-auto">
            {terminalTab === 'logs' && (
              logs.length === 0 ? (
                <div className="text-slate-500 py-3 text-center">
                  Ready to compile. Click "{t('compileCoreMod')}" to run gradle/python compile pipeline.
                </div>
              ) : (
                logs.map((log, idx) => {
                  const isSuccess = log.includes('SUCCESS') || log.includes('BUILD SUCCESSFUL');
                  const isError = log.includes('ERROR') || log.includes('FAILED') || log.includes('Exception');
                  const isWarn = log.includes('WARN');
                  return (
                    <div
                      key={idx}
                      className={`leading-relaxed ${
                        isSuccess ? 'text-emerald-400 font-bold' :
                        isError ? 'text-rose-400 font-semibold' :
                        isWarn ? 'text-amber-300' :
                        'text-slate-300'
                      }`}
                    >
                      {log}
                    </div>
                  );
                })
              )
            )}

            {terminalTab === 'tasks' && (
              <div className="space-y-3 font-sans">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={customCmd}
                    onChange={(e) => setCustomCmd(e.target.value)}
                    placeholder="./gradlew clean build, test, classes..."
                    className="flex-1 bg-[#181820] border border-[#2d2d38] rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={async () => {
                      if (!customCmd.trim()) return;
                      setTerminalTab('logs');
                      handleTriggerBuild();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{t('runTaskButton')}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['build', 'clean', 'classes', 'test'].map((tName) => (
                    <button
                      key={tName}
                      onClick={() => {
                        setCustomCmd(`./gradlew ${tName}`);
                        setTerminalTab('logs');
                        handleTriggerBuild();
                      }}
                      className="p-2 bg-[#1b1b24] hover:bg-indigo-600/30 border border-[#2d2d38] rounded-lg text-left text-xs font-mono text-slate-200 transition-colors"
                    >
                      <div className="font-bold text-indigo-300">./gradlew {tName}</div>
                      <div className="text-[10px] text-slate-400 font-sans">Execute {tName} target</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {terminalTab === 'diagnose' && (
              <div className="space-y-2 font-sans">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs text-slate-400">
                    File: <span className="font-mono text-slate-200">{activeFilePath || 'none'}</span>
                  </span>
                  <button
                    onClick={handleScanAdminCode}
                    disabled={isScanning}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center space-x-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>{isScanning ? t('scanningCode') : t('scanBugsAndTypos')}</span>
                  </button>
                </div>

                {diagnostics.length === 0 ? (
                  <div className="p-3 bg-[#181820] border border-[#2d2d38] rounded-lg text-center text-xs text-emerald-400">
                    {t('noIssuesFound')}
                  </div>
                ) : (
                  diagnostics.map((diag, i) => (
                    <div key={i} className="p-2 bg-[#1b1b22] border border-[#2d2d38] rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono text-rose-400 font-bold mr-2">L{diag.line}</span>
                        <span className="text-slate-200">{diag.message}</span>
                        {diag.suggestedFix && (
                          <span className="ml-2 text-emerald-400 font-mono">&rarr; {diag.suggestedFix}</span>
                        )}
                      </div>
                      {diag.suggestedFix !== undefined && (
                        <button
                          onClick={() => handleApplyAdminFix(diag)}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded flex items-center space-x-1"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>{t('applyFix')}</span>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            <div ref={terminalEndRef} />
          </div>
        )}
      </div>

      {/* ================= MODAL: SCAFFOLD NEW CORE MOD ================= */}
      {showNewModModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#1e1e24] border border-[#383844] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#2d2d38]">
              <div className="flex items-center space-x-2 text-white">
                <Box className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-bold">{t('createModModalTitle')}</h3>
              </div>
              <button
                onClick={() => setShowNewModModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMod} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  {t('modId')} (e.g. custom-fix, net-patch)
                </label>
                <input
                  type="text"
                  required
                  placeholder="my-core-mod"
                  value={newModId}
                  onChange={(e) => setNewModId(e.target.value)}
                  className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  {t('modName')}
                </label>
                <input
                  type="text"
                  placeholder="My System Core Mod"
                  value={newModName}
                  onChange={(e) => setNewModName(e.target.value)}
                  className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  {t('modLoader')}
                </label>
                <select
                  value={newModLoader}
                  onChange={(e) => setNewModLoader(e.target.value)}
                  className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="fabric">Fabric (Fabric Loom / ModInitializer)</option>
                  <option value="neoforge">NeoForge (Modern FML / Java 21)</option>
                  <option value="forge">Minecraft Forge (ForgeGradle / @Mod)</option>
                  <option value="quilt">Quilt (Quilt Loader / QSL)</option>
                  <option value="paper">Paper / Spigot Plugin (JavaPlugin)</option>
                  <option value="folia">Folia / Purpur (Multithreaded Plugin)</option>
                  <option value="velocity">Velocity (Modern High-Perf Proxy)</option>
                  <option value="bungeecord">BungeeCord / Waterfall (Proxy)</option>
                  <option value="sponge">Sponge (SpongeAPI v11)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  {t('minecraftVersion')}
                </label>
                <select
                  value={newModMcVersion}
                  onChange={(e) => setNewModMcVersion(e.target.value)}
                  className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                >
                  <option value="1.21.1">1.21.1 (Java 21 LTS - Recommended)</option>
                  <option value="1.21">1.21</option>
                  <option value="1.20.4">1.20.4</option>
                  <option value="1.20.1">1.20.1</option>
                  <option value="1.19.4">1.19.4</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  id="sampleModCheck"
                  checked={newModIsSample}
                  onChange={(e) => setNewModIsSample(e.target.checked)}
                  className="rounded border-[#2f2f3d] text-amber-500 focus:ring-amber-500/20 bg-[#131317]"
                />
                <label htmlFor="sampleModCheck" className="text-xs text-slate-300 cursor-pointer select-none">
                  ⭐ {t('isSampleCheckbox')}
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  {t('modDescription')}
                </label>
                <textarea
                  rows={2}
                  placeholder="Internal engine patch description..."
                  value={newModDescription}
                  onChange={(e) => setNewModDescription(e.target.value)}
                  className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 resize-none focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModModal(false)}
                  className="px-3 py-1.5 bg-[#2a2a34] text-xs font-semibold text-slate-300 rounded-xl hover:bg-[#343440]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingMod || !newModId.trim()}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-xs font-semibold text-white rounded-xl shadow-sm flex items-center space-x-1.5"
                >
                  {isCreatingMod && <RefreshCw className="h-3 w-3 animate-spin" />}
                  <span>{isCreatingMod ? t('creatingModBtn') : t('createModBtn')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE NEW FILE IN MOD ================= */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#1e1e24] border border-[#383844] rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#2d2d38]">
              <div className="flex items-center space-x-2 text-white">
                <FileCode className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-bold">New Source File</h3>
              </div>
              <button
                onClick={() => setShowNewFileModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewFile} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Folder Path
                </label>
                <input
                  type="text"
                  value={newFileFolder}
                  onChange={(e) => setNewFileFolder(e.target.value)}
                  placeholder="e.g. src/main/java"
                  className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  File Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="MyPatch.java"
                  className="w-full bg-[#131317] border border-[#2f2f3d] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFileModal(false)}
                  className="px-3 py-1.5 bg-[#2a2a34] text-xs font-semibold text-slate-300 rounded-xl hover:bg-[#343440]"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newFileName.trim()}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-xs font-semibold text-white rounded-xl shadow-sm"
                >
                  Create File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
