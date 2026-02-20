import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
// تسجيل Service Worker للإشعارات في الخلفية
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('تم تسجيل ServiceWorker بنجاح: ', registration.scope);
      })
      .catch(err => {
        console.log('فشل تسجيل ServiceWorker: ', err);
      });
  });
}
