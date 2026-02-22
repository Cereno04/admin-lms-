// firebase-core.js

// 1. Import Firebase functions - UPDATED TO 10.8.1
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// NEW: Import Firestore functions - UPDATED TO 10.8.1
import { getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. YOUR CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyBhmIgCu9SwFNIN5inMimRnPJAgmvkAh9s",
    authDomain: "lms-database-c7c05.firebaseapp.com",
    projectId: "lms-database-c7c05",
    storageBucket: "lms-database-c7c05.firebasestorage.app",
    messagingSenderId: "576216221103",
    appId: "1:576216221103:web:8c13d7c0a128b310e45b5a",
    measurementId: "G-PC1GWVJ76W"
};

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Database

// --- Auth Helper Functions ---
export function handleAuthRouting() {
    onAuthStateChanged(auth, (user) => {
        const path = window.location.pathname;
        const page = path.split("/").pop();
        
        // If not logged in and not on login page, kick them out
        if (!user && page !== "index.html") {
            window.location.href = "../include/index.html";
        } 
        // If logged in and on login page, send to dashboard
        else if (user && page === "index.html") {
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
            });
        });
    }
}

// Export everything needed
export { auth, db, signInWithEmailAndPassword, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc };