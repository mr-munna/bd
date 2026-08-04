import React, { useState, useMemo } from 'react';
import { 
  History, Search, Filter, Trash2, Clock, User, Shield, Mail,
  PlusCircle, Edit3, Trash, Bookmark, CheckCircle2, XCircle, 
  UserCheck, AlertCircle, RefreshCw, FileText, Layers, Calendar
} from 'lucide-react';
import { ActivityLog, UserDoc } from '../types';
import { deleteDoc, doc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

interface ActivityLogManagerProps {
  logs: ActivityLog[];
  isAppOwner: boolean;
  users: UserDoc[];
  onClearLogs?: () => void;
  emailNotificationsEnabled?: boolean;
  onToggleEmailNotifications?: (enabled: boolean) => void;
}

export const ActivityLogManager: React.FC<ActivityLogManagerProps> = ({
  logs,
  isAppOwner,
  users,
  emailNotificationsEnabled = true,
  onToggleEmailNotifications,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedItemType, setSelectedItemType] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // Filtered Logs calculation
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (log.userName || '').toLowerCase().includes(q);
        const matchesEmail = (log.userEmail || '').toLowerCase().includes(q);
        const matchesDetails = (log.details || '').toLowerCase().includes(q);
        const matchesItemName = (log.itemName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesDetails && !matchesItemName) {
          return false;
        }
      }

      // Action Filter
      if (selectedAction !== 'all' && log.action !== selectedAction) {
        return false;
      }

      // Item Type Filter
      if (selectedItemType !== 'all' && log.itemType !== selectedItemType) {
        return false;
      }

      // User Filter
      if (selectedUser !== 'all' && log.userEmail !== selectedUser) {
        return false;
      }

      // Date Range Filter
      if (dateRange !== 'all') {
        const logDate = new Date(log.timestamp);
        const now = new Date();
        if (dateRange === 'today') {
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (logDate < startOfDay) return false;
        } else if (dateRange === '7days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < sevenDaysAgo) return false;
        } else if (dateRange === '30days') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < thirtyDaysAgo) return false;
        }
      }

      return true;
    });
  }, [logs, searchQuery, selectedAction, selectedItemType, selectedUser, dateRange]);

  // Statistics
  const stats = useMemo(() => {
    const total = logs.length;
    const todayCount = logs.filter(l => {
      const d = new Date(l.timestamp);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;

    // Top active user
    const userCounts: Record<string, { name: string; count: number }> = {};
    logs.forEach(l => {
      const email = l.userEmail || 'unknown';
      if (!userCounts[email]) {
        userCounts[email] = { name: l.userName || email, count: 0 };
      }
      userCounts[email].count++;
    });

    let topUser = 'N/A';
    let maxCount = 0;
    Object.values(userCounts).forEach(u => {
      if (u.count > maxCount) {
        maxCount = u.count;
        topUser = `${u.name} (${u.count})`;
      }
    });

    const addCount = logs.filter(l => l.action === 'add' || l.action === 'import').length;
    const editCount = logs.filter(l => l.action === 'edit').length;
    const deleteCount = logs.filter(l => l.action === 'delete' || l.action === 'clear').length;
    const bookCount = logs.filter(l => l.action === 'book' || l.action === 'unbook').length;

    return { total, todayCount, topUser, addCount, editCount, deleteCount, bookCount };
  }, [logs]);

  // Clear all logs handler (App Owner only)
  const handleClearAllLogs = async () => {
    if (!isAppOwner) return;
    setIsClearing(true);
    try {
      const snapshot = await getDocs(collection(db, 'activity_logs'));
      const batch = writeBatch(db);
      snapshot.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      setShowConfirmClear(false);
    } catch (err) {
      console.error("Failed to clear activity logs:", err);
      alert("Failed to clear logs. Please try again.");
    } finally {
      setIsClearing(false);
    }
  };

  const getActionBadge = (action: ActivityLog['action']) => {
    switch (action) {
      case 'add':
      case 'import':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <PlusCircle className="w-3.5 h-3.5" /> ADDED
          </span>
        );
      case 'edit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Edit3 className="w-3.5 h-3.5" /> EDITED
          </span>
        );
      case 'delete':
      case 'clear':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <Trash className="w-3.5 h-3.5" /> DELETED
          </span>
        );
      case 'book':
      case 'unbook':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <Bookmark className="w-3.5 h-3.5" /> BOOKED
          </span>
        );
      case 'approve':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED
          </span>
        );
      case 'reject':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <XCircle className="w-3.5 h-3.5" /> REJECTED
          </span>
        );
      case 'role_change':
      case 'status_change':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <UserCheck className="w-3.5 h-3.5" /> USER ROLE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            <AlertCircle className="w-3.5 h-3.5" /> SYSTEM
          </span>
        );
    }
  };

  const getItemTypeTag = (type: ActivityLog['itemType']) => {
    switch (type) {
      case 'tile':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">TILE</span>;
      case 'good':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">GOOD</span>;
      case 'tool':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">TOOL</span>;
      case 'booking':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">BOOKING</span>;
      case 'delivery':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">DELIVERY</span>;
      case 'sale':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">SALE</span>;
      case 'user':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">USER</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">SYSTEM</span>;
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'N/A';
    try {
      const date = typeof ts === 'string' ? new Date(ts) : (ts?.toDate ? ts.toDate() : new Date(ts));
      if (isNaN(date.getTime())) return 'N/A';
      
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return String(ts);
    }
  };

  // Get distinct list of user emails from logs & users
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => l.userEmail && set.add(l.userEmail));
    users.forEach(u => u.email && set.add(u.email));
    return Array.from(set);
  }, [logs, users]);

  if (!isAppOwner) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-xl font-bold text-gray-900">Access Restricted</h3>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          Activity history and audit records are strictly reserved for the App Owner (`bijoymahmudmunna@gmail.com`).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-semibold tracking-wide border border-white/10">
              <Shield className="w-3.5 h-3.5" /> APP OWNER EXCLUSIVE AUDIT LOGS
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <History className="w-8 h-8 text-emerald-400" />
              Member Activity History
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl font-normal leading-relaxed">
              সদস্যদের যেকোনো কাজ (Product Add, Edit, Delete, Book, Role change, etc.) স্বয়ংক্রিয়ভাবে এখানে রেকর্ড থাকবে। অ্যাপ অনার হিসেবে আপনি যেকোনো সময় সম্পূর্ণ অ্যাক্টিভিটি হিস্ট্রি দেখতে ও ফিল্টার করতে পারবেন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onToggleEmailNotifications && (
              <div className="flex items-center gap-2.5 bg-slate-800/90 px-3.5 py-2 rounded-xl border border-slate-700/80 text-xs">
                <Mail className={`w-4 h-4 ${emailNotificationsEnabled ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="font-medium text-slate-200 hidden sm:inline">
                  Member Email:
                </span>
                <button
                  type="button"
                  onClick={() => onToggleEmailNotifications(!emailNotificationsEnabled)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    emailNotificationsEnabled 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30' 
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  }`}
                  title="Toggle automatic email notifications when products are edited or deleted"
                >
                  <span className={`w-2 h-2 rounded-full ${emailNotificationsEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {emailNotificationsEnabled ? 'ON (চালু)' : 'OFF (বন্ধ)'}
                </button>
              </div>
            )}

            <button
              onClick={() => setShowConfirmClear(true)}
              disabled={logs.length === 0}
              className="px-4 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-2 transition-all border border-rose-500/30 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Clear History
            </button>
          </div>
        </div>

        {/* Subtle Decorative Backdrop */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Quick Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Actions</span>
            <Layers className="w-4 h-4 text-slate-700" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-gray-900">{stats.total}</span>
            <span className="text-xs text-gray-500 block mt-1">Logged activities</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Today's Actions</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">{stats.todayCount}</span>
            <span className="text-xs text-gray-500 block mt-1">Recorded today</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Add / Edit / Delete</span>
            <Edit3 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-600">+{stats.addCount}</span>
            <span className="text-xl sm:text-2xl font-black text-blue-600">{stats.editCount}</span>
            <span className="text-xl sm:text-2xl font-black text-rose-600">-{stats.deleteCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider">
            <span>Most Active Member</span>
            <User className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3">
            <span className="text-sm sm:text-base font-bold text-gray-900 truncate block">{stats.topUser}</span>
            <span className="text-xs text-gray-500 block mt-1">Top contributor</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by member name, email, product or action details..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Action Filter */}
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-3 py-2.5 text-xs font-semibold bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-gray-700"
            >
              <option value="all">All Actions</option>
              <option value="add">Added Items</option>
              <option value="edit">Edited Items</option>
              <option value="delete">Deleted Items</option>
              <option value="book">Booked Items</option>
              <option value="approve">Approved</option>
              <option value="reject">Rejected</option>
              <option value="role_change">User Permissions</option>
            </select>

            {/* Item Type Filter */}
            <select
              value={selectedItemType}
              onChange={(e) => setSelectedItemType(e.target.value)}
              className="px-3 py-2.5 text-xs font-semibold bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-gray-700"
            >
              <option value="all">All Types</option>
              <option value="tile">Tiles</option>
              <option value="good">Goods</option>
              <option value="tool">Tools</option>
              <option value="booking">Bookings</option>
              <option value="delivery">Deliveries</option>
              <option value="user">Users</option>
            </select>

            {/* Member Filter */}
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-2.5 text-xs font-semibold bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-gray-700 max-w-[150px] truncate"
            >
              <option value="all">All Members</option>
              {uniqueUsers.map(email => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>

            {/* Date Range Filter */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-3 py-2.5 text-xs font-semibold bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-gray-700"
            >
              <option value="all">All Time</option>
              <option value="today">Today Only</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span>
            Showing <strong>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> activity records
          </span>
          {(searchQuery || selectedAction !== 'all' || selectedItemType !== 'all' || selectedUser !== 'all' || dateRange !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedAction('all');
                setSelectedItemType('all');
                setSelectedUser('all');
                setDateRange('all');
              }}
              className="text-indigo-600 hover:underline font-semibold flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Logs Table / Cards Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <History className="w-12 h-12 text-gray-300 mx-auto" />
            <h4 className="text-base font-bold text-gray-700">No Activity Logs Found</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              There are no recorded activities matching your current filters. Member actions like product updates, bookings, and deletions will automatically show up here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-100 border-b border-gray-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">SL</th>
                  <th className="py-3 px-4 w-44">Date & Time</th>
                  <th className="py-3 px-4 w-48">Member / User</th>
                  <th className="py-3 px-4 w-32">Action</th>
                  <th className="py-3 px-4 w-24">Category</th>
                  <th className="py-3 px-4">Details / Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredLogs.map((log, index) => (
                  <tr 
                    key={log.id || index}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Index */}
                    <td className="py-3.5 px-4 text-center font-medium text-gray-400">
                      {index + 1}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 font-medium text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </td>

                    {/* User Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {(log.userName || log.userEmail || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 truncate max-w-[140px]">
                            {log.userName || 'Member'}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate max-w-[140px]">
                            {log.userEmail}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Action Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Item Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getItemTypeTag(log.itemType)}
                    </td>

                    {/* Details */}
                    <td className="py-3.5 px-4 text-gray-800 font-medium">
                      <div className="space-y-0.5">
                        {log.itemName && (
                          <div className="font-bold text-slate-900">
                            {log.itemName}
                          </div>
                        )}
                        <div className="text-gray-600 text-[12px] leading-relaxed">
                          {log.details}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      {showConfirmClear && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-full">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">Clear Activity Logs?</h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Are you sure you want to permanently delete all {logs.length} activity records from Firestore? Future member actions will continue to be logged.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowConfirmClear(false)}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllLogs}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isClearing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Yes, Clear All Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
