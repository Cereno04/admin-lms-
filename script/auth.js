// 1. Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// --- NEW: MODAL FUNCTIONS ---
const modal = document.getElementById('customModal');
const modalIcon = document.getElementById('modalIcon');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const closeModalBtn = document.getElementById('closeModalBtn');

// Function to close modal
closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('show');
});

// Function to show modal
function showModal(title, message, isSuccess) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    
    // Reset classes
    modalIcon.className = 'fa-solid';
    
    if (isSuccess) {
        modalIcon.classList.add('fa-circle-check', 'icon-success');
    } else {
        modalIcon.classList.add('fa-circle-xmark', 'icon-error');
    }
    
    modal.classList.add('show');
}
// ----------------------------

// 4. Handle Login Logic
const loginForm = document.getElementById('loginForm');

if(loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        const btn = document.querySelector('.btn-login');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
        btn.style.opacity = '0.8';
        btn.disabled = true;

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log("Logged in as:", user.email);
                
                // --- REPLACED ALERT WITH MODAL ---
                showModal("Success!", "Login Successful. Redirecting...", true);
                
                // Small delay so user can see the success message before redirect
                setTimeout(() => {
                    window.location.href = "/include/dashboard.html"; 
                }, 1500);
            })
            .catch((error) => {
                const errorCode = error.code;
                let errorMessage = error.message;

                if (errorCode === 'auth/invalid-credential') {
                    errorMessage = "Invalid email or password.";
                } else if (errorCode === 'auth/user-not-found') {
                    errorMessage = "No admin account found with this email.";
                } else if (errorCode === 'auth/wrong-password') {
                    errorMessage = "Incorrect password.";
                } else if (errorCode === 'auth/too-many-requests') {
                    errorMessage = "Too many failed attempts. Please try again later.";
                }

                // --- REPLACED ALERT WITH MODAL ---
                showModal("Login Failed", errorMessage, false);

                btn.innerHTML = originalText;
                btn.style.opacity = '1';
                btn.disabled = false;
            });
    });
}
