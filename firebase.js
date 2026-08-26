// firebase-config.js — общая точка входа в Firebase для всех страниц AKUR
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail,
  signOut, signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import {
  getDatabase, ref, get, set, push, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";

// Тот же проект, что и в предыдущих версиях — данные (студии/фильмы/юзеры) сохраняются.
export const firebaseConfig = {
  apiKey: "AIzaSyBPwpR81prWq4_Ef1KX1T_uA4WsgyFMR8k",
  authDomain: "akur-tv.firebaseapp.com",
  databaseURL: "https://akur-tv-default-rtdb.firebaseio.com",
  projectId: "akur-tv",
  storageBucket: "akur-tv.firebasestorage.app",
  messagingSenderId: "260087189248",
  appId: "1:260087189248:web:2230651bb99a274bd86de5",
  measurementId: "G-GJHMDS0KM7"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, signInAnonymously,
  ref, get, set, push, update, remove, onValue
};

// ===== Список жанров, единый для всего приложения =====
export const GENRES = [
  "Боевик", "Драма", "Комедия", "Фантастика", "Фэнтези", "Ужасы",
  "Триллер", "Мелодрама", "Мультфильм", "Детектив", "Приключения",
  "Аниме", "Документальный", "Криминал", "Семейный"
];

// ===== Вспомогательные утилиты, общие для index/admin =====

// Превращает произвольную ссылку (в т.ч. на VK Видео) в embed-ссылку для iframe
export function toEmbedUrl(url, startSeconds) {
  if (!url) return "";
  url = url.trim();
  let embed = url;
  // Уже готовая embed-ссылка VK
  if (/vk\.com\/video_ext\.php/.test(url)) {
    embed = url;
  } else {
    // https://vk.com/video-123456_789012 или https://vk.com/video123_456
    const m = url.match(/video(-?\d+)_(\d+)(?:\?.*hash=([\w]+))?/);
    if (m) {
      const oid = m[1];
      const id = m[2];
      const hash = m[3] ? `&hash=${m[3]}` : "";
      embed = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2${hash}`;
    } else if (/youtu\.?be/.test(url)) {
      const yt = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
      if (yt) embed = `https://www.youtube.com/embed/${yt[1]}`;
    }
  }
  if (startSeconds) {
    embed += (embed.includes("?") ? "&" : "?") + "t=" + Math.max(0, Math.floor(startSeconds));
  }
  return embed;
}

export function formatTime(totalSeconds) {
  totalSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = n => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function timeToSeconds(str) {
  if (!str) return 0;
  const parts = str.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  while (parts.length < 3) parts.unshift(0);
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}
