import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function TopHeader() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications', { params: { limit: 10 } });
      if (res.data?.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.data.filter((n) => !n.isRead).length);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30s
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-[#E8D5C4]">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Halo, {user?.name?.split(' ')[0]}</h2>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-[#FAD4C0]/30 transition-colors"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E8D5C4] rounded-2xl shadow-lg shadow-black/8 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8D5C4] bg-[#FFF5E6]/50">
              <h3 className="font-semibold text-gray-900">Notifikasi</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-[#80A1C1] hover:text-[#2C5282] font-medium flex items-center gap-1"
                >
                  <Check size={14} /> Tanda semua dibaca
                </button>
              )}
            </div>

            <div className="max-h-[350px] overflow-y-auto hidden-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 bg-[#FAD4C0]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Bell className="text-gray-400" size={20} />
                  </div>
                  <p className="text-gray-500 text-sm">Belum ada notifikasi.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E8D5C4]/50">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 transition-colors ${
                        notif.isRead ? 'bg-transparent' : 'bg-[#FAD4C0]/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${notif.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase tracking-wider">
                            {new Date(notif.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        {!notif.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="p-1.5 text-gray-400 hover:text-[#80A1C1] hover:bg-[#80A1C1]/10 rounded-lg transition-colors flex-shrink-0"
                            title="Tandai dibaca"
                          >
                            <Check size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {notifications.length > 0 && (
              <div className="p-2 border-t border-[#E8D5C4] bg-[#FFF5E6]/80">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}