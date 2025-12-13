// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBMV1kmNFERMdHI-Y34votVhrZbO4XyNig",
  authDomain: "diaconnect-family.firebaseapp.com",
  projectId: "diaconnect-family",
  storageBucket: "diaconnect-family.firebasestorage.app",
  messagingSenderId: "471021476998",
  appId: "1:471021476998:web:9255323695fe49cffb8507",
  measurementId: "G-TTFQ5MB4BG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);