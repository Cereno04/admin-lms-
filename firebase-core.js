// firebase-core.js

// 1. Import Firebase functions - VERSION 10.8.1
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// Firestore functions - VERSION 10.8.1
import { 
    getFirestore, 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc, 
    where, 
    limit, 
    getDocs,
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. YOUR CONFIGURATION (Keep exactly as is)
const firebaseConfig = {
  apiKey: "AIzaSyCjNlxF7tmC2TWdkNUv2oQheeKYQMi-PxY",
  authDomain: "lms-database-d21f6.firebaseapp.com",
  projectId: "lms-database-d21f6",
  storageBucket: "lms-database-d21f6.firebasestorage.app",
  messagingSenderId: "219532292912",
  appId: "1:219532292912:web:102aca94640d5abf6d4ef5",
  measurementId: "G-5KYP8WJ824"
};

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 

// --- Auth Helper Functions ---
export function handleAuthRouting() {
    onAuthStateChanged(auth, (user) => {
        const path = window.location.pathname;
        const page = path.split("/").pop();
        
        // If not logged in and not on login page, kick them out
        if (!user && page !== "index.html" && page !== "") {
            window.location.href = "../include/index.html";
        } 
        // If logged in and on login page, send to dashboard
        else if (user && (page === "index.html" || page === "")) {
            window.location.href = "../include/dashboard.html";
        }
    });
}

export function handleLogout() {
    const logoutBtn = document.getElementById("logout-btn");
    if(logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                alert("Logged out successfully");
                window.location.href = "../include/index.html";
            }).catch((error) => {
                console.error("Logout Error: ", error);
            });
        });
    }
}

// Export everything needed for your pages to work
export { 
    auth, 
    db, 
    signInWithEmailAndPassword, 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc, 
    where, 
    limit, 
    getDocs, 
    setDoc 
};