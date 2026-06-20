import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Home, Search, Compass, MessageCircle, Heart, PlusSquare, User, Settings,
  LogOut, Bookmark, Send, MoreHorizontal, X, Camera, Eye, EyeOff,
  Bell, Lock, HelpCircle, Image as ImageIcon,
  Grid3x3, Loader2, Sparkles, Trash2, Download, UserX, AlertTriangle,
  Users, Flag, ShieldCheck
} from "lucide-react";
import { db } from "./firebase";
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc,
  writeBatch, arrayUnion, arrayRemove,
} from "firebase/firestore";

/* ----------------------------------------------------------------------
   bandzaii — design tokens
   bg-deep:#0A1424  bg-surface:#101E36  bg-raised:#16294A  border:#1E3354
   green-500:#27D9A0  green-600:#1BB386  blue-glow:#3E8BFF  text:#EAF3F2
   muted:#7E93B5
   Display face: "Outfit" (rounded geometric, for wordmark + headings)
   Body face: "Inter"   Data face: "JetBrains Mono" (stats/counters)
-------------------------------------------------------------------------*/

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');`;

const PALETTE = ["#27D9A0", "#3E8BFF", "#F2B84B", "#FF7A6B", "#9B6BFF", "#3ED9D9"];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}

function colorFor(seed) {
  return PALETTE[hashStr(seed) % PALETTE.length];
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} j`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} sem`;
  return new Date(ts).toLocaleDateString("fr-FR");
}

// Avatar with initials, deterministic gradient background
function Avatar({ name, src, size = 40, ring = false }) {
  const c = colorFor(name || "?");
  const dim = size;
  return (
    <div
      style={{
        width: dim + (ring ? 6 : 0),
        height: dim + (ring ? 6 : 0),
        borderRadius: "9999px",
        padding: ring ? 2 : 0,
        background: ring ? `linear-gradient(135deg,#27D9A0,#3E8BFF)` : "transparent",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: dim,
          height: dim,
          borderRadius: "9999px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: src ? "#0A1424" : `linear-gradient(150deg, ${c}, #16294A)`,
          border: "1px solid #1E3354",
          fontFamily: "Outfit, sans-serif",
          fontWeight: 700,
          color: "#EAF3F2",
          fontSize: dim * 0.36,
        }}
      >
        {src ? (
          <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          initialsOf(name)
        )}
      </div>
    </div>
  );
}

function Logo({ size = 26 }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
      <span
        style={{
          fontFamily: "Outfit, sans-serif",
          fontWeight: 800,
          fontSize: size,
          letterSpacing: "-0.02em",
          background: "linear-gradient(120deg,#27D9A0,#3E8BFF)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        bandza
      </span>
      <span style={{ position: "relative", display: "inline-block" }}>
        <span
          style={{
            fontFamily: "Outfit, sans-serif",
            fontWeight: 800,
            fontSize: size,
            letterSpacing: "-0.02em",
            background: "linear-gradient(120deg,#27D9A0,#3E8BFF)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          i
        </span>
        <span
          className="pulse-dot"
          style={{
            position: "absolute",
            top: -size * 0.36,
            left: "50%",
            transform: "translateX(-50%)",
            width: size * 0.16,
            height: size * 0.16,
            borderRadius: "9999px",
            background: "#27D9A0",
          }}
        />
      </span>
      <span
        style={{
          fontFamily: "Outfit, sans-serif",
          fontWeight: 800,
          fontSize: size,
          letterSpacing: "-0.02em",
          background: "linear-gradient(120deg,#27D9A0,#3E8BFF)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        i
      </span>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#27D9A0", fontSize: 15 }}>
        {value}
      </span>
      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: "#7E93B5" }}>{label}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#7E93B5", fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  background: "#0E1B30",
  border: "1px solid #1E3354",
  borderRadius: 10,
  padding: "11px 13px",
  color: "#EAF3F2",
  fontFamily: "Inter, sans-serif",
  fontSize: 14.5,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

function PrimaryButton({ children, onClick, disabled, style, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: "Inter, sans-serif",
        fontWeight: 600,
        fontSize: 14.5,
        color: "#06140F",
        background: disabled ? "#1E3354" : "linear-gradient(120deg,#27D9A0,#3E8BFF)",
        border: "none",
        borderRadius: 10,
        padding: "11px 16px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "transform .12s ease, opacity .12s ease",
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, style, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "Inter, sans-serif",
        fontWeight: 600,
        fontSize: 13.5,
        color: active ? "#06140F" : "#EAF3F2",
        background: active ? "#27D9A0" : "#16294A",
        border: "1px solid " + (active ? "#27D9A0" : "#1E3354"),
        borderRadius: 9,
        padding: "7px 14px",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// Resize an image file to a base64 JPEG under a max dimension, to keep storage small
function resizeImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Generate an original gradient placeholder image (used for seed/demo posts)
function placeholderImage(seed, label) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  const c1 = colorFor(seed);
  const c2 = colorFor(seed + "x");
  const grad = ctx.createLinearGradient(0, 0, 600, 600);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, "#0A1424");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 600);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 40; i++) {
    const r = (hashStr(seed + i) % 60) + 10;
    const x = hashStr(seed + "x" + i) % 600;
    const y = hashStr(seed + "y" + i) % 600;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(10,20,36,0.35)";
  ctx.fillRect(0, 480, 600, 120);
  ctx.fillStyle = "#EAF3F2";
  ctx.font = "600 34px Outfit, sans-serif";
  ctx.fillText(label || "", 28, 545);
  return canvas.toDataURL("image/jpeg", 0.82);
}

const SESSION_KEY = "bandzaii_session_v1"; // localStorage key (browser-only, not shared)
const usersCol = collection(db, "users");
const postsCol = collection(db, "posts");
const seedDocRef = doc(db, "meta", "seed");

async function ensureSeedData() {
  try {
    const seedSnap = await getDoc(seedDocRef);
    if (seedSnap.exists()) return;
    const { users: su, posts: sp } = makeSeedData();
    const batch = writeBatch(db);
    su.forEach((u) => batch.set(doc(db, "users", u.id), u));
    sp.forEach((p) => batch.set(doc(db, "posts", p.id), p));
    batch.set(seedDocRef, { done: true, at: Date.now() });
    await batch.commit();
  } catch (e) {
    // Another client may be seeding at the same time, or Firestore isn't reachable yet — safe to ignore.
  }
}

const DEFAULT_NOTIF_PREFS = { likes: true, comments: true, newFollowers: true, messages: true };

// Ensures every user object has the newer fields, even ones saved before they existed.
function normalizeUser(u) {
  return {
    blocked: [],
    saved: [],
    notifPrefs: DEFAULT_NOTIF_PREFS,
    commentPermission: "everyone", // everyone | following | none
    showActivityStatus: true,
    ...u,
    notifPrefs: { ...DEFAULT_NOTIF_PREFS, ...(u.notifPrefs || {}) },
  };
}

function makeSeedData() {
  const now = Date.now();
  const users = [
    { id: "u_aya", username: "aya.codes", fullName: "Aya N'Diaye", email: "aya@example.com", password: "demo1234", bio: "Développeuse • café ☕ • Dakar", avatar: null, followers: ["u_marc", "u_lina"], following: ["u_marc"], private: false, createdAt: now },
    { id: "u_marc", username: "marc.travel", fullName: "Marc Dubois", email: "marc@example.com", password: "demo1234", bio: "Globe-trotter 🌍 | 32 pays", avatar: null, followers: ["u_aya"], following: ["u_aya", "u_lina"], private: false, createdAt: now },
    { id: "u_lina", username: "lina.cuisine", fullName: "Lina Haddad", email: "lina@example.com", password: "demo1234", bio: "Recettes maison 🍲 chaque dimanche", avatar: null, followers: ["u_marc"], following: [], private: false, createdAt: now },
  ].map(normalizeUser);
  const posts = [
    { id: "p1", userId: "u_marc", image: placeholderImage("marc1", "Sunrise"), caption: "Lever de soleil sur la baie ce matin 🌅 rien ne vaut ce silence.", likes: ["u_aya"], comments: [{ id: "c1", userId: "u_aya", text: "Magnifique 😍", ts: now }], createdAt: now - 3600_000 * 5 },
    { id: "p2", userId: "u_lina", image: placeholderImage("lina1", "Tajine"), caption: "Tajine du dimanche, prêt en 40 min. Recette dans les commentaires si ça vous tente !", likes: ["u_marc", "u_aya"], comments: [], createdAt: now - 3600_000 * 26 },
    { id: "p3", userId: "u_aya", image: placeholderImage("aya1", "Code & café"), caption: "Nouvelle fonctionnalité déployée 🚀 merci à l'équipe pour la nuit blanche.", likes: [], comments: [], createdAt: now - 3600_000 * 50 },
  ];
  return { users, posts };
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [view, setView] = useState("auth"); // auth | feed | profile | settings | explore
  const [authMode, setAuthMode] = useState("login");
  const [profileTarget, setProfileTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const flash = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(window.__bzToastTimer);
    window.__bzToastTimer = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- initial load: subscribe to Firestore in real time ----
  useEffect(() => {
    let usersLoaded = false;
    let postsLoaded = false;
    const maybeReady = () => {
      if (!usersLoaded || !postsLoaded) return;
      try {
        const sid = localStorage.getItem(SESSION_KEY);
        if (sid) {
          setSessionId(sid);
          setProfileTarget(sid);
          setView("feed");
        }
      } catch (e) { /* localStorage unavailable (private mode, etc.) */ }
      setReady(true);
    };

    const unsubUsers = onSnapshot(
      usersCol,
      (snap) => { setUsers(snap.docs.map((d) => normalizeUser({ id: d.id, ...d.data() }))); usersLoaded = true; maybeReady(); },
      () => { usersLoaded = true; maybeReady(); flash("Connexion à la base de données impossible."); }
    );
    const unsubPosts = onSnapshot(
      postsCol,
      (snap) => { setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); postsLoaded = true; maybeReady(); },
      () => { postsLoaded = true; maybeReady(); }
    );
    ensureSeedData();

    return () => { unsubUsers(); unsubPosts(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update local state immediately (so the UI never waits on the network), then write
  // the change to Firestore in the background. The live subscription above will reconcile
  // this with what every other visitor sees. Failures show a toast but never block the UI.
  const writeUser = useCallback((id, fields) => {
    updateDoc(doc(db, "users", id), fields).catch(() =>
      flash("Connexion impossible — cette modification n'a pas été sauvegardée.")
    );
  }, [flash]);

  const writePost = useCallback((id, fields) => {
    updateDoc(doc(db, "posts", id), fields).catch(() =>
      flash("Connexion impossible — cette modification n'a pas été sauvegardée.")
    );
  }, [flash]);

  const currentUser = useMemo(() => users.find((u) => u.id === sessionId) || null, [users, sessionId]);

  const goAuth = () => { setView("auth"); setAuthMode("login"); };

  const handleLogout = async () => {
    setSessionId(null);
    setProfileTarget(null);
    goAuth();
    flash("Déconnecté(e). À bientôt !");
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  };

  const handleRegister = async ({ username, fullName, email, password }) => {
    try {
      const uname = username.trim().toLowerCase();
      if (!uname || !fullName.trim() || !email.trim() || !password) return { error: "Tous les champs sont obligatoires." };
      if (!/^[a-z0-9_.]{3,20}$/.test(uname)) return { error: "Le nom d'utilisateur doit faire 3 à 20 caractères (lettres, chiffres, . _)." };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { error: "Adresse e-mail invalide." };
      if (password.length < 6) return { error: "Le mot de passe doit contenir au moins 6 caractères." };
      if (users.some((u) => u.username === uname)) return { error: "Ce nom d'utilisateur est déjà pris." };
      if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) return { error: "Cet e-mail est déjà associé à un compte." };

      const newUser = {
        id: "u_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        username: uname,
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        bio: "",
        avatar: null,
        followers: [],
        following: [],
        private: false,
        blocked: [],
        saved: [],
        notifPrefs: { ...DEFAULT_NOTIF_PREFS },
        commentPermission: "everyone",
        showActivityStatus: true,
        createdAt: Date.now(),
      };
      // Navigate right away (optimistic) — the Firestore write happens in the background,
      // and the live subscription will reconcile it for every visitor a moment later.
      setUsers((prev) => [...prev, newUser]);
      setSessionId(newUser.id);
      setProfileTarget(newUser.id);
      setView("feed");
      flash(`Bienvenue sur bandzaii, ${newUser.fullName.split(" ")[0]} !`);
      try { localStorage.setItem(SESSION_KEY, newUser.id); } catch (e) { /* ignore */ }
      setDoc(doc(db, "users", newUser.id), newUser).catch(() =>
        flash("Connexion impossible — ton compte n'a pas été sauvegardé sur le serveur.")
      );
      return { ok: true };
    } catch (err) {
      return { error: "Une erreur inattendue est survenue. Réessaie." };
    }
  };

  const handleLogin = async ({ identifier, password }) => {
    try {
      const id = identifier.trim().toLowerCase();
      const found = users.find((u) => u.username === id || u.email.toLowerCase() === id);
      if (!found || found.password !== password) return { error: "Identifiants incorrects." };
      setSessionId(found.id);
      setProfileTarget(found.id);
      setView("feed");
      flash(`Content de te revoir, ${found.fullName.split(" ")[0]} !`);
      try { localStorage.setItem(SESSION_KEY, found.id); } catch (e) { /* ignore */ }
      return { ok: true };
    } catch (err) {
      return { error: "Une erreur inattendue est survenue. Réessaie." };
    }
  };

  const toggleLike = async (postId) => {
    if (!currentUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const liked = post.likes.includes(currentUser.id);
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: liked ? p.likes.filter((id) => id !== currentUser.id) : [...p.likes, currentUser.id] } : p)));
    writePost(postId, { likes: liked ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id) });
  };

  const addComment = async (postId, text) => {
    if (!currentUser || !text.trim()) return;
    const comment = { id: "c_" + Date.now(), userId: currentUser.id, text: text.trim(), ts: Date.now() };
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, comment] } : p)));
    writePost(postId, { comments: arrayUnion(comment) });
  };

  const createPost = async (imageDataUrl, caption) => {
    if (!currentUser) return;
    const newPost = { id: "p_" + Date.now(), userId: currentUser.id, image: imageDataUrl, caption: caption.trim(), likes: [], comments: [], createdAt: Date.now() };
    setPosts((prev) => [newPost, ...prev]);
    flash("Publication partagée !");
    setDoc(doc(db, "posts", newPost.id), newPost).catch(() =>
      flash("Connexion impossible — la publication n'a pas été sauvegardée sur le serveur.")
    );
  };

  const toggleFollow = async (targetId) => {
    if (!currentUser || targetId === currentUser.id) return;
    const iFollow = currentUser.following.includes(targetId);
    setUsers((prev) => prev.map((u) => {
      if (u.id === currentUser.id) return { ...u, following: iFollow ? u.following.filter((id) => id !== targetId) : [...u.following, targetId] };
      if (u.id === targetId) return { ...u, followers: iFollow ? u.followers.filter((id) => id !== currentUser.id) : [...u.followers, currentUser.id] };
      return u;
    }));
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", currentUser.id), { following: iFollow ? arrayRemove(targetId) : arrayUnion(targetId) });
      batch.update(doc(db, "users", targetId), { followers: iFollow ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id) });
      await batch.commit();
    } catch (e) {
      flash("Connexion impossible — cette action n'a pas été sauvegardée.");
    }
  };

  const updateProfile = async (fields) => {
    if (!currentUser) return;
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, ...fields } : u)));
    flash("Profil mis à jour.");
    writeUser(currentUser.id, fields);
  };

  const changePassword = async (oldPwd, newPwd) => {
    if (!currentUser) return { error: "Non connecté." };
    if (currentUser.password !== oldPwd) return { error: "Mot de passe actuel incorrect." };
    if (newPwd.length < 6) return { error: "Le nouveau mot de passe doit contenir au moins 6 caractères." };
    await updateProfile({ password: newPwd });
    return { ok: true };
  };

  const updateAccountInfo = async ({ username, email }) => {
    if (!currentUser) return { error: "Non connecté." };
    const uname = username.trim().toLowerCase();
    const mail = email.trim();
    if (!uname || !mail) return { error: "Le nom d'utilisateur et l'e-mail sont obligatoires." };
    if (!/^[a-z0-9_.]{3,20}$/.test(uname)) return { error: "Le nom d'utilisateur doit faire 3 à 20 caractères (lettres, chiffres, . _)." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return { error: "Adresse e-mail invalide." };
    if (uname !== currentUser.username && users.some((u) => u.username === uname)) return { error: "Ce nom d'utilisateur est déjà pris." };
    if (mail.toLowerCase() !== currentUser.email.toLowerCase() && users.some((u) => u.email.toLowerCase() === mail.toLowerCase())) return { error: "Cet e-mail est déjà associé à un compte." };
    await updateProfile({ username: uname, email: mail });
    return { ok: true };
  };

  const toggleSave = async (postId) => {
    if (!currentUser) return;
    const isSaved = currentUser.saved.includes(postId);
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, saved: isSaved ? u.saved.filter((id) => id !== postId) : [...u.saved, postId] } : u)));
    writeUser(currentUser.id, { saved: isSaved ? arrayRemove(postId) : arrayUnion(postId) });
  };

  const deletePost = async (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    flash("Publication supprimée.");
    deleteDoc(doc(db, "posts", postId)).catch(() => flash("Connexion impossible — la suppression n'a pas été sauvegardée sur le serveur."));
  };

  const toggleBlock = async (targetId) => {
    if (!currentUser || targetId === currentUser.id) return;
    const isBlocked = currentUser.blocked.includes(targetId);
    setUsers((prev) => prev.map((u) => {
      if (u.id === currentUser.id) {
        return {
          ...u,
          blocked: isBlocked ? u.blocked.filter((id) => id !== targetId) : [...u.blocked, targetId],
          following: isBlocked ? u.following : u.following.filter((id) => id !== targetId),
          followers: isBlocked ? u.followers : u.followers.filter((id) => id !== targetId),
        };
      }
      if (u.id === targetId && !isBlocked) {
        return { ...u, following: u.following.filter((id) => id !== currentUser.id), followers: u.followers.filter((id) => id !== currentUser.id) };
      }
      return u;
    }));
    flash(isBlocked ? "Compte débloqué." : "Compte bloqué.");
    try {
      const batch = writeBatch(db);
      const myRef = doc(db, "users", currentUser.id);
      batch.update(myRef, { blocked: isBlocked ? arrayRemove(targetId) : arrayUnion(targetId) });
      if (!isBlocked) {
        batch.update(myRef, { following: arrayRemove(targetId), followers: arrayRemove(targetId) });
        batch.update(doc(db, "users", targetId), { following: arrayRemove(currentUser.id), followers: arrayRemove(currentUser.id) });
      }
      await batch.commit();
    } catch (e) {
      flash("Connexion impossible — cette action n'a pas été sauvegardée.");
    }
  };

  const removeFollower = async (followerId) => {
    if (!currentUser) return;
    setUsers((prev) => prev.map((u) => {
      if (u.id === currentUser.id) return { ...u, followers: u.followers.filter((id) => id !== followerId) };
      if (u.id === followerId) return { ...u, following: u.following.filter((id) => id !== currentUser.id) };
      return u;
    }));
    flash("Abonné(e) retiré(e).");
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", currentUser.id), { followers: arrayRemove(followerId) });
      batch.update(doc(db, "users", followerId), { following: arrayRemove(currentUser.id) });
      await batch.commit();
    } catch (e) {
      flash("Connexion impossible — cette action n'a pas été sauvegardée.");
    }
  };

  const deleteAccount = async (confirmUsername) => {
    if (!currentUser) return { error: "Non connecté." };
    if (confirmUsername.trim().toLowerCase() !== currentUser.username) {
      return { error: "Le nom d'utilisateur ne correspond pas." };
    }
    const myId = currentUser.id;
    const otherUsers = users.filter((u) => u.id !== myId);
    const myPosts = posts.filter((p) => p.userId === myId);

    // Optimistic local cleanup so navigation back to the auth screen is instant.
    setUsers(otherUsers.map((u) => ({
      ...u,
      followers: u.followers.filter((id) => id !== myId),
      following: u.following.filter((id) => id !== myId),
      blocked: u.blocked.filter((id) => id !== myId),
    })));
    setPosts(posts
      .filter((p) => p.userId !== myId)
      .map((p) => ({ ...p, likes: p.likes.filter((id) => id !== myId), comments: p.comments.filter((c) => c.userId !== myId) })));
    setSessionId(null);
    setProfileTarget(null);
    goAuth();
    flash("Ton compte a été supprimé.");
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", myId));
      myPosts.forEach((p) => batch.delete(doc(db, "posts", p.id)));
      otherUsers.forEach((u) => {
        const fields = {};
        if (u.followers.includes(myId)) fields.followers = arrayRemove(myId);
        if (u.following.includes(myId)) fields.following = arrayRemove(myId);
        if (u.blocked.includes(myId)) fields.blocked = arrayRemove(myId);
        if (Object.keys(fields).length) batch.update(doc(db, "users", u.id), fields);
      });
      posts
        .filter((p) => p.userId !== myId && (p.likes.includes(myId) || p.comments.some((c) => c.userId === myId)))
        .forEach((p) => {
          batch.update(doc(db, "posts", p.id), {
            likes: p.likes.filter((id) => id !== myId),
            comments: p.comments.filter((c) => c.userId !== myId),
          });
        });
      await batch.commit();
    } catch (e) {
      // The account still disappears locally for this browser; the cloud cleanup
      // can be retried by the next person who triggers a write to those documents.
    }
    return { ok: true };
  };

  const downloadMyData = () => {
    if (!currentUser) return;
    const myPosts = posts.filter((p) => p.userId === currentUser.id);
    const data = {
      profil: {
        nomUtilisateur: currentUser.username,
        nomComplet: currentUser.fullName,
        email: currentUser.email,
        bio: currentUser.bio,
        compteCree: new Date(currentUser.createdAt).toISOString(),
        abonnes: currentUser.followers.length,
        abonnements: currentUser.following.length,
      },
      publications: myPosts.map((p) => ({ id: p.id, legende: p.caption, jaimes: p.likes.length, commentaires: p.comments.length, publieLe: new Date(p.createdAt).toISOString() })),
    };
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bandzaii-${currentUser.username}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      flash("Téléchargement lancé.");
    } catch (err) {
      flash("Impossible de générer le fichier sur cet appareil.");
    }
  };

  if (!ready) {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 14 }}>
          <Logo size={32} />
          <Loader2 className="spin" size={20} color="#7E93B5" />
        </div>
      </Shell>
    );
  }

  if (!currentUser) {
    return (
      <Shell>
        <AuthScreen mode={authMode} setMode={setAuthMode} onLogin={handleLogin} onRegister={handleRegister} />
        {toast && <Toast text={toast} />}
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar
          view={view}
          setView={setView}
          onCreate={() => setShowCreate(true)}
          onSearch={() => setShowSearch(true)}
          onLogout={handleLogout}
          currentUser={currentUser}
          goProfile={() => { setProfileTarget(currentUser.id); setView("profile"); }}
        />
        <main style={{ flex: 1, display: "flex", justifyContent: "center", paddingBottom: 70 }}>
          <div style={{ width: "100%", maxWidth: view === "feed" ? 935 : 935, padding: "0 16px" }}>
            <TopBar
              currentUser={currentUser}
              onCreate={() => setShowCreate(true)}
              onSearch={() => setShowSearch(true)}
              goProfile={() => { setProfileTarget(currentUser.id); setView("profile"); }}
            />
            {view === "feed" && (
              <FeedView
                users={users}
                posts={posts}
                currentUser={currentUser}
                onLike={toggleLike}
                onComment={addComment}
                onOpenProfile={(id) => { setProfileTarget(id); setView("profile"); }}
                onFollow={toggleFollow}
                onSave={toggleSave}
                onDeletePost={deletePost}
                onBlock={toggleBlock}
                flash={flash}
              />
            )}
            {view === "explore" && (
              <ExploreView posts={posts} users={users} currentUser={currentUser} onOpenProfile={(id) => { setProfileTarget(id); setView("profile"); }} />
            )}
            {view === "profile" && (
              <ProfileView
                user={users.find((u) => u.id === profileTarget) || currentUser}
                allPosts={posts}
                users={users}
                currentUser={currentUser}
                onFollow={toggleFollow}
                onUpdateProfile={updateProfile}
                onBlock={toggleBlock}
                onRemoveFollower={removeFollower}
                onDeletePost={deletePost}
                isOwn={profileTarget === currentUser.id}
                flash={flash}
              />
            )}
            {view === "settings" && (
              <SettingsView
                currentUser={currentUser}
                onUpdateProfile={updateProfile}
                onChangePassword={changePassword}
                onUpdateAccountInfo={updateAccountInfo}
                onLogout={handleLogout}
                onUnblock={toggleBlock}
                onDeleteAccount={deleteAccount}
                onDownloadData={downloadMyData}
                users={users}
                flash={flash}
              />
            )}
          </div>
        </main>
      </div>

      <MobileNav
        view={view}
        setView={(v) => { setView(v); if (v === "profile") setProfileTarget(currentUser.id); }}
        onCreate={() => setShowCreate(true)}
      />

      {showCreate && (
        <CreatePostModal
          onClose={() => setShowCreate(false)}
          onSubmit={async (img, cap) => { await createPost(img, cap); setShowCreate(false); }}
        />
      )}
      {showSearch && (
        <SearchOverlay
          users={users.filter((u) => u.id !== currentUser.id && !currentUser.blocked.includes(u.id) && !(u.blocked || []).includes(currentUser.id))}
          onClose={() => setShowSearch(false)}
          onOpenProfile={(id) => { setProfileTarget(id); setView("profile"); setShowSearch(false); }}
        />
      )}
      {toast && <Toast text={toast} />}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ background: "#0A1424", minHeight: "100vh", color: "#EAF3F2", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::selection { background: #27D9A0; color: #06140F; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #1E3354; border-radius: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        input::placeholder, textarea::placeholder { color: #5C7295; }
        button { font-family: inherit; }
        a { color: inherit; text-decoration: none; }
        .pulse-dot { animation: bzpulse 2.2s ease-in-out infinite; }
        @keyframes bzpulse { 0%,100% { box-shadow: 0 0 0 0 rgba(39,217,160,0.55); } 70% { box-shadow: 0 0 0 6px rgba(39,217,160,0); } }
        .spin { animation: bzspin 1s linear infinite; }
        @keyframes bzspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .fade-in { animation: bzfade .25s ease both; }
        @keyframes bzfade { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform:none; } }
        .hoverable:hover { background: #16294A !important; }
        @media (prefers-reduced-motion: reduce) {
          .pulse-dot, .spin, .fade-in { animation: none !important; }
        }
        textarea { font-family: Inter, sans-serif; }
      `}</style>
      {children}
    </div>
  );
}

function Toast({ text }) {
  return (
    <div
      className="fade-in"
      style={{
        position: "fixed",
        bottom: 86,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#16294A",
        border: "1px solid #27D9A0",
        color: "#EAF3F2",
        padding: "10px 18px",
        borderRadius: 12,
        fontSize: 13.5,
        fontWeight: 500,
        zIndex: 200,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {text}
    </div>
  );
}

/* ----------------------------- AUTH ----------------------------- */

function AuthScreen({ mode, setMode, onLogin, onRegister }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      let res;
      if (mode === "login") {
        res = await onLogin({ identifier, password });
      } else {
        res = await onRegister({ username, fullName, email, password });
      }
      if (res?.error) setError(res.error);
    } catch (err) {
      setError("Une erreur inattendue est survenue. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!busy) submit();
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.5,
        background: "radial-gradient(circle at 20% 20%, rgba(39,217,160,0.12), transparent 45%), radial-gradient(circle at 80% 75%, rgba(62,139,255,0.14), transparent 45%)",
      }} />
      <div className="fade-in" style={{ position: "relative", width: "100%", maxWidth: 380, background: "#101E36", border: "1px solid #1E3354", borderRadius: 18, padding: "34px 30px", display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Logo size={30} />
          <span style={{ fontSize: 13, color: "#7E93B5", textAlign: "center" }}>
            {mode === "login" ? "Connecte-toi pour voir les publications de tes amis." : "Crée ton compte pour rejoindre la communauté."}
          </span>
        </div>

        <div onKeyDown={onEnter} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <>
              <Field label="Nom complet">
                <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aya N'Diaye" autoComplete="name" />
              </Field>
              <Field label="Nom d'utilisateur">
                <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="aya.codes" autoComplete="username" />
              </Field>
              <Field label="E-mail">
                <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aya@exemple.com" autoComplete="email" />
              </Field>
            </>
          )}
          {mode === "login" && (
            <Field label="Nom d'utilisateur ou e-mail">
              <input style={inputStyle} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="aya.codes" autoComplete="username" />
            </Field>
          )}
          <Field label="Mot de passe">
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inputStyle, paddingRight: 38 }}
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button type="button" onClick={() => setShowPwd((s) => !s)} style={{ position: "absolute", right: 8, top: 0, bottom: 0, background: "none", border: "none", color: "#7E93B5", cursor: "pointer", display: "flex", alignItems: "center" }}>
                {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>

          {error && <div style={{ color: "#FF7A6B", fontSize: 13, background: "rgba(255,122,107,0.1)", border: "1px solid rgba(255,122,107,0.35)", borderRadius: 8, padding: "8px 10px" }}>{error}</div>}

          <PrimaryButton onClick={submit} disabled={busy} style={{ marginTop: 6, padding: "12px 16px" }}>
            {busy ? "Veuillez patienter…" : mode === "login" ? "Se connecter" : "S'inscrire"}
          </PrimaryButton>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#5C7295", fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: "#1E3354" }} />
          ou
          <div style={{ flex: 1, height: 1, background: "#1E3354" }} />
        </div>

        <div style={{ textAlign: "center", fontSize: 13.5, color: "#7E93B5" }}>
          {mode === "login" ? "Pas encore de compte ?" : "Déjà inscrit(e) ?"}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: "#27D9A0", fontWeight: 600, cursor: "pointer", fontSize: 13.5 }}
          >
            {mode === "login" ? "Inscris-toi" : "Connecte-toi"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- NAVIGATION --------------------------- */

const NAV_ITEMS = [
  { key: "feed", label: "Accueil", icon: Home },
  { key: "explore", label: "Explorer", icon: Compass },
  { key: "create", label: "Créer", icon: PlusSquare },
  { key: "profile", label: "Profil", icon: User },
  { key: "settings", label: "Paramètres", icon: Settings },
];

function Sidebar({ view, setView, onCreate, onSearch, onLogout, currentUser, goProfile }) {
  return (
    <aside
      style={{
        width: 250,
        borderRight: "1px solid #1E3354",
        padding: "22px 14px",
        display: "none",
        flexDirection: "column",
        gap: 4,
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
      className="bz-sidebar"
    >
      <div style={{ padding: "8px 10px 22px" }}><Logo size={26} /></div>
      <SideLink icon={Home} label="Accueil" active={view === "feed"} onClick={() => setView("feed")} />
      <SideLink icon={Search} label="Recherche" active={false} onClick={onSearch} />
      <SideLink icon={Compass} label="Explorer" active={view === "explore"} onClick={() => setView("explore")} />
      <SideLink icon={PlusSquare} label="Créer" active={false} onClick={onCreate} />
      <SideLink icon={User} label="Profil" active={view === "profile"} onClick={goProfile} customIcon={<Avatar name={currentUser.fullName} src={currentUser.avatar} size={22} />} />
      <SideLink icon={Settings} label="Paramètres" active={view === "settings"} onClick={() => setView("settings")} />
      <div style={{ flex: 1 }} />
      <SideLink icon={LogOut} label="Déconnexion" active={false} onClick={onLogout} />
      <style>{`@media (min-width: 880px) { .bz-sidebar { display: flex !important; } }`}</style>
    </aside>
  );
}

function SideLink({ icon: Icon, label, active, onClick, customIcon }) {
  return (
    <button
      onClick={onClick}
      className="hoverable"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "11px 12px",
        borderRadius: 10,
        background: active ? "#16294A" : "transparent",
        border: "none",
        cursor: "pointer",
        color: active ? "#27D9A0" : "#EAF3F2",
        fontSize: 15,
        fontWeight: active ? 700 : 500,
        textAlign: "left",
        width: "100%",
      }}
    >
      {customIcon ? customIcon : <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />}
      {label}
    </button>
  );
}

function TopBar({ currentUser, onCreate, onSearch, goProfile }) {
  return (
    <div
      className="bz-topbar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 0",
        position: "sticky",
        top: 0,
        background: "#0A1424",
        zIndex: 30,
      }}
    >
      <Logo size={24} />
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <button onClick={onSearch} style={iconBtnStyle}><Search size={23} /></button>
        <button onClick={onCreate} style={iconBtnStyle}><PlusSquare size={23} /></button>
        <button onClick={goProfile} style={{ ...iconBtnStyle, padding: 0 }}><Avatar name={currentUser.fullName} src={currentUser.avatar} size={28} /></button>
      </div>
      <style>{`@media (min-width: 880px) { .bz-topbar { display: none !important; } }`}</style>
    </div>
  );
}

const iconBtnStyle = { background: "none", border: "none", color: "#EAF3F2", cursor: "pointer", display: "flex", alignItems: "center" };

function MobileNav({ view, setView, onCreate }) {
  return (
    <nav
      className="bz-mobilenav"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#0A1424",
        borderTop: "1px solid #1E3354",
        display: "flex",
        justifyContent: "space-around",
        padding: "10px 6px",
        zIndex: 40,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = view === item.key;
        return (
          <button
            key={item.key}
            onClick={() => (item.key === "create" ? onCreate() : setView(item.key))}
            style={{ background: "none", border: "none", color: isActive ? "#27D9A0" : "#7E93B5", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", fontSize: 10.5 }}
          >
            <Icon size={23} strokeWidth={isActive ? 2.4 : 1.9} />
          </button>
        );
      })}
      <style>{`@media (min-width: 880px) { .bz-mobilenav { display: none !important; } }`}</style>
    </nav>
  );
}

/* ----------------------------- FEED ----------------------------- */

function FeedView({ users, posts, currentUser, onLike, onComment, onOpenProfile, onFollow, onSave, onDeletePost, onBlock, flash }) {
  const isBlockedPair = useCallback(
    (otherId) => currentUser.blocked.includes(otherId) || (users.find((u) => u.id === otherId)?.blocked || []).includes(currentUser.id),
    [users, currentUser]
  );
  const visiblePosts = useMemo(() => posts.filter((p) => !isBlockedPair(p.userId)), [posts, isBlockedPair]);
  const sorted = useMemo(() => [...visiblePosts].sort((a, b) => b.createdAt - a.createdAt), [visiblePosts]);
  const peopleForStories = useMemo(() => {
    const ids = new Set(visiblePosts.map((p) => p.userId));
    return users.filter((u) => ids.has(u.id));
  }, [users, visiblePosts]);
  const suggestions = useMemo(
    () => users.filter((u) => u.id !== currentUser.id && !currentUser.following.includes(u.id) && !isBlockedPair(u.id)).slice(0, 5),
    [users, currentUser, isBlockedPair]
  );

  return (
    <div style={{ display: "flex", gap: 36 }}>
      <div style={{ flex: 1, maxWidth: 470, margin: "0 auto" }}>
        <StoriesBar people={peopleForStories} onOpen={onOpenProfile} />
        {sorted.length === 0 ? (
          <EmptyState
            title="Ton fil est vide"
            subtitle="Suis des comptes ou publie ta première photo pour voir du contenu ici."
          />
        ) : (
          sorted.map((post) => {
            const author = users.find((u) => u.id === post.userId);
            if (!author) return null;
            return (
              <PostCard
                key={post.id}
                post={post}
                author={author}
                currentUser={currentUser}
                onLike={() => onLike(post.id)}
                onComment={(text) => onComment(post.id, text)}
                onOpenProfile={() => onOpenProfile(author.id)}
                onSave={() => onSave(post.id)}
                onDelete={() => onDeletePost(post.id)}
                onFollow={() => onFollow(author.id)}
                onBlock={() => onBlock(author.id)}
                flash={flash}
              />
            );
          })
        )}
      </div>
      <RightRail currentUser={currentUser} suggestions={suggestions} onFollow={onFollow} onOpenProfile={onOpenProfile} />
    </div>
  );
}

function StoriesBar({ people, onOpen }) {
  if (people.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "4px 0 18px", borderBottom: "1px solid #1E3354", marginBottom: 18 }}>
      {people.map((p) => (
        <button key={p.id} onClick={() => onOpen(p.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <Avatar name={p.fullName} src={p.avatar} size={56} ring />
          <span style={{ fontSize: 11.5, color: "#7E93B5", maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.username}</span>
        </button>
      ))}
    </div>
  );
}

function PostCard({ post, author, currentUser, onLike, onComment, onOpenProfile, onSave, onDelete, onFollow, onBlock, flash }) {
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const liked = post.likes.includes(currentUser.id);
  const saved = currentUser.saved.includes(post.id);
  const isOwn = author.id === currentUser.id;
  const isFollowing = currentUser.following.includes(author.id);
  const visibleComments = showAllComments ? post.comments : post.comments.slice(-2);

  return (
    <div className="fade-in" style={{ background: "#101E36", border: "1px solid #1E3354", borderRadius: 14, marginBottom: 22, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <button onClick={onOpenProfile} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <Avatar name={author.fullName} src={author.avatar} size={34} />
        </button>
        <button onClick={onOpenProfile} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{author.username}</div>
        </button>
        <span style={{ color: "#5C7295", fontSize: 12 }}>· {timeAgo(post.createdAt)}</span>
        <div style={{ flex: 1 }} />
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowMenu((s) => !s)} style={{ background: "none", border: "none", color: "#7E93B5", cursor: "pointer", display: "flex" }}>
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <PostMenu
              isOwn={isOwn}
              isFollowing={isFollowing}
              authorUsername={author.username}
              onClose={() => setShowMenu(false)}
              onDelete={() => { onDelete(); setShowMenu(false); }}
              onFollow={() => { onFollow(); setShowMenu(false); }}
              onBlock={() => { onBlock(); setShowMenu(false); }}
              onReport={() => { flash("Merci, ton signalement a été envoyé."); setShowMenu(false); }}
            />
          )}
        </div>
      </div>

      <img src={post.image} alt="" style={{ width: "100%", display: "block", aspectRatio: "1/1", objectFit: "cover", background: "#0E1B30" }} />

      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10 }}>
          <button onClick={onLike} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <Heart size={24} color={liked ? "#FF7A6B" : "#EAF3F2"} fill={liked ? "#FF7A6B" : "none"} strokeWidth={1.8} />
          </button>
          <MessageCircle size={24} strokeWidth={1.8} />
          <Send size={22} strokeWidth={1.8} />
          <div style={{ flex: 1 }} />
          <button onClick={onSave} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <Bookmark size={22} strokeWidth={1.8} color={saved ? "#27D9A0" : "#EAF3F2"} fill={saved ? "#27D9A0" : "none"} />
          </button>
        </div>

        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#27D9A0", fontSize: 13.5, marginBottom: 6 }}>
          {post.likes.length} j'aime{post.likes.length === 1 ? "" : "s"}
        </div>

        {post.caption && (
          <div style={{ fontSize: 13.5, lineHeight: 1.45, marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>{author.username}</span> {post.caption}
          </div>
        )}

        {post.comments.length > 2 && !showAllComments && (
          <button onClick={() => setShowAllComments(true)} style={{ background: "none", border: "none", color: "#7E93B5", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 6 }}>
            Voir les {post.comments.length} commentaires
          </button>
        )}
        {visibleComments.map((c) => (
          <div key={c.id} style={{ fontSize: 13.5, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{c.userId === currentUser.id ? currentUser.username : "@" + c.userId.replace("u_", "")}</span> {c.text}
          </div>
        ))}

        <div
          style={{ display: "flex", gap: 8, marginTop: 10, borderTop: "1px solid #1E3354", paddingTop: 10 }}
        >
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && commentText.trim()) {
                e.preventDefault();
                onComment(commentText);
                setCommentText("");
              }
            }}
            placeholder="Ajouter un commentaire…"
            style={{ flex: 1, background: "none", border: "none", color: "#EAF3F2", fontSize: 13.5, outline: "none" }}
          />
          {commentText.trim() && (
            <button
              type="button"
              onClick={() => { onComment(commentText); setCommentText(""); }}
              style={{ background: "none", border: "none", color: "#27D9A0", fontWeight: 700, cursor: "pointer", fontSize: 13.5 }}
            >
              Publier
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PostMenu({ isOwn, isFollowing, authorUsername, onClose, onDelete, onFollow, onBlock, onReport }) {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={onClose} />
      <div
        className="fade-in"
        style={{
          position: "absolute", right: 0, top: 26, zIndex: 50, background: "#16294A", border: "1px solid #1E3354",
          borderRadius: 10, minWidth: 200, overflow: "hidden", boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
        }}
      >
        {isOwn ? (
          <MenuItem icon={Trash2} label="Supprimer la publication" danger onClick={onDelete} />
        ) : (
          <>
            <MenuItem icon={UserX} label={isFollowing ? "Ne plus suivre" : "Suivre"} onClick={onFollow} />
            <MenuItem icon={Flag} label="Signaler" onClick={onReport} />
            <MenuItem icon={UserX} label={"Bloquer @" + authorUsername} danger onClick={onBlock} />
          </>
        )}
      </div>
    </>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className="hoverable"
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px",
        background: "none", border: "none", cursor: "pointer", textAlign: "left",
        color: danger ? "#FF7A6B" : "#EAF3F2", fontSize: 13.5, fontWeight: 500,
      }}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

function RightRail({ currentUser, suggestions, onFollow, onOpenProfile }) {
  return (
    <div className="bz-rightrail" style={{ width: 280, display: "none", flexDirection: "column", gap: 22, paddingTop: 8 }}>
      <button onClick={() => onOpenProfile(currentUser.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={currentUser.fullName} src={currentUser.avatar} size={48} />
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{currentUser.username}</div>
          <div style={{ color: "#7E93B5", fontSize: 13 }}>{currentUser.fullName}</div>
        </div>
      </button>

      {suggestions.length > 0 && (
        <div>
          <div style={{ color: "#7E93B5", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Suggestions pour toi</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {suggestions.map((u) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => onOpenProfile(u.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                  <Avatar name={u.fullName} src={u.avatar} size={36} />
                </button>
                <button onClick={() => onOpenProfile(u.id)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username}</div>
                  <div style={{ color: "#7E93B5", fontSize: 12 }}>Suggéré pour toi</div>
                </button>
                <GhostButton onClick={() => onFollow(u.id)} active>Suivre</GhostButton>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ color: "#5C7295", fontSize: 11.5, lineHeight: 1.6 }}>
        bandzaii — un projet de démonstration.<br />Les données sont partagées entre toutes les personnes qui ouvrent cette app.
      </div>
      <style>{`@media (min-width: 1080px) { .bz-rightrail { display: flex !important; } }`}</style>
    </div>
  );
}

function EmptyState({ title, subtitle, icon: Icon = Sparkles }) {
  return (
    <div style={{ textAlign: "center", padding: "70px 20px", border: "1px dashed #1E3354", borderRadius: 14 }}>
      <Icon size={30} color="#27D9A0" style={{ marginBottom: 12 }} />
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "#7E93B5", fontSize: 13.5, maxWidth: 320, margin: "0 auto" }}>{subtitle}</div>
    </div>
  );
}

/* ---------------------------- EXPLORE ---------------------------- */

function ExploreView({ posts, users, currentUser, onOpenProfile }) {
  const visible = useMemo(
    () => posts.filter((p) => {
      if (currentUser.blocked.includes(p.userId)) return false;
      const author = users.find((u) => u.id === p.userId);
      if (author && (author.blocked || []).includes(currentUser.id)) return false;
      return true;
    }),
    [posts, users, currentUser]
  );
  const sorted = useMemo(() => [...visible].sort((a, b) => b.likes.length - a.likes.length || b.createdAt - a.createdAt), [visible]);
  if (sorted.length === 0) return <EmptyState title="Rien à explorer pour l'instant" subtitle="Les publications les plus populaires apparaîtront ici." icon={Compass} />;
  return (
    <div>
      <h2 style={{ fontFamily: "Outfit, sans-serif", fontSize: 19, margin: "18px 0" }}>Explorer</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {sorted.map((p) => {
          const author = users.find((u) => u.id === p.userId);
          return (
            <button key={p.id} onClick={() => author && onOpenProfile(author.id)} style={{ position: "relative", border: "none", padding: 0, cursor: "pointer", aspectRatio: "1/1", overflow: "hidden", borderRadius: 6 }}>
              <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", bottom: 6, left: 6, display: "flex", alignItems: "center", gap: 4, background: "rgba(10,20,36,0.65)", borderRadius: 6, padding: "2px 6px" }}>
                <Heart size={12} color="#FF7A6B" fill="#FF7A6B" />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#EAF3F2" }}>{p.likes.length}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- PROFILE ---------------------------- */

function ProfileView({ user, allPosts, users, currentUser, onFollow, onUpdateProfile, onBlock, onRemoveFollower, onDeletePost, isOwn, flash }) {
  const [editing, setEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [listModal, setListModal] = useState(null); // 'followers' | 'following' | null
  const [tab, setTab] = useState("posts"); // posts | saved

  const isFollowing = currentUser.following.includes(user.id);
  const iBlockedThem = currentUser.blocked.includes(user.id);
  const theyBlockedMe = (user.blocked || []).includes(currentUser.id);

  const ownPosts = useMemo(() => allPosts.filter((p) => p.userId === user.id), [allPosts, user.id]);
  const savedPosts = useMemo(() => allPosts.filter((p) => currentUser.saved.includes(p.id)), [allPosts, currentUser.saved]);
  const sorted = useMemo(
    () => [...(tab === "saved" ? savedPosts : ownPosts)].sort((a, b) => b.createdAt - a.createdAt),
    [tab, ownPosts, savedPosts]
  );

  const followerUsers = useMemo(() => user.followers.map((id) => users.find((u) => u.id === id)).filter(Boolean), [user.followers, users]);
  const followingUsers = useMemo(() => user.following.map((id) => users.find((u) => u.id === id)).filter(Boolean), [user.following, users]);

  if (theyBlockedMe) {
    return <EmptyState title="Profil indisponible" subtitle="Ce compte n'est pas accessible." icon={UserX} />;
  }

  if (iBlockedThem) {
    return (
      <div style={{ paddingTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
          <Avatar name={user.fullName} src={user.avatar} size={64} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{user.username}</div>
            <div style={{ color: "#7E93B5", fontSize: 13 }}>{user.fullName}</div>
          </div>
        </div>
        <EmptyState
          title="Compte bloqué"
          subtitle="Tu ne vois plus les publications de ce compte. Débloque-le pour retrouver son profil."
          icon={UserX}
        />
        <GhostButton onClick={() => onBlock(user.id)} style={{ marginTop: 16 }}>Débloquer @{user.username}</GhostButton>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 10 }}>
      <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap", marginBottom: 22 }}>
        <Avatar name={user.fullName} src={user.avatar} size={88} ring />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: 19 }}>{user.username}</span>
            {isOwn ? (
              <GhostButton onClick={() => setEditing(true)}>Modifier le profil</GhostButton>
            ) : (
              <>
                <GhostButton active={!isFollowing} onClick={() => onFollow(user.id)}>
                  {isFollowing ? "Abonné(e)" : "Suivre"}
                </GhostButton>
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowMenu((s) => !s)} style={{ background: "#16294A", border: "1px solid #1E3354", borderRadius: 9, padding: "7px 9px", cursor: "pointer", color: "#EAF3F2", display: "flex" }}>
                    <MoreHorizontal size={16} />
                  </button>
                  {showMenu && (
                    <PostMenu
                      isOwn={false}
                      isFollowing={isFollowing}
                      authorUsername={user.username}
                      onClose={() => setShowMenu(false)}
                      onFollow={() => { onFollow(user.id); setShowMenu(false); }}
                      onBlock={() => { onBlock(user.id); setShowMenu(false); }}
                      onReport={() => { flash("Merci, ton signalement a été envoyé."); setShowMenu(false); }}
                    />
                  )}
                </div>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 28, marginBottom: 10 }}>
            <Stat value={ownPosts.length} label="publications" />
            <button onClick={() => setListModal("followers")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <Stat value={user.followers.length} label="abonnés" />
            </button>
            <button onClick={() => setListModal("following")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <Stat value={user.following.length} label="suivi(e)s" />
            </button>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user.fullName}</div>
          {user.bio && <div style={{ color: "#B9C7DE", fontSize: 13.5, marginTop: 2, whiteSpace: "pre-wrap" }}>{user.bio}</div>}
        </div>
      </div>

      <div style={{ display: "flex", borderTop: "1px solid #1E3354" }}>
        <ProfileTab icon={Grid3x3} label="Publications" active={tab === "posts"} onClick={() => setTab("posts")} />
        {isOwn && <ProfileTab icon={Bookmark} label="Enregistré" active={tab === "saved"} onClick={() => setTab("saved")} />}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title={tab === "saved" ? "Aucune publication enregistrée" : isOwn ? "Aucune publication encore" : "Aucune publication"}
          subtitle={
            tab === "saved"
              ? "Touche le marque-page sur une publication pour la retrouver ici."
              : isOwn ? "Partage ta première photo pour qu'elle apparaisse ici." : "Ce compte n'a encore rien publié."
          }
          icon={tab === "saved" ? Bookmark : ImageIcon}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
          {sorted.map((p) => (
            <div key={p.id} style={{ position: "relative", aspectRatio: "1/1", overflow: "hidden", borderRadius: 6, group: true }}>
              <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {isOwn && tab === "posts" && (
                <button
                  onClick={() => { if (window.confirm("Supprimer cette publication ?")) onDeletePost(p.id); }}
                  style={{ position: "absolute", top: 5, right: 5, background: "rgba(10,20,36,0.75)", border: "none", borderRadius: 7, padding: 5, color: "#FF7A6B", cursor: "pointer", display: "flex" }}
                  title="Supprimer"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditProfileModal
          user={user}
          onClose={() => setEditing(false)}
          onSave={async (fields) => { await onUpdateProfile(fields); setEditing(false); }}
        />
      )}

      {listModal && (
        <ListModal
          title={listModal === "followers" ? "Abonnés" : "Abonnements"}
          list={listModal === "followers" ? followerUsers : followingUsers}
          currentUser={currentUser}
          isOwn={isOwn}
          mode={listModal}
          onClose={() => setListModal(null)}
          onOpenProfile={() => {}}
          onFollow={onFollow}
          onRemoveFollower={onRemoveFollower}
        />
      )}
    </div>
  );
}

function ProfileTab({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "12px 0", background: "none", border: "none", cursor: "pointer",
        color: active ? "#27D9A0" : "#7E93B5", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.03em",
        borderTop: active ? "2px solid #27D9A0" : "2px solid transparent", marginTop: -1,
      }}
    >
      <Icon size={14} /> {label.toUpperCase()}
    </button>
  );
}

function EditProfileModal({ user, onClose, onSave }) {
  const [fullName, setFullName] = useState(user.fullName);
  const [bio, setBio] = useState(user.bio || "");
  const [avatar, setAvatar] = useState(user.avatar);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await resizeImageFile(file, 280, 0.82);
      setAvatar(data);
    } catch (err) { /* ignore */ }
  };

  return (
    <ModalShell onClose={onClose} title="Modifier le profil">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Avatar name={fullName} src={avatar} size={76} ring />
        <button onClick={() => fileRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#27D9A0", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
          <Camera size={15} /> Changer la photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickAvatar} style={{ display: "none" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Nom complet">
          <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Bio">
          <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={bio} onChange={(e) => setBio(e.target.value.slice(0, 150))} placeholder="Parle un peu de toi…" />
        </Field>
        <span style={{ color: "#5C7295", fontSize: 11.5, textAlign: "right" }}>{bio.length}/150</span>
        <PrimaryButton
          disabled={busy}
          onClick={async () => { setBusy(true); await onSave({ fullName: fullName.trim() || user.fullName, bio, avatar }); setBusy(false); }}
        >
          Enregistrer
        </PrimaryButton>
      </div>
    </ModalShell>
  );
}

function ListModal({ title, list, currentUser, isOwn, mode, onClose, onFollow, onRemoveFollower }) {
  return (
    <ModalShell title={title} onClose={onClose}>
      {list.length === 0 ? (
        <div style={{ color: "#7E93B5", fontSize: 13.5, padding: "10px 0" }}>
          {mode === "followers" ? "Aucun abonné pour l'instant." : "Aucun abonnement pour l'instant."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
          {list.map((u) => {
            const isMe = u.id === currentUser.id;
            const iFollowThem = currentUser.following.includes(u.id);
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 4px" }}>
                <Avatar name={u.fullName} src={u.avatar} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username}</div>
                  <div style={{ color: "#7E93B5", fontSize: 12 }}>{u.fullName}</div>
                </div>
                {!isMe && (
                  <>
                    {mode === "following" && isOwn && (
                      <GhostButton active={!iFollowThem} onClick={() => onFollow(u.id)}>
                        {iFollowThem ? "Abonné(e)" : "Suivre"}
                      </GhostButton>
                    )}
                    {mode === "followers" && isOwn && (
                      <GhostButton onClick={() => onRemoveFollower(u.id)}>Retirer</GhostButton>
                    )}
                    {mode === "followers" && !isOwn && (
                      <GhostButton active={!iFollowThem} onClick={() => onFollow(u.id)}>
                        {iFollowThem ? "Abonné(e)" : "Suivre"}
                      </GhostButton>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

/* ---------------------------- SETTINGS ---------------------------- */

function SettingsView({ currentUser, onUpdateProfile, onChangePassword, onUpdateAccountInfo, onLogout, onUnblock, onDeleteAccount, onDownloadData, users, flash }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const [accUsername, setAccUsername] = useState(currentUser.username);
  const [accEmail, setAccEmail] = useState(currentUser.email);
  const [accError, setAccError] = useState("");
  const [accBusy, setAccBusy] = useState(false);

  const [showDelete, setShowDelete] = useState(false);

  const submitPwd = async () => {
    setPwdError("");
    setPwdBusy(true);
    try {
      const res = await onChangePassword(oldPwd, newPwd);
      if (res?.error) setPwdError(res.error);
      else { setOldPwd(""); setNewPwd(""); flash("Mot de passe mis à jour."); }
    } catch (err) {
      setPwdError("Une erreur inattendue est survenue. Réessaie.");
    } finally {
      setPwdBusy(false);
    }
  };

  const submitAccount = async () => {
    setAccError("");
    setAccBusy(true);
    try {
      const res = await onUpdateAccountInfo({ username: accUsername, email: accEmail });
      if (res?.error) setAccError(res.error);
      else flash("Informations du compte mises à jour.");
    } catch (err) {
      setAccError("Une erreur inattendue est survenue. Réessaie.");
    } finally {
      setAccBusy(false);
    }
  };

  const blockedUsers = useMemo(
    () => currentUser.blocked.map((id) => users.find((u) => u.id === id)).filter(Boolean),
    [currentUser.blocked, users]
  );

  const accountUnchanged = accUsername.trim().toLowerCase() === currentUser.username && accEmail.trim() === currentUser.email;

  return (
    <div style={{ paddingTop: 10, maxWidth: 560 }}>
      <h2 style={{ fontFamily: "Outfit, sans-serif", fontSize: 20, marginBottom: 22 }}>Paramètres</h2>

      <SettingsSection title="Compte" icon={User}>
        <div
          onKeyDown={(e) => { if (e.key === "Enter" && !accountUnchanged && !accBusy) { e.preventDefault(); submitAccount(); } }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <Field label="Nom d'utilisateur">
            <input style={inputStyle} value={accUsername} onChange={(e) => setAccUsername(e.target.value)} />
          </Field>
          <Field label="E-mail">
            <input style={inputStyle} type="email" value={accEmail} onChange={(e) => setAccEmail(e.target.value)} />
          </Field>
          {accError && <div style={{ color: "#FF7A6B", fontSize: 13 }}>{accError}</div>}
          <PrimaryButton onClick={submitAccount} disabled={accBusy || accountUnchanged} style={{ alignSelf: "flex-start" }}>
            Enregistrer les modifications
          </PrimaryButton>
        </div>
      </SettingsSection>

      <SettingsSection title="Confidentialité" icon={ShieldCheck}>
        <ToggleRow
          label="Compte privé"
          desc="Seuls les abonnés approuvés voient tes publications."
          checked={currentUser.private}
          onChange={(v) => onUpdateProfile({ private: v })}
        />
        <ToggleRow
          label="Statut d'activité"
          desc="Permettre aux autres de voir quand tu es en ligne."
          checked={currentUser.showActivityStatus}
          onChange={(v) => onUpdateProfile({ showActivityStatus: v })}
        />
        <div style={{ padding: "12px 0 4px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Qui peut commenter tes publications</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { v: "everyone", label: "Tout le monde" },
              { v: "following", label: "Personnes suivies" },
              { v: "none", label: "Personne" },
            ].map((opt) => (
              <GhostButton key={opt.v} active={currentUser.commentPermission === opt.v} onClick={() => onUpdateProfile({ commentPermission: opt.v })}>
                {opt.label}
              </GhostButton>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Sécurité" icon={Lock}>
        <div
          onKeyDown={(e) => { if (e.key === "Enter" && oldPwd && newPwd && !pwdBusy) { e.preventDefault(); submitPwd(); } }}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <Field label="Mot de passe actuel">
            <input style={inputStyle} type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
          </Field>
          <Field label="Nouveau mot de passe">
            <input style={inputStyle} type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </Field>
          {pwdError && <div style={{ color: "#FF7A6B", fontSize: 13 }}>{pwdError}</div>}
          <PrimaryButton onClick={submitPwd} disabled={pwdBusy || !oldPwd || !newPwd} style={{ alignSelf: "flex-start" }}>
            Mettre à jour le mot de passe
          </PrimaryButton>
        </div>
      </SettingsSection>

      <SettingsSection title="Notifications" icon={Bell}>
        <ToggleRow
          label="J'aime"
          desc="Être notifié(e) quand quelqu'un aime ta publication."
          checked={currentUser.notifPrefs.likes}
          onChange={(v) => onUpdateProfile({ notifPrefs: { ...currentUser.notifPrefs, likes: v } })}
        />
        <ToggleRow
          label="Commentaires"
          desc="Être notifié(e) des nouveaux commentaires."
          checked={currentUser.notifPrefs.comments}
          onChange={(v) => onUpdateProfile({ notifPrefs: { ...currentUser.notifPrefs, comments: v } })}
        />
        <ToggleRow
          label="Nouveaux abonnés"
          desc="Être notifié(e) quand quelqu'un commence à te suivre."
          checked={currentUser.notifPrefs.newFollowers}
          onChange={(v) => onUpdateProfile({ notifPrefs: { ...currentUser.notifPrefs, newFollowers: v } })}
        />
        <ToggleRow
          label="Messages"
          desc="Être notifié(e) des nouveaux messages."
          checked={currentUser.notifPrefs.messages}
          onChange={(v) => onUpdateProfile({ notifPrefs: { ...currentUser.notifPrefs, messages: v } })}
        />
      </SettingsSection>

      <SettingsSection title="Comptes bloqués" icon={UserX}>
        {blockedUsers.length === 0 ? (
          <div style={{ color: "#7E93B5", fontSize: 13.5 }}>Aucun compte bloqué.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {blockedUsers.map((u) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={u.fullName} src={u.avatar} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.username}</div>
                </div>
                <GhostButton onClick={() => onUnblock(u.id)}>Débloquer</GhostButton>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Tes données" icon={Download}>
        <div style={{ color: "#7E93B5", fontSize: 13.5, marginBottom: 12 }}>
          Télécharge une copie de ton profil et de tes publications au format JSON.
        </div>
        <GhostButton onClick={onDownloadData}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Download size={14} /> Télécharger mes données</span>
        </GhostButton>
      </SettingsSection>

      <SettingsSection title="À propos" icon={HelpCircle}>
        <div style={{ color: "#7E93B5", fontSize: 13.5, lineHeight: 1.6 }}>
          bandzaii v1.0 — réseau social de démonstration inspiré d'Instagram. Les comptes, publications et likes sont stockés et partagés entre tous les visiteurs de cette application.
        </div>
      </SettingsSection>

      <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "1px solid #1E3354", color: "#FF7A6B", borderRadius: 10, padding: "12px 16px", cursor: "pointer", fontWeight: 600, fontSize: 14, width: "100%", marginTop: 8, marginBottom: 14 }}>
        <LogOut size={17} /> Se déconnecter
      </button>

      <SettingsSection title="Zone dangereuse" icon={AlertTriangle}>
        <div style={{ color: "#7E93B5", fontSize: 13.5, marginBottom: 12 }}>
          Supprimer ton compte effacera définitivement ton profil et tes publications. Cette action est irréversible.
        </div>
        <button
          onClick={() => setShowDelete(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,122,107,0.1)", border: "1px solid rgba(255,122,107,0.4)", color: "#FF7A6B", borderRadius: 10, padding: "10px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}
        >
          <Trash2 size={15} /> Supprimer mon compte
        </button>
      </SettingsSection>

      {showDelete && (
        <DeleteAccountModal
          username={currentUser.username}
          onClose={() => setShowDelete(false)}
          onConfirm={onDeleteAccount}
        />
      )}

      <div style={{ height: 30 }} />
    </div>
  );
}

function DeleteAccountModal({ username, onClose, onConfirm }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await onConfirm(value);
      if (res?.error) setError(res.error);
    } catch (err) {
      setError("Une erreur inattendue est survenue. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Supprimer le compte" onClose={onClose}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(255,122,107,0.1)", border: "1px solid rgba(255,122,107,0.35)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <AlertTriangle size={18} color="#FF7A6B" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 13, color: "#EAF3F2", lineHeight: 1.5 }}>
          Cette action est définitive. Ton profil, tes publications et tes commentaires seront supprimés.
        </span>
      </div>
      <Field label={<>Tape <strong>{username}</strong> pour confirmer</>}>
        <input
          style={inputStyle}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && value.trim() && !busy) { e.preventDefault(); submit(); } }}
          placeholder={username}
          autoFocus
        />
      </Field>
      {error && <div style={{ color: "#FF7A6B", fontSize: 13, marginTop: 8 }}>{error}</div>}
      <PrimaryButton
        onClick={submit}
        disabled={busy || value.trim().toLowerCase() !== username}
        style={{ width: "100%", marginTop: 14, background: value.trim().toLowerCase() === username ? "#FF7A6B" : undefined, color: "#1A0B08" }}
      >
        Supprimer définitivement mon compte
      </PrimaryButton>
    </ModalShell>
  );
}

function SettingsSection({ title, icon: Icon, children }) {
  return (
    <div style={{ background: "#101E36", border: "1px solid #1E3354", borderRadius: 14, padding: 18, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#27D9A0", fontWeight: 700, fontSize: 13.5, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        <Icon size={15} /> {title}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1E3354", gap: 14 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: "#7E93B5", marginTop: 2 }}>{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
          background: checked ? "linear-gradient(120deg,#27D9A0,#3E8BFF)" : "#1E3354", position: "relative", transition: "background .15s",
        }}
      >
        <span style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
      </button>
    </div>
  );
}

/* ---------------------------- MODALS ---------------------------- */

function ModalShell({ title, onClose, children, width = 420 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(5,10,18,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }} onClick={onClose}>
      <div className="fade-in" onClick={(e) => e.stopPropagation()} style={{ background: "#101E36", border: "1px solid #1E3354", borderRadius: 16, width: "100%", maxWidth: width, maxHeight: "88vh", overflowY: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontFamily: "Outfit, sans-serif", fontWeight: 700, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#7E93B5", cursor: "pointer", display: "flex" }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreatePostModal({ onClose, onSubmit }) {
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await resizeImageFile(file, 900, 0.8);
      setImage(data);
    } catch (err) { /* ignore */ }
  };

  return (
    <ModalShell title="Créer une publication" onClose={onClose} width={460}>
      {!image ? (
        <button
          onClick={() => fileRef.current?.click()}
          style={{ width: "100%", aspectRatio: "1/1", border: "2px dashed #1E3354", borderRadius: 14, background: "#0E1B30", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", color: "#7E93B5" }}
        >
          <ImageIcon size={34} color="#27D9A0" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Choisir une photo</span>
          <span style={{ fontSize: 12 }}>JPG ou PNG</span>
        </button>
      ) : (
        <div style={{ position: "relative", marginBottom: 14 }}>
          <img src={image} alt="" style={{ width: "100%", borderRadius: 12, display: "block", aspectRatio: "1/1", objectFit: "cover" }} />
          <button onClick={() => setImage(null)} style={{ position: "absolute", top: 8, right: 8, background: "rgba(10,20,36,0.75)", border: "none", borderRadius: 999, padding: 6, color: "#fff", cursor: "pointer", display: "flex" }}>
            <X size={15} />
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Écris une légende…"
        style={{ ...inputStyle, minHeight: 70, resize: "vertical", marginTop: 14 }}
      />

      <PrimaryButton
        disabled={!image || busy}
        style={{ width: "100%", marginTop: 14 }}
        onClick={async () => { setBusy(true); await onSubmit(image, caption); setBusy(false); }}
      >
        {busy ? "Publication…" : "Partager"}
      </PrimaryButton>
    </ModalShell>
  );
}

function SearchOverlay({ users, onClose, onOpenProfile }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => u.username.includes(term) || u.fullName.toLowerCase().includes(term));
  }, [users, q]);

  return (
    <ModalShell title="Recherche" onClose={onClose}>
      <input
        autoFocus
        style={inputStyle}
        placeholder="Rechercher un compte…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 4, maxHeight: 360, overflowY: "auto" }}>
        {filtered.length === 0 && <div style={{ color: "#7E93B5", fontSize: 13.5, padding: "16px 4px" }}>Aucun résultat pour « {q} ».</div>}
        {filtered.map((u) => (
          <button key={u.id} onClick={() => onOpenProfile(u.id)} style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", padding: "8px 4px", borderRadius: 8, textAlign: "left" }} className="hoverable">
            <Avatar name={u.fullName} src={u.avatar} size={38} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.username}</div>
              <div style={{ color: "#7E93B5", fontSize: 12 }}>{u.fullName}</div>
            </div>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
