import { matchesDocumentSearch } from '../utils/documentSearch';
import { useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Copy, 
  Trash2, 
  Play, 
  FileSignature, 
  FolderOpen, 
  Clock, 
  LayoutGrid, 
  List, 
  MoreVertical,
  X,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DraftStatus, SavedDraft } from '../types';
import { TN_MASTER_DATA } from '../utils/dummyData';

export default function DocumentCenter() {
  const { 
    savedDrafts, 
    createDraft, 
    loadDraft, 
    deleteDraft, 
    duplicateDraft,
    updateDraftStatus,
    createDraftRevision,
    retrySyncDraft,
    lastSaveError,
    calculateProgress
  } = useApp();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<'modifiedAt' | 'progress' | 'consideration'>('modifiedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // New Draft Modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState('SALE');
  const [selectedSubType, setSelectedSubType] = useState('SALE_METRO');

  // Filtering & Sorting Logic
  const filteredDrafts = savedDrafts
    .filter(draft => {
      const matchSearch = matchesDocumentSearch(draft, search);

      const matchStatus = statusFilter === 'All' || draft.status === statusFilter;
      
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'modifiedAt') {
        comparison = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
      } else if (sortField === 'progress') {
        comparison = a.progress - b.progress;
      } else if (sortField === 'consideration') {
        comparison = a.consideration - b.consideration;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const handleCreateDraft = () => {
    createDraft(selectedDocType, selectedSubType);
    setShowNewModal(false);
  };

  const getStatusBadgeStyles = (status: DraftStatus) => {
    switch (status) {
      case 'Draft':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'In Progress':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'Pending Review':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Generated':
        return 'bg-teal-50 text-teal-700 border-teal-100';
      case 'Finalized':
      case 'Exported':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Archived':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 text-left">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-emerald-600" />
            Document Registry Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access, filter, duplicate, or resume drafting state-validated registry deeds
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#c49a36] hover:bg-[#b58a2b] text-white font-bold text-xs rounded-lg shadow-md shadow-emerald-700/10 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Draft New Deed</span>
        </button>
      </div>

      {lastSaveError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{lastSaveError}</span>
          </div>
        </div>
      )}

      {/* Filtering, Search & Sorting Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Search reference, party, property or survey..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-700 focus:outline-none transition font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          
          {/* Status Select */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-xs text-slate-600">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-bold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent focus:outline-none pr-1 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Generated">Generated</option>
              <option value="Finalized">Finalized</option>
              <option value="Exported">Exported</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Sort Select */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-xs text-slate-600">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-bold">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="bg-transparent focus:outline-none pr-1 text-xs font-semibold text-slate-800 cursor-pointer"
            >
              <option value="modifiedAt">Last Modified</option>
              <option value="progress">Completeness</option>
              <option value="consideration">Deed Value</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="text-[10px] font-extrabold text-emerald-600 bg-white border border-slate-200 px-1 py-0.5 rounded ml-1"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>

          {/* Grid/List toggler */}
          <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-50 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

        </div>

      </div>

      {/* No Drafts Found Message */}
      {filteredDrafts.length === 0 && (
        <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center space-y-4 shadow-sm max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">No Registry Drafts Match Criteria</h3>
            <p className="text-xs text-slate-400 mt-1">Try relaxing your search terms or filtering to "All Statuses".</p>
          </div>
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('All');
            }}
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === 'grid' && filteredDrafts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDrafts.map((draft) => {
            const progress = calculateProgress(draft.state);
            const isFinalizedRecord = draft.status === 'Finalized' || draft.status === 'Exported';
            return (
              <div 
                key={draft.id} 
                className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex flex-col h-full group"
              >
                {/* Top Section */}
                <div className="p-5 flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-mono font-extrabold text-slate-400 tracking-wider">
                        {draft.docNo}
                      </span>
                      {draft.version && draft.version > 1 && (
                        <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.2 rounded">
                          v{draft.version}
                        </span>
                      )}
                      {draft.unsynced && (
                        <button
                          type="button"
                          onClick={() => retrySyncDraft(draft.id)}
                          className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded hover:bg-amber-100"
                          title={draft.lastSyncError || 'Saved on this device — click to sync'}
                        >
                          Unsynced • Retry
                        </button>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyles(draft.status)}`}>
                      {draft.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800 line-clamp-1">{draft.docType}</h3>
                    <p className="text-[11px] font-semibold text-teal-600 mt-0.5 uppercase tracking-wide">{draft.subType}</p>
                  </div>

                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Property Address</p>
                    <p className="text-xs font-medium text-slate-700 line-clamp-2 leading-relaxed">
                      {draft.propertyAddress}
                    </p>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Value (INR)</p>
                      <p className="font-extrabold text-slate-800 mt-0.5">
                        {draft.consideration === 0 ? 'Exempt' : new Intl.NumberFormat('en-IN').format(draft.consideration)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Modified</p>
                      <p className="font-semibold text-slate-600 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {new Date(draft.modifiedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Completeness bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-400 uppercase tracking-tight">Wizard Progress</span>
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                        {progress}% Completed
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/50">
                      <div 
                        className={`h-full transition-all duration-300 ${progress === 100 ? 'bg-[#c49a36]' : 'bg-emerald-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="p-4 bg-slate-50 border-t border-slate-150 rounded-b-xl flex items-center justify-between gap-2">
                  <button
                    onClick={() => loadDraft(draft.id)}
                    className="flex items-center gap-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex-1 justify-center"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>{isFinalizedRecord ? 'View / Revise' : 'Resume Drafting'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {isFinalizedRecord ? (
                      <button
                        type="button"
                        onClick={() => createDraftRevision(draft.id, 'Revision initiated from Document Registry Center')}
                        className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition"
                        title="Create a new editable revision while preserving history"
                      >
                        New Revision
                      </button>
                    ) : (
                      <select
                        value={draft.status}
                        onChange={(e) => updateDraftStatus(draft.id, e.target.value as DraftStatus)}
                        className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg px-2 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="Draft">Draft</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Pending Review">Pending Review</option>
                        <option value="Approved">Approved</option>
                        <option value="Generated">Generated</option>
                        <option value="Archived">Archived</option>
                      </select>
                    )}

                    <button
                      onClick={() => duplicateDraft(draft.id)}
                      title="Duplicate Draft"
                      className="p-2 border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteDraft(draft.id)}
                      disabled={isFinalizedRecord}
                      title={isFinalizedRecord ? 'Finalized deeds cannot be deleted' : 'Delete Draft'}
                      className="p-2 border border-rose-100 bg-white hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && filteredDrafts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-150 bg-slate-50/50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-3 px-4">Deed Reference & Type</th>
                <th className="py-3 px-4">Property Location</th>
                <th className="py-3 px-4 text-right">Value (INR)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Wizard Progress</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDrafts.map((draft) => {
                const progress = calculateProgress(draft.state);
                return (
                  <tr key={draft.id} className="hover:bg-slate-50/40 transition">
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-mono text-slate-400 font-extrabold">{draft.docNo}</span>
                      <div className="font-extrabold text-slate-800 text-xs mt-0.5">{draft.docType}</div>
                      <span className="text-[9px] font-bold text-teal-600 uppercase tracking-tight block">{draft.subType}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600 max-w-xs truncate">
                      {draft.propertyAddress}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                      {draft.consideration === 0 ? 'Exempt' : new Intl.NumberFormat('en-IN').format(draft.consideration)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyles(draft.status)}`}>
                        {draft.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/50">
                          <div 
                            className={`h-full ${progress === 100 ? 'bg-[#c49a36]' : 'bg-emerald-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="font-bold text-[10px] text-slate-500">{progress}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => loadDraft(draft.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Resume</span>
                        </button>
                        <button
                          onClick={() => duplicateDraft(draft.id)}
                          className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded"
                          title="Duplicate"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteDraft(draft.id)}
                          className="p-1.5 border border-rose-100 hover:bg-rose-50 text-rose-500 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* NEW DRAFT MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden text-left">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-700">Configure New Draft Deed</h2>
              <button 
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              
              {/* Document Type */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Document Deed Type</label>
                <select
                  value={selectedDocType}
                  onChange={(e) => {
                    setSelectedDocType(e.target.value);
                    // default subtype
                    if (e.target.value === 'GIFT') {
                      setSelectedSubType('GIFT_FAMILY');
                    } else if (e.target.value === 'LEASE') {
                      setSelectedSubType('LEASE_RES');
                    } else {
                      setSelectedSubType('SALE_METRO');
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {TN_MASTER_DATA.documentTypes.map(type => (
                    <option key={type.id} value={type.code}>{type.nameEn} ({type.nameTa})</option>
                  ))}
                </select>
              </div>

              {/* Subtype */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Deed Subtype Category</label>
                <select
                  value={selectedSubType}
                  onChange={(e) => setSelectedSubType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {TN_MASTER_DATA.documentSubtypes
                    .filter(sub => {
                      if (selectedDocType === 'SALE') return sub.code.startsWith('SALE');
                      if (selectedDocType === 'GIFT') return sub.code.startsWith('GIFT');
                      if (selectedDocType === 'LEASE') return sub.code.startsWith('LEASE');
                      return true;
                    })
                    .map(sub => (
                      <option key={sub.id} value={sub.code}>{sub.nameEn} ({sub.nameTa})</option>
                    ))}
                </select>
              </div>

              {/* Policy/Compliance Note */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-[11px] text-amber-800 leading-normal font-medium">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <p>
                  Deed360 automated check engines will run live boundaries, and parent document cross-verifications. Ensure accuracy in survey structures.
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDraft}
                className="px-4 py-2 bg-[#c49a36] hover:bg-[#b58a2b] text-white rounded-lg text-xs font-bold shadow-sm"
              >
                Launch Drafting Wizard
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
