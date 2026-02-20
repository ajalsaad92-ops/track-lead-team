// src/utils/pushNotifications.ts

// دالة مساعدة لتحويل مفتاح التشفير
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUserToPush() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // هنا نحتاج مفتاح VAPID العام (هذا مفتاح مؤقت للتجربة)
      // لاحقاً ستحتاج لتوليد مفتاح خاص بمشروعك
      const publicVapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
      const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);

      // طلب الاشتراك في خدمة الإشعارات
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      console.log('تم اشتراك المستخدم بنجاح:', subscription);
      
      // المفروض هنا نرسل الـ subscription لقاعدة البيانات للحفظ
      return subscription;
      
    } catch (error) {
      console.error('فشل الاشتراك في الإشعارات:', error);
      return null;
    }
  }
  return null;
}
