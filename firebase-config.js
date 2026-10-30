
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBKgPKze8ewjY0Nq3x8UEt-RUBT1YTRyCU",
  authDomain: "institutoeulapaularocha-34b2c.firebaseapp.com",
  projectId: "institutoeulapaularocha-34b2c",
  storageBucket: "institutoeulapaularocha-34b2c.firebasestorage.app",
  messagingSenderId: "579839978837",
  appId: "1:579839978837:web:259b1264217140ad37d3dc"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const ADMIN_UID = "RqXete65CIc6JQ2RJbsEgCln0ys2";