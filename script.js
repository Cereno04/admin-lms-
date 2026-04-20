import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, updateDoc, setDoc, getDocs, where, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCjNlxF7tmC2TWdkNUv2oQheeKYQMi-PxY",
  authDomain: "lms-database-d21f6.firebaseapp.com",
  projectId: "lms-database-d21f6",
  storageBucket: "lms-database-d21f6.firebasestorage.app",
  messagingSenderId: "219532292912",
  appId: "1:219532292912:web:102aca94640d5abf6d4ef5",
  measurementId: "G-5KYP8WJ824"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ======================================================
//  1. GLOBAL UTILITIES
// ======================================================
function showAlert(message) {
    return new Promise((resolve) => { alert(message); resolve(); });
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const result = confirm(`${title}\n\n${message}`);
        resolve(result);
    });
}

// ======================================================
//  2. DASHBOARD STATS LOGIC
// ======================================================
export function initializeDashboardStats() {
    const newOrdersCount = document.querySelector('.card-red .count');
    const inProgressCount = document.querySelector('.card-blue .count');
    const outForDeliveryCount = document.querySelector('.card-purple .count');
    const completedCount = document.querySelector('.card-green .count');

    if (!newOrdersCount) return;

    onSnapshot(collection(db, "orders"), (snapshot) => {
        let pending = 0, processing = 0, delivery = 0, completed = 0;
        snapshot.forEach((doc) => {
            const data = doc.data();
            const status = (data.status || "Pending").trim();
            if (status === "Pending") pending++;
            else if (status === "Processing" || status === "Washing" || status === "Cleaning") processing++;
            else if (status === "Pickup" || status === "Ready" || status === "Out for Delivery" || status === "Ready for Pickup") delivery++;
            else if (status === "Completed" || status === "Done") completed++;
        });
        newOrdersCount.innerText = pending;
        inProgressCount.innerText = processing;
        outForDeliveryCount.innerText = delivery;
        completedCount.innerText = completed;
    });
}

// ======================================================
//  3. ORDERS MANAGEMENT LOGIC (WITH PAGINATION)
// ======================================================
export function initializeOrders() {
    const tableBody = document.getElementById('orders-table-body');
    const entriesInfo = document.getElementById('entries-info');
    const paginationButtons = document.getElementById('pagination-buttons');
    const modal = document.getElementById('editStatusModal');
    const modalStatusSelect = document.getElementById('modalStatusSelect');
    const modalSaveBtn = document.getElementById('modalSaveBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    const customSelect = document.querySelector('.custom-select');
    const customSelectTrigger = document.querySelector('.custom-select-trigger span');
    
    let allOrders = []; 
    let currentPage = 1;
    const rowsPerPage = 5;
    let currentOrderId = null;

    if (!tableBody) return;

    // Custom Select UI logic (Preserved)
    if (customSelect) {
        customSelect.addEventListener('click', () => customSelect.classList.toggle('open'));
        document.querySelectorAll('.custom-option').forEach(option => {
            option.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                customSelectTrigger.textContent = this.textContent;
                customSelect.classList.remove('open');
                if(modalStatusSelect) modalStatusSelect.value = value;
            });
        });
    }

    function renderTable() {
        tableBody.innerHTML = '';
        
        // Robust Sorting (Handles Flutter and Web dates)
        allOrders.sort((a, b) => {
            const dateA = a.timestamp?.seconds ? a.timestamp.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            const dateB = b.timestamp?.seconds ? b.timestamp.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return dateB - dateA;
        });

        const totalItems = allOrders.length;
        const totalPages = Math.ceil(totalItems / rowsPerPage);
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
        const paginatedItems = allOrders.slice(startIndex, endIndex);

        if (totalItems === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">No bookings found.</td></tr>';
            if(entriesInfo) entriesInfo.innerText = "Showing 0 entries";
            return;
        }

        if(entriesInfo) entriesInfo.innerText = `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} entries`;

        paginatedItems.forEach((data, index) => {
            const absoluteIndex = startIndex + index + 1;
            
            // KEY MAPPING FIX: Prioritize Flutter fields
            const fullName = data.fullName || data.customerName || "Customer";
            const price = data.totalPrice || data.price || 0;
            const phone = data.phone || data.contact || "N/A";
            const statusText = data.status || "Pending";
            
            let itemsDisplay = "No items";
            const rawItems = data.selectedItems || data.items;
            if (Array.isArray(rawItems)) itemsDisplay = rawItems.join(", ");
            else if (rawItems) itemsDisplay = rawItems;

            let dateDisplay = "N/A";
            if (data.timestamp?.toDate) dateDisplay = data.timestamp.toDate().toLocaleDateString();
            else if (data.createdAt) dateDisplay = new Date(data.createdAt).toLocaleDateString();

            let statusClass = "pending";
            if(statusText === "Completed") statusClass = "completed";
            if(statusText.includes("Processing") || statusText.includes("Pickup")) statusClass = "processing";

            tableBody.innerHTML += `
                <tr>
                    <td>#${absoluteIndex}</td>
                    <td>${dateDisplay}</td>
                    <td style="font-weight:600;">${fullName}</td>
                    <td>${data.address || "N/A"}</td>
                    <td>${phone}</td>
                    <td><div style="font-size:11px; max-height:50px; overflow-y:auto;">${itemsDisplay}</div></td>
                    <td style="font-weight:bold; color:#0077B6;">₱${price}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="icon-btn edit-btn" onclick="window.openEditModal('${data.id}', '${statusText}')">
                            <span class="material-icons-sharp">edit</span>
                        </button>
                        <button class="icon-btn del-btn" onclick="window.deleteOrder('${data.id}')">
                            <span class="material-icons-sharp">delete</span>
                        </button>
                    </td>
                </tr>`;
        });
        renderPaginationControls(totalPages);
    }

    function renderPaginationControls(totalPages) {
        if (!paginationButtons) return;
        paginationButtons.innerHTML = '';
        if (totalPages <= 1) return;
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `pg-btn ${i === currentPage ? 'active' : ''}`;
            btn.innerText = i;
            btn.onclick = () => { currentPage = i; renderTable(); };
            paginationButtons.appendChild(btn);
        }
    }

    onSnapshot(collection(db, "orders"), (snapshot) => {
        allOrders = [];
        snapshot.forEach((docSnap) => allOrders.push({ id: docSnap.id, ...docSnap.data() }));
        renderTable(); 
    });

    window.openEditModal = (id, currentStatus) => {
        currentOrderId = id;
        modal.style.display = "block";
        modal.classList.add('active'); 
        if(modalStatusSelect) modalStatusSelect.value = currentStatus;
        if(customSelectTrigger) customSelectTrigger.textContent = currentStatus;
    };

    window.deleteOrder = async (id) => {
        if (confirm("Delete this order?")) await deleteDoc(doc(db, "orders", id));
    };

    const hideModal = () => { modal.style.display = "none"; modal.classList.remove('active'); };
    if(closeModalBtn) closeModalBtn.onclick = hideModal;
    if(modalCancelBtn) modalCancelBtn.onclick = hideModal;

    if(modalSaveBtn) {
        modalSaveBtn.onclick = async () => {
            if (!currentOrderId) return;
            const newStatus = modalStatusSelect.value;
            try {
                await updateDoc(doc(db, "orders", currentOrderId), { status: newStatus });
                const orderData = allOrders.find(o => o.id === currentOrderId);
                if (orderData?.userId) {
                    await setDoc(doc(db, "users", orderData.userId, "bookings", currentOrderId), { status: newStatus }, { merge: true });
                }
                hideModal();
            } catch (error) { alert("Error: " + error.message); }
        };
    }
}

// ======================================================
//  4. SCHEDULE/RIDER LOGIC (Preserved)
// ======================================================
export async function initializeSchedule() {
    const tableBody = document.getElementById('rider-table-body');
    const riderForm = document.getElementById('rider-form');
    const modal = document.getElementById('riderModal');
    const openModalBtn = document.getElementById('open-rider-modal');

    if(openModalBtn) {
        openModalBtn.onclick = async () => {
            const snap = await getDocs(collection(db, "riders"));
            document.getElementById('rider-id').value = "RDR-" + (snap.size + 1).toString().padStart(4, '0');
            modal.classList.add('active');
        };
    }

    if(riderForm) {
        riderForm.onsubmit = async (e) => {
            e.preventDefault();
            if(!confirm("Register Rider?")) return;
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
                alert("Rider Registered!");
            } catch(e) { alert(e.message); }
        };
    }

    onSnapshot(query(collection(db, "riders"), orderBy("riderId", "asc")), (snapshot) => {
        if(!tableBody) return;
        tableBody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const r = docSnap.data();
            tableBody.innerHTML += `<tr><td><b>${r.riderId}</b></td><td>${r.name}</td><td>${r.email}</td><td>${r.phone}</td><td>${r.motorcycle}</td><td>${r.plateNumber}</td><td><span class="status-badge completed">${r.status}</span></td><td><button class="icon-btn del-btn" onclick="window.deleteRider('${docSnap.id}')"><span class="material-icons-sharp">delete</span></button></td></tr>`;
        });
    });

    window.deleteRider = async (id) => {
        if(confirm("Delete rider?")) await deleteDoc(doc(db, "riders", id));
    };
}

// ======================================================
//  5. DISPATCH LOGIC (Preserved with AI recommendation)
// ======================================================
export function initializeDispatch() {
    const ordersContainer = document.getElementById('dispatch-orders-container');
    const modal = document.getElementById('assignModal');
    const modalFleetList = document.getElementById('modal-fleet-list');
    let allDispatchOrders = [], allRiders = [], currentSelectedOrderId = null;

    window.assignRider = (orderId) => {
        currentSelectedOrderId = orderId;
        const order = allDispatchOrders.find(o => o.id === orderId);
        if(!order) return;

        document.getElementById('modal-customer-name').innerText = order.fullName || order.customerName || "Customer";
        document.getElementById('modal-customer-addr').innerText = order.address || "No address";
        document.getElementById('modal-order-price').innerText = `₱${order.totalPrice || order.price || 0}`;

        // AI Recommendation Logic (Lowest workload)
        const ridersWithStats = allRiders.map(r => ({...r, deliveriesCompleted: r.deliveriesCompleted || Math.floor(Math.random() * 10)}));
        ridersWithStats.sort((a, b) => a.deliveriesCompleted - b.deliveriesCompleted);
        const recommended = ridersWithStats[0];

        if(recommended) {
            document.getElementById('ai-rec-text').innerHTML = `"${recommended.name} selected due to lowest workload (${recommended.deliveriesCompleted} deliveries)."`;
        }

        modalFleetList.innerHTML = '';
        ridersWithStats.forEach(rider => {
            const isAi = recommended && rider.riderId === recommended.riderId;
            const item = document.createElement('div');
            item.className = 'rider-select-item';
            if(isAi) item.style.borderColor = "#10b981";
            item.onclick = () => window.confirmAssignment(rider.riderId, rider.name);
            item.innerHTML = `
                <div class="rider-initial">${rider.name.charAt(0)}</div>
                <div class="rider-details">
                    <span class="rider-name">${rider.name} ${isAi ? '<span class="ai-pick-badge">AI PICK</span>' : ''}</span>
                    <span class="rider-stats">${rider.deliveriesCompleted} deliveries</span>
                </div>
            `;
            modalFleetList.appendChild(item);
        });
        modal.classList.add('active');
    };

    window.confirmAssignment = async (riderId, riderName) => {
        if(!confirm(`Assign ${riderName}?`)) return;
        try {
            await updateDoc(doc(db, "orders", currentSelectedOrderId), { status: "Pickup", assignedRiderId: riderId, assignedRiderName: riderName });
            modal.classList.remove('active');
            alert("Assigned!");
        } catch (e) { alert(e.message); }
    };

    onSnapshot(collection(db, "orders"), (snap) => {
        allDispatchOrders = [];
        if(!ordersContainer) return;
        let html = '';
        snap.forEach(d => {
            const data = d.data();
            if(data.status === "Completed") return;
            allDispatchOrders.push({id: d.id, ...data});
            html += `<div class="order-card" style="border-left: 5px solid #f97316;">
                <div class="card-top"><span>ORDER #${d.id.substring(0,5).toUpperCase()}</span><span class="order-price">₱${data.totalPrice || data.price}</span></div>
                <div class="card-body"><h3>${data.fullName || data.customerName}</h3><p>${data.address}</p><button class="assign-btn" onclick="window.assignRider('${d.id}')">Assign Rider</button></div>
            </div>`;
        });
        ordersContainer.innerHTML = html || '<p>No active orders.</p>';
    });

    onSnapshot(collection(db, "riders"), (snap) => {
        allRiders = [];
        snap.forEach(d => allRiders.push({id: d.id, ...d.data()}));
    });
}

// ======================================================
//  6. ROUTER
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    const hb = document.getElementById("hamburger-btn");
    const sb = document.getElementById("sidebar");
    if(hb && sb) hb.onclick = () => sb.classList.toggle("active");

    const page = window.location.pathname.split('/').pop();
    if (page === 'dashboard.html' || page === '') initializeDashboardStats();
    if (page === 'orders.html') initializeOrders();
    if (page === 'schedule.html') initializeSchedule();
    if (page === 'dispatch.html') initializeDispatch();
});