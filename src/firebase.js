import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBjSt13toeabfXHUB1CYN6s4jSvWtgcVsU",
  authDomain: "bandzai-b8c41.firebaseapp.com",
  projectId: "bandzai-b8c41",
  storageBucket: "bandzai-b8c41.firebasestorage.app",
  messagingSenderId: "61390598313",
  appId: "1:61390598313:web:38bf701759989fc590b9b8",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
