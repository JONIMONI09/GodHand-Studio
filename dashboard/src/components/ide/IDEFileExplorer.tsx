import React, { useRef, useState } from 'react';
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  ArrowUpDown, 
  ListOrdered, 
  Check, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  FolderInput, 
  Trash2, 
  GripVertical, 
  X,
  PanelLeftClose,
  PanelLeft,
  ChevronsUpDown,
  FolderDown,
  FolderUp,
  Upload,
  Download,
  Edit2,
  Image as ImageIcon
} from 'lucide-react';
import { useTranslation } from '../../i18n/translations';
import { toast } from 'react-hot-toast';
import { BrowserVFS, validateFileName, validatePath } from '../../lib/vfs';

interface IDEFileExplorerProps {
  onRefreshTree?: () => Promise<void>;
  onSelectMod?: (modId: string) => void;
  projectId?: string;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  sidebarWidth: number;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onResetWidth: () => void;
  fileTree: any[];
  activeFile: string;
  setActiveFile: (file: string) => void;
  sortMode: 'custom' | 'folders-first' | 'name-asc' | 'name-desc' | 'type';
  setSortMode: (mode: any) => void;
  showSortMenu: boolean;
  setShowSortMenu: React.Dispatch<React.SetStateAction<boolean>>;
  customOrder: Record<string, string[]>;
  setCustomOrder: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  creatingFileIn: string | null;
  setCreatingFileIn: (path: string | null) => void;
  newFileName: string;
  setNewFileName: (name: string) => void;
  handleCreateFile: (folderPath: string) => void;
  handleDeleteFile: (filePath: string, isFolder: boolean) => void;
  onRenameNode?: (oldPath: string, newPath: string, isFolder: boolean) => Promise<void>;
  openMoveModal: (node: any) => void;
  draggingNode: any;
  setDraggingNode: (node: any) => void;
  dragOverFolder: string | null;
  setDragOverFolder: (folder: string | null) => void;
  isDragOverRoot: boolean;
  setIsDragOverRoot: (val: boolean) => void;
  dropInsertInfo: { targetPath: string; position: 'before' | 'after' | 'inside' } | null;
  setDropInsertInfo: (val: any) => void;
  handleFileDrop: (e: React.DragEvent, targetNode: any, explicitTargetDir?: string, dropPos?: 'before' | 'after' | 'inside') => Promise<void>;
}

export const IDEFileExplorer: React.FC<IDEFileExplorerProps> = ({
  onRefreshTree,
  onSelectMod,
  projectId,
  isSidebarCollapsed,
  onToggleSidebar,
  sidebarWidth,
  isSidebarOpen,
  setIsSidebarOpen,
  onResizeStart,
  onResetWidth,
  fileTree,
  activeFile,
  setActiveFile,
  sortMode,
  setSortMode,
  showSortMenu,
  setShowSortMenu,
  customOrder,
  setCustomOrder,
  creatingFileIn,
  setCreatingFileIn,
  newFileName,
  setNewFileName,
  handleCreateFile,
  handleDeleteFile,
  onRenameNode,
  openMoveModal,
  draggingNode,
  setDraggingNode,
  dragOverFolder,
  setDragOverFolder,
  isDragOverRoot,
  setIsDragOverRoot,
  dropInsertInfo,
  setDropInsertInfo,
  handleFileDrop
}) => {
  const { t, language } = useTranslation();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const handleCreateFileWithValidation = (targetFolder: string) => {
    const val = validateFileName(newFileName);
    if (!val.valid) {
      toast.error(val.error || 'Ungültiger Dateiname');
      return;
    }
    const trimmed = newFileName.trim();
    if (!trimmed) {
      setCreatingFileIn(null);
      return;
    }
    handleCreateFile(targetFolder);
  };

  const handleOpenLocalFolder = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const count = await BrowserVFS.importFromDirectoryHandle(dirHandle, projectId || 'godhand');
        toast.success(language === 'de' ? `${count} Dateien aus lokalem Ordner geladen!` : `Loaded ${count} files from local folder!`);
        if (onRefreshTree) await onRefreshTree();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          toast.error('Failed to open directory: ' + err.message);
        }
      }
    } else {
      folderInputRef.current?.click();
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const count = await BrowserVFS.importFromFileList(files, projectId || 'godhand');
      toast.success(language === 'de' ? `${count} Dateien importiert!` : `Imported ${count} files!`);
      if (onRefreshTree) await onRefreshTree();
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    }
  };

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await BrowserVFS.importZip(file, projectId || 'godhand');
      toast.success(language === 'de' ? `${count} Dateien entpackt!` : `Extracted ${count} files!`);
      if (onRefreshTree) await onRefreshTree();
    } catch (err: any) {
      toast.error('Zip import failed: ' + err.message);
    }
  };

  const handleExportZip = async () => {
    try {
      const blob = await BrowserVFS.exportZip(projectId || 'godhand');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectId || 'godhand-mod'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'de' ? 'Projekt als .zip exportiert!' : 'Project exported as .zip!');
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    }
  };

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'src': true,
    'src/main': true,
    'src/main/java': true,
    'src/main/java/com': true,
    'src/main/java/com/yourcompany': true,
    'src/main/java/com/yourcompany/godhand': true
  });

  const hoverTimerRef = useRef<any>(null);

  // Check if a folder is currently expanded (accounting for default depth expansion)
  const isFolderExpanded = (path: string, depth = 0): boolean => {
    return expandedFolders[path] !== undefined ? Boolean(expandedFolders[path]) : depth < 2;
  };

  // Check if ANY folder in the tree is currently expanded
  const isAnyFolderOpen = (items: any[], depth = 0): boolean => {
    for (const item of items) {
      if (item.type === 'folder') {
        if (isFolderExpanded(item.path, depth)) return true;
        if (item.children && isAnyFolderOpen(item.children, depth + 1)) return true;
      }
    }
    return false;
  };

  const toggleFolder = (e: React.MouseEvent, path: string, currentIsExpanded: boolean) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [path]: !currentIsExpanded }));
  };

  const handleToggleExpandAll = () => {
    const hasAnyOpen = isAnyFolderOpen(fileTree);
    const targetState = !hasAnyOpen;
    const newMap: Record<string, boolean> = {};
    const traverse = (items: any[]) => {
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

  // Sorter for siblings
  const sortNodes = (nodes: any[], parentPath: string): any[] => {
    if (!nodes || !Array.isArray(nodes)) return [];

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

  const renderTree = (nodes: any[], depth = 0, parentPath = '') => {
    if (!nodes || !Array.isArray(nodes)) return null;
    const sortedNodes = sortNodes(nodes, parentPath);

    return sortedNodes.map((node) => {
      const isExpanded = isFolderExpanded(node.path, depth);
      const isOverThis = dragOverFolder === node.path;
      const isDraggingThis = draggingNode && draggingNode.path === node.path;
      const isDropBefore = dropInsertInfo && dropInsertInfo.targetPath === node.path && dropInsertInfo.position === 'before';
      const isDropAfter = dropInsertInfo && dropInsertInfo.targetPath === node.path && dropInsertInfo.position === 'after';
      const isDropInside = dropInsertInfo && dropInsertInfo.targetPath === node.path && dropInsertInfo.position === 'inside';

      return (
        <div key={node.path} className="flex flex-col relative select-none">
          {/* Drop indicator lines */}
          {isDropBefore && (
            <div className="h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] mx-2 my-0.5 rounded-full" />
          )}

          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              setDraggingNode(node);
              e.dataTransfer.setData('text/plain', node.path);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              setDraggingNode(null);
              setDragOverFolder(null);
              setIsDragOverRoot(false);
              setDropInsertInfo(null);
              if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
                hoverTimerRef.current = null;
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';

              if (draggingNode && draggingNode.path !== node.path) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const height = rect.height;

                if (offsetY < height * 0.25) {
                  setDropInsertInfo({ targetPath: node.path, position: 'before' });
                } else if (offsetY > height * 0.75) {
                  setDropInsertInfo({ targetPath: node.path, position: 'after' });
                } else {
                  if (node.type === 'folder') {
                    setDropInsertInfo({ targetPath: node.path, position: 'inside' });
                    setDragOverFolder(node.path);

                    if (!expandedFolders[node.path] && !hoverTimerRef.current) {
                      hoverTimerRef.current = setTimeout(() => {
                        setExpandedFolders(prev => ({ ...prev, [node.path]: true }));
                        hoverTimerRef.current = null;
                      }, 700);
                    }
                  } else {
                    setDropInsertInfo({ targetPath: node.path, position: offsetY > height / 2 ? 'after' : 'before' });
                  }
                }
              }
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              if (dragOverFolder === node.path) {
                setDragOverFolder(null);
              }
              if (dropInsertInfo && dropInsertInfo.targetPath === node.path) {
                setDropInsertInfo(null);
              }
              if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
                hoverTimerRef.current = null;
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const chosenPos = (dropInsertInfo && dropInsertInfo.targetPath === node.path) ? dropInsertInfo.position : 'inside';
              handleFileDrop(e, node, undefined, chosenPos);
            }}
            className={`group relative flex items-center justify-between py-1.5 cursor-pointer transition-all duration-150 rounded ${
              activeFile === node.path ? 'bg-[#37373d] text-white font-medium ring-1 ring-indigo-500/40' : 'hover:bg-[#2a2d2e] text-slate-300'
            } ${
              isDraggingThis ? 'opacity-40 border border-dashed border-indigo-400 bg-indigo-950/20' : ''
            } ${
              isOverThis || isDropInside ? 'bg-indigo-600/30 border border-indigo-500 shadow-sm text-white font-semibold' : ''
            }`}
            style={{ paddingLeft: `${6 + depth * 11}px`, paddingRight: '6px' }}
            onClick={(e) => {
              if (node.type === 'file') {
                setActiveFile(node.path);
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              } else {
                toggleFolder(e, node.path, isExpanded);
              }
            }}
            title={t('dragToMove', { name: node.name })}
          >
            <div className="flex items-center space-x-1.5 overflow-hidden flex-1 cursor-grab active:cursor-grabbing min-w-0">
              <GripVertical className="h-3 w-3 text-slate-500 opacity-40 group-hover:opacity-100 shrink-0 transition-opacity" />
              {node.type === 'folder' ? (
                <>
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                  <Folder className={`h-4 w-4 shrink-0 transition-colors ${isOverThis || isDropInside ? 'text-indigo-400 scale-110' : 'text-blue-400'}`} />
                </>
              ) : (
                <>
                  <div className="w-3.5 shrink-0"></div>
                  {/\.(png|jpe?g|gif|webp|ico|svg|bmp)$/i.test(node.name) ? (
                    <ImageIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <File className={`h-4 w-4 shrink-0 ${node.name.endsWith('.java') ? 'text-amber-400' : 'text-slate-400'}`} />
                  )}
                </>
              )}
              {renamingPath === node.path ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={async e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      const val = validateFileName(renameValue);
                      if (!val.valid) {
                        toast.error(val.error || 'Ungültiger Dateiname');
                        return;
                      }
                      const trimmed = renameValue.trim();
                      if (trimmed === node.name) {
                        setRenamingPath(null);
                        return;
                      }
                      const parent = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/')) : '';
                      const newPath = parent ? `${parent}/${trimmed}` : trimmed;
                      try {
                        if (onRenameNode) {
                          await onRenameNode(node.path, newPath, node.type === 'folder');
                        } else {
                          await BrowserVFS.rename(node.path, newPath, projectId || 'godhand');
                          if (onRefreshTree) await onRefreshTree();
                        }
                        setRenamingPath(null);
                      } catch (err: any) {
                        toast.error(err.message || 'Failed to rename');
                      }
                    }
                    if (e.key === 'Escape') {
                      setRenamingPath(null);
                    }
                  }}
                  onBlur={() => setRenamingPath(null)}
                  onClick={e => e.stopPropagation()}
                  className="bg-[#3c3c3c] text-white text-[13px] px-1 py-0.5 border border-[#007acc] focus:outline-none rounded flex-1 min-w-0"
                />
              ) : (
                <span className="text-[13px] truncate">{node.name}</span>
              )}
            </div>

            {/* Action buttons on hover */}
            <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
              <button 
                onClick={(e) => { e.stopPropagation(); moveItemOrder(parentPath, node.name, 'up', sortedNodes); }}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-indigo-300 rounded transition-colors"
                title={t('moveItemUp')}
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); moveItemOrder(parentPath, node.name, 'down', sortedNodes); }}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-indigo-300 rounded transition-colors"
                title={t('moveItemDown')}
              >
                <ArrowDown className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingPath(node.path);
                  setRenameValue(node.name);
                }}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-amber-300 rounded transition-colors"
                title={t('rename') || 'Rename'}
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openMoveModal(node); }}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-indigo-300 rounded transition-colors"
                title={t('moveToAnotherFolder')}
              >
                <FolderInput className="h-3 w-3 text-indigo-400" />
              </button>
              {node.type === 'folder' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setCreatingFileIn(node.path); }}
                  className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors"
                  title={t('newFileHere')}
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteFile(node.path, node.type === 'folder'); }}
                className="p-1 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded transition-colors"
                title={t('delete')}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {isDropAfter && (
            <div className="h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] mx-2 my-0.5 rounded-full" />
          )}

          {/* Children container */}
          <div className={`transition-all duration-200 overflow-hidden ${isExpanded ? 'block' : 'hidden'}`}>
            {creatingFileIn === node.path && (
              <div className="flex items-center space-x-1.5 py-1.5 pr-2" style={{ paddingLeft: `${24 + depth * 14}px` }}>
                <File className="h-4 w-4 shrink-0 text-emerald-400" />
                <input
                  autoFocus
                  value={newFileName}
                  onChange={e => setNewFileName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateFileWithValidation(node.path);
                    if (e.key === 'Escape') setCreatingFileIn(null);
                  }}
                  onBlur={() => setCreatingFileIn(null)}
                  className="flex-1 bg-[#3c3c3c] text-white text-[13px] px-1 py-0.5 border border-[#007acc] focus:outline-none"
                  placeholder="Filename..."
                />
              </div>
            )}
            <div className="overflow-hidden">
              {node.children && node.children.length > 0 && renderTree(node.children, depth + 1, node.path)}
            </div>
          </div>
        </div>
      );
    });
  };

  // If collapsed on desktop, render the sleek mini-rail
  if (isSidebarCollapsed && window.innerWidth >= 768) {
    return (
      <div className="w-10 border-r border-[#2d2d2d] bg-[#252526] flex flex-col items-center py-2 space-y-3 flex-shrink-0 z-20">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded text-indigo-400 hover:bg-[#333] hover:text-white transition-colors"
          title={t('expandSidebar')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => { onToggleSidebar(); setCreatingFileIn(''); }}
          className="p-1.5 rounded text-slate-400 hover:bg-[#333] hover:text-white transition-colors"
          title={t('newFileRoot')}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={() => { onToggleSidebar(); setShowSortMenu(true); }}
          className="p-1.5 rounded text-slate-400 hover:bg-[#333] hover:text-white transition-colors"
          title={t('sortArrangement')}
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* File Explorer Sidebar */}
      <div 
        style={{ width: window.innerWidth >= 768 ? `${sidebarWidth}px` : undefined }}
        className={`absolute md:relative z-20 h-full w-72 md:w-auto border-r border-[#2d2d2d] bg-[#252526] flex flex-col transition-all duration-150 ease-in-out flex-shrink-0 ${
          isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Header */}
        <div className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-[#2d2d2d] flex justify-between items-center relative select-none">
          <div className="flex items-center space-x-1.5 truncate">
            <span className="truncate">{t('projectFiles')}</span>
          </div>

          <div className="flex items-center space-x-1 relative">
            {/* Sort & Arrangement dropdown toggle */}
            <button 
              className={`p-1 rounded text-slate-400 hover:text-white transition-colors ${
                showSortMenu ? 'bg-indigo-600/40 text-indigo-300 ring-1 ring-indigo-500' : 'hover:bg-slate-700'
              }`}
              onClick={() => setShowSortMenu(prev => !prev)}
              title={t('sortArrangement')}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
            
            {/* Dropdown Menu */}
            {showSortMenu && (
              <div 
                className="absolute right-0 top-8 w-60 bg-[#1e1e24] border border-[#3c3c44] rounded-lg shadow-2xl py-1.5 z-50 text-xs backdrop-blur-md font-normal normal-case"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 font-semibold text-slate-400 border-b border-[#2d2d34] flex items-center justify-between">
                  <span>{t('sortArrangement')}</span>
                  <span className="text-[10px] text-indigo-400 font-normal uppercase">{sortMode}</span>
                </div>
                <button 
                  onClick={() => { setSortMode('custom'); setShowSortMenu(false); localStorage.setItem('godhand_sort_mode', 'custom'); }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                    sortMode === 'custom' ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <ListOrdered className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">{t('customOrder')}</span>
                  </span>
                  {sortMode === 'custom' && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1" />}
                </button>
                <button 
                  onClick={() => { setSortMode('folders-first'); setShowSortMenu(false); localStorage.setItem('godhand_sort_mode', 'folders-first'); }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                    sortMode === 'folders-first' ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{t('sortFoldersFirst')}</span>
                  {sortMode === 'folders-first' && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1" />}
                </button>
                <button 
                  onClick={() => { setSortMode('name-asc'); setShowSortMenu(false); localStorage.setItem('godhand_sort_mode', 'name-asc'); }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                    sortMode === 'name-asc' ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{t('sortNameAsc')}</span>
                  {sortMode === 'name-asc' && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1" />}
                </button>
                <button 
                  onClick={() => { setSortMode('name-desc'); setShowSortMenu(false); localStorage.setItem('godhand_sort_mode', 'name-desc'); }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                    sortMode === 'name-desc' ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{t('sortNameDesc')}</span>
                  {sortMode === 'name-desc' && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1" />}
                </button>
                <button 
                  onClick={() => { setSortMode('type'); setShowSortMenu(false); localStorage.setItem('godhand_sort_mode', 'type'); }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                    sortMode === 'type' ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{t('sortType')}</span>
                  {sortMode === 'type' && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0 ml-1" />}
                </button>
                <div className="border-t border-[#2d2d34] my-1" />
                <button 
                  onClick={() => { 
                    setCustomOrder({}); 
                    localStorage.removeItem('godhand_file_order'); 
                    setShowSortMenu(false); 
                    toast.success(t('resetArrangement')); 
                  }}
                  className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center space-x-1.5"
                >
                  <RefreshCw className="h-3 w-3 shrink-0" />
                  <span className="truncate">{t('resetArrangement')}</span>
                </button>
              </div>
            )}

            {/* Hidden native folder and zip inputs */}
            <input 
              type="file" 
              ref={folderInputRef} 
              {...{ webkitdirectory: '', directory: '' } as any} 
              multiple 
              className="hidden" 
              onChange={handleFolderSelect} 
            />
            <input 
              type="file" 
              ref={zipInputRef} 
              accept=".zip,.jar" 
              className="hidden" 
              onChange={handleZipSelect} 
            />

            {/* Open Local Mod Folder (HTML5 File System Access API) */}
            <button 
              className="text-slate-400 hover:text-emerald-400 transition-colors p-1 rounded hover:bg-slate-700" 
              onClick={handleOpenLocalFolder}
              title={t('openLocalFolder')}
            >
              <FolderInput className="h-3.5 w-3.5" />
            </button>

            {/* Import Project .zip */}
            <button 
              className="text-slate-400 hover:text-indigo-400 transition-colors p-1 rounded hover:bg-slate-700" 
              onClick={() => zipInputRef.current?.click()}
              title={t('importProjectZip')}
            >
              <Upload className="h-3.5 w-3.5" />
            </button>

            {/* Export Project .zip */}
            <button 
              className="text-slate-400 hover:text-amber-400 transition-colors p-1 rounded hover:bg-slate-700" 
              onClick={handleExportZip}
              title={t('exportProjectZip')}
            >
              <FolderDown className="h-3.5 w-3.5" />
            </button>

            {/* Expand / Collapse All Folders */}
            <button 
              className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700" 
              onClick={handleToggleExpandAll}
              title={Object.values(expandedFolders).some(v => v === true) ? t('collapseAllFolders') : t('expandAllFolders')}
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </button>

            {/* New File at root */}
            <button 
              className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700" 
              onClick={() => setCreatingFileIn('')}
              title={t('newFileRoot')}
            >
              <Plus className="h-4 w-4" />
            </button>

            {/* Desktop Collapse Button */}
            <button
              onClick={onToggleSidebar}
              className="hidden md:flex text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700"
              title={t('collapseSidebar')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Mobile Close Button */}
            <button 
              className="md:hidden text-slate-400 p-1 rounded hover:bg-slate-700" 
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Project Switcher & Defaults Reset */}
        <div className="px-3 py-2 border-b border-[#2d2d2d] bg-[#1e1e22] flex flex-col gap-1.5 select-none shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {language === 'de' ? 'Aktives Mod-Projekt' : 'Active Mod Project'}
            </span>
            <button
              onClick={async () => {
                const target = projectId || 'godhand';
                const count = await BrowserVFS.resetWorkspaceToDefaults(target);
                toast.success(language === 'de' ? `${count} Dateien auf Repository-Standard zurückgesetzt!` : `Reset ${count} files to repository defaults!`);
                if (onRefreshTree) await onRefreshTree();
              }}
              className="text-[10px] text-amber-400 hover:text-amber-300 transition flex items-center gap-1 font-mono hover:underline"
              title={language === 'de' ? 'Dateien auf Original-Repository zurücksetzen' : 'Reset files to repository defaults'}
            >
              <RefreshCw className="h-2.5 w-2.5" />
              <span>{language === 'de' ? 'Standard laden' : 'Reset Defaults'}</span>
            </button>
          </div>
          <select
            value={projectId === 'arm32-fix' ? 'arm32-fix' : 'godhand'}
            onChange={(e) => {
              if (onSelectMod) {
                onSelectMod(e.target.value);
              }
            }}
            className="w-full bg-[#2a2a30] border border-[#3e3e48] rounded px-2 py-1 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-medium"
          >
            <option value="godhand">GodHand Core Mod (35+ Klassen)</option>
            <option value="arm32-fix">ARM32 Alignment Fix Mod</option>
          </select>
        </div>

        {/* Tree Content Area */}
        <div 
          className={`flex-1 overflow-y-auto py-2 transition-colors relative flex flex-col ${
            isDragOverRoot ? 'bg-indigo-950/20 ring-1 ring-indigo-500/50' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggingNode) {
              setIsDragOverRoot(true);
            }
          }}
          onDragLeave={() => {
            setIsDragOverRoot(false);
          }}
          onDrop={(e) => handleFileDrop(e, null)}
        >
          {/* Move up target if dragging subfolder item */}
          {draggingNode && draggingNode.path.includes('/') && (
            <div 
              className={`mx-2 mb-2 p-2 border-2 border-dashed rounded-lg text-center transition-all cursor-pointer ${
                dragOverFolder === '__move_up__' 
                  ? 'border-indigo-400 bg-indigo-600/30 text-white font-bold ring-2 ring-indigo-400' 
                  : 'border-indigo-500/60 bg-indigo-950/40 text-indigo-200 hover:border-indigo-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                setDragOverFolder('__move_up__');
              }}
              onDragLeave={() => {
                if (dragOverFolder === '__move_up__') setDragOverFolder(null);
              }}
              onDrop={(e) => {
                const currentParent = draggingNode.path.substring(0, draggingNode.path.lastIndexOf('/'));
                const grandParent = currentParent.includes('/') ? currentParent.substring(0, currentParent.lastIndexOf('/')) : '';
                handleFileDrop(e, null, grandParent);
              }}
            >
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium">
                <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {(() => {
                    const currentParent = draggingNode.path.substring(0, draggingNode.path.lastIndexOf('/'));
                    const grandParent = currentParent.includes('/') ? currentParent.substring(0, currentParent.lastIndexOf('/')) : '';
                    return language === 'de' ? `↑ Eine Ebene nach oben (${grandParent || 'Hauptverzeichnis'})` : `↑ Move up to: ${grandParent || 'Root'}`;
                  })()}
                </span>
              </div>
            </div>
          )}

          {/* Root drop target */}
          {draggingNode && (
            <div 
              className={`mx-2 mb-2 p-2 border-2 border-dashed rounded-lg text-center transition-all cursor-pointer ${
                isDragOverRoot 
                  ? 'border-emerald-400 bg-emerald-600/30 text-white font-bold ring-2 ring-emerald-400' 
                  : 'border-slate-700/80 bg-slate-800/40 text-slate-300 hover:border-slate-500'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                setIsDragOverRoot(true);
                setDragOverFolder(null);
              }}
              onDragLeave={() => setIsDragOverRoot(false)}
              onDrop={(e) => handleFileDrop(e, null, '')}
            >
              <div className="flex items-center justify-center gap-1.5 text-xs">
                <Folder className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('dropToMoveRoot')}</span>
              </div>
            </div>
          )}

          {/* New file at root input */}
          {creatingFileIn === '' && (
            <div className="flex items-center space-x-1.5 py-1.5 pr-2 pl-4">
              <File className="h-4 w-4 shrink-0 text-emerald-400" />
              <input
                autoFocus
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateFileWithValidation('');
                  if (e.key === 'Escape') setCreatingFileIn(null);
                }}
                onBlur={() => setCreatingFileIn(null)}
                className="flex-1 bg-[#3c3c3c] text-white text-[13px] px-1 py-0.5 border border-[#007acc] focus:outline-none"
                placeholder="Filename..."
              />
            </div>
          )}

          {/* Render Full Tree */}
          {renderTree(fileTree)}
        </div>
      </div>

      {/* Draggable Divider for Sidebar */}
      {!isSidebarCollapsed && (
        <div
          onMouseDown={onResizeStart}
          onDoubleClick={onResetWidth}
          className="hidden md:flex w-1.5 hover:w-2 bg-[#2d2d2d] hover:bg-indigo-500 active:bg-indigo-600 cursor-col-resize transition-all duration-150 z-30 flex-shrink-0 items-center justify-center group"
          title={t('dragToResizeSidebar')}
        >
          <div className="w-0.5 h-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
        </div>
      )}

      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-10 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </>
  );
};
