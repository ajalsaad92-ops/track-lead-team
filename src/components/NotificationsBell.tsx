import { useState, useEffect, useRef } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function NotificationsBell() {
const { user } = useAuth();
const navigate = useNavigate();
const [notifications, setNotifications] = useState<any[]>([]);
const [isOpen, setIsOpen] = useState(false);
const dropdownRef = useRef<HTMLDivElement>(null);

const loadNotifications = () => {
if (!user) return;
const saved = localStorage.getItem(app_notifs_${user.id});
if (saved) {
setNotifications(JSON.parse(saved));
}
};

useEffect(() => {
loadNotifications();
window.addEventListener("new_notification", loadNotifications);

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
    setIsOpen(false);
  }
};
document.addEventListener("mousedown", handleClickOutside);

return () => {
  window.removeEventListener("new_notification", loadNotifications);
  document.removeEventListener("mousedown", handleClickOutside);
};
}, [user]);

const unreadCount = notifications.filter(n => !n.is_read).length;

const markAllAsRead = () => {
const updated = notifications.map(n => ({ ...n, is_read: true }));
setNotifications(updated);
if (user) localStorage.setItem(app_notifs_${user.id}, JSON.stringify(updated));
};

const clearAll = () => {
setNotifications([]);
if (user) localStorage.removeItem(app_notifs_${user.id});
};

const markAsRead = (id: string) => {
const updated = notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
setNotifications(updated);
if (user) localStorage.setItem(app_notifs_${user.id}, JSON.stringify(updated));
};

// دالة التعامل مع الضغط على الإشعار للتوجه للمكان الصحيح
const handleNotificationClick = (notif: any) => {
markAsRead(notif.id);
setIsOpen(false);

if (notif.data?.taskId) {
  navigate(`/tasks?taskId=${notif.data.taskId}`);
} else if (notif.data?.requestId) {
  navigate(`/hr?leaveId=${notif.data.requestId}`);
} else {
  navigate("/tasks");
}
};

if (!user) return null;

return (
<div className="relative" ref={dropdownRef}>
<button
onClick={() => setIsOpen(!isOpen)}
className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
>
<Bell className="w-6 h-6 text-slate-700" />
{unreadCount > 0 && (
<span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 border-2 border-white rounded-full">
{unreadCount > 99 ? "99+" : unreadCount}
</span>
)}
</button>

  {isOpen && (
    <div className="absolute left-0 top-full mt-2 w-[300px] sm:w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-[400px]">
      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <h3 className="font-bold text-sm text-slate-800">الإشعارات</h3>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Check className="w-3 h-3" /> قراءة الكل
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll} className="text-xs text-red-500 hover:underline flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> مسح
            </button>
          )}
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {notifications.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-6">لا توجد إشعارات حالياً</p>
        ) : (
          notifications.map((notif) => (
            <div 
              key={notif.id} 
              onClick={() => handleNotificationClick(notif)}
              className={`p-3 rounded-md cursor-pointer transition-colors ${notif.is_read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50 border border-blue-100 hover:bg-blue-100'}`}
            >
              <h4 className={`text-sm ${notif.is_read ? 'font-medium text-slate-700' : 'font-bold text-blue-900'}`}>
                {notif.title}
              </h4>
              <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{notif.body}</p>
              <span className="text-[10px] text-slate-400 mt-2 block">
                {new Date(notif.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })} - {new Date(notif.created_at).toLocaleDateString('ar-IQ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )}
</div>
);
}
