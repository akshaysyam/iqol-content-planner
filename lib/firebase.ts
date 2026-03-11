// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// REPLACE THIS with the config object Firebase just gave you
const firebaseConfig = {
  apiKey: "AIzaSyCWJBQht7zbvSFm_m5vBvy_1oiuxILnUGw",
  authDomain: "content-quality-tracker.firebaseapp.com",
  projectId: "content-quality-tracker",
  storageBucket: "content-quality-tracker.firebasestorage.app",
  messagingSenderId: "391313409574",
  appId: "1:391313409574:web:867d0ac3bacd8cf32b08e7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth and Database so we can use them in our login page
export const auth = getAuth(app);
export const db = getFirestore(app);
