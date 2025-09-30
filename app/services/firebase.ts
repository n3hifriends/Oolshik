// app/services/firebase.ts
import { getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getAnalytics } from "firebase/analytics"

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDsDsS_j8TUXPfjnYfXCoNalSxmIhtabKM",
  authDomain: "oolshik.firebaseapp.com",
  projectId: "oolshik",
  storageBucket: "oolshik.firebasestorage.app",
  messagingSenderId: "263296903071",
  appId: "1:263296903071:web:f606c8a1c24ec1fcc57faa",
  measurementId: "G-ZW8BPMXD33",
}

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
export const analytics = getAnalytics(firebaseApp)
// Optional: localize OTP SMS — set 'hi' or 'en'
firebaseAuth.languageCode = "en"
