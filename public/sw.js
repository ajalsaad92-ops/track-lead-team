// public/sw.js

self.addEventListener('push', function(event) {
  // استقبال البيانات القادمة من الإشعار
  const data = event.data ? event.data.json() : { title: 'إشعار جديد', body: 'لديك تحديث جديد في النظام' };
  
  const options = {
    body: data.body,
    icon: '/favicon.ico', // أيقونة الإشعار (تأكد من وجود أيقونة بهذا الاسم في مجلد public)
    badge: '/favicon.ico',
    dir: 'rtl', // لدعم اللغة العربية
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// عند الضغط على الإشعار، يفتح التطبيق
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
