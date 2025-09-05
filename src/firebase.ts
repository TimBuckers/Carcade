// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Replace the following with your app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
//   measurementId: "G-R53MG6W8HV"

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firestore
const db = getFirestore(app);

// enablePersistence(db)
//   .catch((err: any) => {
//       if (err.code == 'failed-precondition') {
//           // Multiple tabs open, persistence can only be enabled in one tab at a time.
//           console.log("Persistence failed, probably multiple tabs open.");
//       } else if (err.code == 'unimplemented') {
//           // The current browser does not support all of the features required to enable persistence
//           console.log("Persistence is not available in this browser.");
//       }
//   });

export { db };