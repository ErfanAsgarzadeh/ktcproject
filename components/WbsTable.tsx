/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  CheckSquare, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Lock, 
  UserSquare2 
} from 'lucide-react';
import { ProjectNode, WbsNode, ActivityNode, Dependency, TaskRole, CustomUser } from '../types/types';
import { adjustToWorkingDay, addWorkingDays, calculateWorkingDays } from '../utils/scheduler';

interface WbsTableProps {
  flattenedNodes: { node: ProjectNode; depth: number; isHidden: boolean }[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onUpdateNode: (id: string, updatedFields: Partial<ProjectNode>) => void;
  onUpdatePredecessors: (activityId: string, predecessorCodesString: string) => void;
  dependencies: Dependency[];
  allNodes: ProjectNode[];
  onAddSubNode: (parentNodeId: string, type: 'wbs' | 'activity') => void;
  onDeleteNode: (id: string) => void;
  tableContainerRef?: React.RefObject<HTMLDivElement | null>;
  onTableScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  taskRoles: TaskRole[];
  users: CustomUser[];
  isEditMode?: boolean;
}

export default function WbsTable({
  flattenedNodes,
  selectedNodeId,
  onSelectNode,
  onToggleExpand,
  onUpdateNode,
  onUpdatePredecessors,
  dependencies,
  allNodes,
  onAddSubNode,
  onDeleteNode,
  tableContainerRef,
  onTableScroll,
  taskRoles,
  users,
  isEditMode = true,
}: WbsTableProps) {
  // Cell inline editing state
  const [editingCell, setEditingCell] = useState<{ nodeId: string; field: keyof ActivityNode | 'predecessors' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const visibleRows = flattenedNodes.filter(row => !row.isHidden);

  const startInlineEdit = (nodeId: string, field: keyof ActivityNode | 'predecessors', currentValue: any) => {
    if (!isEditMode) return;
    // Only allow editing name/code for WBS nodes. All schedules dates roll up for WBS.
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return;

    if (node.type === 'wbs' && field !== 'name' && field !== 'code') {
      return; // locked rollup cells
    }

    setEditingCell({ nodeId, field });
    setEditValue(String(currentValue || ''));
  };

  const handleFinishEdit = (nodeId: string, field: keyof ActivityNode | 'predecessors') => {
    if (!editingCell) return;

    const node = allNodes.find(n => n.id === nodeId);
    if (!node) {
      setEditingCell(null);
      return;
    }

    const value = editValue.trim();

    if (field === 'predecessors') {
      // Specialty parser
      onUpdatePredecessors(nodeId, value);
    } else if (node.type === 'activity') {
      const act = node as ActivityNode;
      const updates: Partial<ActivityNode> = {};

      if (field === 'code') {
        updates.code = value || act.code;
      } else if (field === 'name') {
        updates.name = value || act.name;
      } else if (field === 'startDate') {
        if (value) {
          // Adjust start to a working day
          const validStartDate = adjustToWorkingDay(value, 'forward');
          updates.startDate = validStartDate;
          // Calculate new finish date based on existing duration
          updates.endDate = addWorkingDays(validStartDate, act.duration);
        }
      } else if (field === 'endDate') {
        if (value && value >= act.startDate) {
          const validEndDate = adjustToWorkingDay(value, 'backward');
          updates.endDate = validEndDate;
          // Calculate new duration
          updates.duration = calculateWorkingDays(act.startDate, validEndDate);
        }
      } else if (field === 'duration') {
        const dur = Math.max(1, parseInt(value) || 1);
        updates.duration = dur;
        // Calculate new finish date
        updates.endDate = addWorkingDays(act.startDate, dur);
      } else if (field === 'progress') {
        const prog = Math.min(100, Math.max(0, parseInt(value) || 0));
        updates.progress = prog;
      } else if (field === 'resources') {
        updates.resources = value ? value.split(',').map(s => s.trim()) : [];
      } else if (field === 'notes') {
        updates.notes = value;
      }

      onUpdateNode(nodeId, updates);
    } else {
      // WbsNode edits (only code and name are interactive)
      const updates: Partial<WbsNode> = {};
      if (field === 'code') {
        updates.code = value || node.code;
      } else if (field === 'name') {
        updates.name = value || node.name;
      }
      onUpdateNode(nodeId, updates);
    }

    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, nodeId: string, field: keyof ActivityNode | 'predecessors') => {
    if (e.key === 'Enter') {
      handleFinishEdit(nodeId, field);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Helper to resolve predecessors names for standard display
  const getPredecessorsString = (nodeId: string): string => {
    const preds = dependencies.filter(d => d.toId === nodeId);
    if (preds.length === 0) return '';
    
    return preds.map(p => {
      const predNode = allNodes.find(n => n.id === p.fromId);
      return predNode ? predNode.code : '';
    }).filter(Boolean).join(', ');
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden border-r border-white/5 select-none">
      {/* Header coordinates */}
      <div className="bg-white/5 backdrop-blur-md text-slate-300 text-xs font-mono py-2.5 h-12 border-b border-white/10 grid grid-cols-[minmax(180px,280px)_80px_100px_100px_60px_60px_120px_100px_50px] items-center text-left sticky top-0 z-20 overflow-x-auto whitespace-nowrap scrollbar-none shadow-sm">
        <div className="px-3 border-r border-white/10 font-semibold text-slate-200">WBS / Activity Name</div>
        <div className="px-2.5 border-r border-white/10">ID Code</div>
        <div className="px-2.5 border-r border-white/10">Start Date</div>
        <div className="px-2.5 border-r border-white/10">Finish Date</div>
        <div className="px-2 text-center border-r border-white/10" title="Duration in working days">Dur (d)</div>
        <div className="px-2 text-center border-r border-white/10" title="Predecessor float slack">Float</div>
        <div className="px-2 border-r border-white/10">Predecessors</div>
        <div className="px-2 border-r border-white/10 text-center">Resources</div>
        <div className="px-2 text-center text-slate-500">Act</div>
      </div>

      {/* Row values list */}
      <div 
        ref={tableContainerRef} 
        onScroll={onTableScroll} 
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {visibleRows.map(({ node, depth }) => {
          console.log(node, depth);
          const isSelected = selectedNodeId === node.id;
          const isWbs = node.type === 'wbs';
          const isCritical = (node as any).isCritical;
          const totalFloat = (node as any).totalFloat !== undefined ? (node as any).totalFloat : '—';
          
          // Row Background based on node type & selection
          let rowBgClass = 'bg-transparent hover:bg-white/5';
          if (isSelected) {
            rowBgClass = 'bg-cyan-500/10 hover:bg-cyan-500/15 border-l-2 border-cyan-400 backdrop-blur-sm';
          } else if (isWbs) {
            // Primavera styled alternate header WBS gradients
            if (depth === 0) rowBgClass = 'bg-white/10 border-l-2 border-cyan-400 font-bold backdrop-blur-md text-white';
            else if (depth === 1) rowBgClass = 'bg-white/5 border-l border-indigo-400/50 font-semibold backdrop-blur-sm text-slate-100';
            else rowBgClass = 'bg-white/[0.02] text-slate-300 font-medium';
          }

          // Format float display
          const floatDisplay = isWbs ? '—' : totalFloat;

          return (
            <div 
              key={`${node.type}-${node.id}`}
              onClick={() => onSelectNode(node.id)}
              className={`grid grid-cols-[minmax(180px,280px)_80px_100px_100px_60px_60px_120px_100px_50px] items-center h-10 text-xs text-slate-300 ${rowBgClass} transition-colors cursor-pointer border-b border-white/5`}
            >
              {/* 1. Name & Hierarchical Indent */}
              <div 
                className="flex items-center h-full px-2 overflow-hidden truncate"
                style={{ paddingLeft: `${Math.max(8, depth * 16)}px` }}
              >
                {isWbs ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand(node.id);
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded"
                  >
                    {node.isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-5.5" /> // spacer
                )}

                {/* Micro Icons */}
                <span className="mr-1.5 shrink-0">
                  {isWbs ? (
                    node.isExpanded ? <FolderOpen className="w-3.5 h-3.5 text-amber-400" /> : <Folder className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <CheckSquare className={`w-3.5 h-3.5 ${isCritical ? 'text-rose-500' : 'text-blue-400'}`} />
                  )}
                </span>

                {/* Inline Editing for name */}
                {editingCell?.nodeId === node.id && editingCell?.field === 'name' ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleFinishEdit(node.id, 'name')}
                    onKeyDown={(e) => handleKeyDown(e, node.id, 'name')}
                    className="w-full bg-black/40 text-white border border-cyan-500/50 rounded-lg px-2 py-0.5 focus:outline-none backdrop-blur-md"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    onDoubleClick={() => startInlineEdit(node.id, 'name', node.name)}
                    className={`truncate capitalize ${isWbs ? 'text-slate-100 font-medium' : 'text-slate-300'}`}
                    title="Double-click to rename"
                  >
                    {node.name}
                  </span>
                )}
                
                {/* Rollup progress tag on WBS */}
                {isWbs && (
                  <span className="ml-1.5 text-[9px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded shrink-0 border border-cyan-500/20">
                    {node.progress}%
                  </span>
                )}
              </div>

              {/* 2. Code ID */}
              <div className="px-2.5 font-mono text-slate-300 overflow-hidden truncate h-full flex items-center border-l border-white/5">
                {editingCell?.nodeId === node.id && editingCell?.field === 'code' ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleFinishEdit(node.id, 'code')}
                    onKeyDown={(e) => handleKeyDown(e, node.id, 'code')}
                    className="w-full bg-black/40 font-mono text-cyan-300 border border-cyan-500/50 rounded px-1 text-xs focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    onDoubleClick={() => startInlineEdit(node.id, 'code', node.code)}
                    className="w-full truncate py-1.5 text-cyan-400 font-medium font-mono"
                    title="Double-click to edit Code"
                  >
                    {node.code}
                  </span>
                )}
              </div>

              {/* 3. Start Date */}
              <div className="px-2.5 font-mono h-full flex items-center border-l border-white/5">
                {isWbs ? (
                  <span className="text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-600" />
                    {node.startDate}
                  </span>
                ) : editingCell?.nodeId === node.id && editingCell?.field === 'startDate' ? (
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleFinishEdit(node.id, 'startDate')}
                    onKeyDown={(e) => handleKeyDown(e, node.id, 'startDate')}
                    className="w-full bg-black/40 border border-cyan-500/50 rounded-lg p-1 font-mono text-xs text-white focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    onDoubleClick={() => startInlineEdit(node.id, 'startDate', node.startDate)}
                    className="w-full text-slate-300 cursor-text py-1.5"
                    title="Double click to edit Start Date"
                  >
                    {node.startDate}
                  </span>
                )}
              </div>

              {/* 4. Finish Date */}
              <div className="px-2.5 font-mono h-full flex items-center border-l border-white/5">
                {isWbs ? (
                  <span className="text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-slate-600" />
                    {node.endDate}
                  </span>
                ) : editingCell?.nodeId === node.id && editingCell?.field === 'endDate' ? (
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleFinishEdit(node.id, 'endDate')}
                    onKeyDown={(e) => handleKeyDown(e, node.id, 'endDate')}
                    className="w-full bg-black/40 border border-cyan-500/50 rounded-lg p-1 font-mono text-xs text-white focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    onDoubleClick={() => startInlineEdit(node.id, 'endDate', node.endDate)}
                    className="w-full text-slate-300 cursor-text py-1.5"
                    title="Double click to edit Finish Date"
                  >
                    {node.endDate}
                  </span>
                )}
              </div>

              {/* 5. Duration Days */}
              <div className="text-center font-mono h-full flex items-center justify-center border-l border-white/5">
                {isWbs ? (
                  <span className="text-slate-500 flex items-center justify-center gap-1 w-full">
                    <Lock className="w-2.5 h-2.5 text-slate-600" />
                    {node.duration}
                  </span>
                ) : editingCell?.nodeId === node.id && editingCell?.field === 'duration' ? (
                  <input
                    type="number"
                    min="1"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleFinishEdit(node.id, 'duration')}
                    onKeyDown={(e) => handleKeyDown(e, node.id, 'duration')}
                    className="w-12 bg-black/40 font-mono text-center border border-cyan-500/50 rounded-lg text-xs text-white focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    onDoubleClick={() => startInlineEdit(node.id, 'duration', node.duration)}
                    className="w-full font-bold text-cyan-400 cursor-text py-1.5 hover:text-cyan-350 transition-colors"
                    title="Double click to change duration"
                  >
                    {node.duration}
                  </span>
                )}
              </div>

              {/* 6. CPM Float Display */}
              <div className={`text-center font-mono font-semibold h-full flex items-center justify-center border-l border-white/5 ${
                isCritical ? 'text-rose-500' : 'text-slate-500'
              }`}>
                {floatDisplay}
              </div>

              {/* 7. Predecessors List */}
              <div className="px-2 font-mono h-full flex items-center overflow-hidden truncate border-l border-white/5">
                {isWbs ? (
                  <span className="text-slate-600">—</span>
                ) : editingCell?.nodeId === node.id && editingCell?.field === 'predecessors' ? (
                  <input
                    type="text"
                    value={editValue}
                    placeholder="e.g. A1000, A1010"
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleFinishEdit(node.id, 'predecessors')}
                    onKeyDown={(e) => handleKeyDown(e, node.id, 'predecessors')}
                    className="w-full bg-black/40 text-slate-205 border border-cyan-500/50 rounded-lg px-2 text-xs font-mono focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span 
                    onDoubleClick={() => startInlineEdit(node.id, 'predecessors', getPredecessorsString(node.id))}
                    className="w-full text-indigo-400 cursor-text py-1.5 block min-h-[1.5rem] truncate text-[11px] hover:text-indigo-350 transition-colors"
                    title="Double click to edit Predecessors list"
                  >
                    {getPredecessorsString(node.id) || (
                      <span className="text-slate-600 text-[10px] italic">None</span>
                    )}
                  </span>
                )}
              </div>

              {/* 8. Resources and Assignees */}
              <div className="px-2 h-full flex items-center overflow-hidden border-l border-white/5 text-left">
                {isWbs ? (
                  <span className="text-slate-600">—</span>
                ) : (
                  <div className="w-full flex items-center min-h-[1.5rem] py-1 select-none overflow-hidden pr-1">
                    {(() => {
                      const assignedRoles = taskRoles.filter(tr => tr.taskId === node.id);
                      if (assignedRoles.length > 0) {
                        return (
                          <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
                            {assignedRoles.map(tr => {
                              const userObj = users.find(u => u.id === tr.userId);
                              let roleAbbrev = 'O';
                              let badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/20';
                              if (tr.role === 'reviewer') {
                                roleAbbrev = 'R';
                                badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/20';
                              } else if (tr.role === 'executor') {
                                roleAbbrev = 'EX';
                                badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20';
                              } else if (tr.role === 'project manager') {
                                roleAbbrev = 'PM';
                                badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/20';
                              }
                              return (
                                <span 
                                  key={tr.id}
                                  title={`${tr.role.toUpperCase()}: ${userObj?.username || 'Unknown'}`}
                                  className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] border font-medium ${badgeColor}`}
                                >
                                  <span className="font-mono text-[7px] font-bold uppercase tracking-tighter opacity-80">{roleAbbrev}:</span>
                                  <span className="truncate max-w-[34px]">{userObj?.username.split(' ')[0]}</span>
                                </span>
                              );
                            })}
                          </div>
                        );
                      }

                      // Fallback to static text resources if no taskRoles configured
                      const r = node as ActivityNode;
                      if (r.resources && r.resources.length > 0) {
                        return (
                          <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-[10px] border border-white/10 font-medium text-slate-300 w-fit backdrop-blur-sm truncate">
                            <UserSquare2 className="w-2.5 h-2.5 text-cyan-405 shrink-0" />
                            {r.resources[0]}
                            {r.resources.length > 1 && ` +${r.resources.length - 1}`}
                          </span>
                        );
                      }

                      return <span className="text-slate-600 italic text-[10px]">None</span>;
                    })()}
                  </div>
                )}
              </div>

              {/* 9. Context Action row triggers */}
              <div className="flex items-center justify-center gap-1 border-l border-white/5 h-full px-1">
                {isEditMode && (
                  isWbs ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSubNode(node.id, 'activity');
                      }}
                      title="Add Activity inside this WBS node"
                      className="p-1 text-slate-450 hover:text-cyan-400 rounded hover:bg-white/5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNode(node.id);
                      }}
                      title="Delete Activity"
                      className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-white/5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}

        {visibleRows.length === 0 && (
          <div className="p-8 text-center text-slate-500 italic">
            No scheduler items found. Click 'Add WBS' above to begin planning.
          </div>
        )}
      </div>
    </div>
  );
}
