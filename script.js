import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBhmIgCu9SwFNIN5inMimRnPJAgmvkAh9s",
    authDomain: "lms-database-c7c05.firebaseapp.com",
    projectId: "lms-database-c7c05",
    storageBucket: "lms-database-c7c05.firebasestorage.app",
    messagingSenderId: "576216221103",
    appId: "1:576216221103:web:8c13d7c0a128b310e45b5a",
    measurementId: "G-PC1GWVJ76W"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ======================================================
//  CUSTOM MODAL UTILITIES (ALERT & CONFIRM)
// ======================================================
function showAlert(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('alert-modal');
        document.getElementById('alert-message').innerText = message;
        modal.classList.add('active');
        const okBtn = document.getElementById('alert-ok-btn');
        const handleOk = () => {
            modal.classList.remove('active');
            okBtn.removeEventListener('click', handleOk);
            resolve();
        };
        okBtn.addEventListener('click', handleOk);
    });
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-title').innerText = title;
        document.getElementById('confirm-message').innerText = message;
        modal.classList.add('active');
        const yesBtn = document.getElementById('confirm-yes-btn');
        const noBtn = document.getElementById('confirm-cancel-btn');
        const cleanup = (result) => {
            modal.classList.remove('active');
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
            resolve(result);
        };
        const onYes = () => cleanup(true);
        const onNo = () => cleanup(false);
        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
    });
}

// ======================================================
//  RIDER MANAGEMENT LOGIC
// ======================================================
export async function initializeSchedule() {
    const tableBody = document.getElementById('rider-table-body');
    const riderForm = document.getElementById('rider-form');
    const modal = document.getElementById('riderModal');
    const openModalBtn = document.getElementById('open-rider-modal');

    // Generate Sequential ID: RDR-0001
    async function getNextRiderId() {
        const q = query(collection(db, "riders"));
        const snapshot = await getDocs(q);
        const nextNum = snapshot.size + 1;
        return "RDR-" + nextNum.toString().padStart(4, '0');
    }

    if(openModalBtn) {
        openModalBtn.onclick = async () => {
            const nextId = await getNextRiderId();
            document.getElementById('rider-id').value = nextId;
            modal.classList.add('active');
        };
    }

    if(riderForm) {
        riderForm.onsubmit = async (e) => {
            e.preventDefault();
            const confirmed = await showConfirm("Register Rider?", "Create this rider account in the system?");
            if(!confirmed) return;

            try {
                await addDoc(collection(db, "riders"), {
                    riderId: document.getElementById('rider-id').value,
                    name: document.getElementById('rider-name').value,
                    email: document.getElementById('rider-email').value,
                    phone: document.getElementById('rider-phone').value,
                    motorcycle: document.getElementById('rider-motorcycle').value,
                    plateNumber: document.getElementById('rider-plate').value,
                    password: document.getElementById('rider-password').value,
                    status: 'Active',
                    timestamp: new Date()
                });
                modal.classList.remove('active');
                riderForm.reset();
                await showAlert("Rider successfully registered!");
            } catch(e) {
                await showAlert("Error: " + e.message);
            }
        };
    }

    // Load Data Real-time
    onSnapshot(query(collection(db, "riders"), orderBy("riderId", "asc")), (snapshot) => {
        if(!tableBody) return;
        tableBody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const r = docSnap.data();
            tableBody.innerHTML += `
                <tr>
                    <td data-label="Rider ID"><b>${r.riderId}</b></td>
                    <td data-label="Full Name">${r.name}</td>
                    <td data-label="Email">${r.email}</td>
                    <td data-label="Phone">${r.phone}</td>
                    <td data-label="Vehicle">${r.motorcycle}</td>
                    <td data-label="Plate #">${r.plateNumber}</td>
                    <td data-label="Status"><span class="status-badge completed">${r.status}</span></td>
                    <td data-label="Action">
                        <button class="icon-btn del-btn" onclick="window.deleteRider('${docSnap.id}')">
                            <span class="material-icons-sharp">delete</span>
                        </button>
                    </td>
                </tr>`;
        });
    });

    window.deleteRider = async (id) => {
        if(await showConfirm("Delete Account?", "Permanently remove this rider?")) {
            await deleteDoc(doc(db, "riders", id));
            await showAlert("Rider deleted successfully.");
        }
    };
}

// ======================================================
//  SIDEBAR & INIT
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    const hb = document.getElementById("hamburger-btn");
    const sb = document.getElementById("sidebar");
    if(hb && sb) hb.onclick = () => sb.classList.toggle("active");

    const page = window.location.pathname.split('/').pop();
    if (page === 'schedule.html') initializeSchedule();
});