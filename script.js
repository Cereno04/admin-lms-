import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { handleAuthRouting, handleLogout } from './firebase-core.js';
import { initializeCustomers, initializeSchedule } from './page-handlers.js'; 

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

// Sidebar Toggle Logic
function initializeSidebar() {
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const sidebar = document.getElementById("sidebar");
    const navLinks = document.querySelectorAll(".nav-link");

    if (hamburgerBtn && sidebar) {
        hamburgerBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            sidebar.classList.toggle("active");
        });

        document.addEventListener("click", (e) => {
            if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                sidebar.classList.remove("active");
            }
        });
    }

    const currentPage = window.location.pathname.split('/').pop();
    navLinks.forEach(link => {
        if (link.getAttribute('href').includes(currentPage)) {
            link.classList.add('active');
        }
    });
}

// ======================================================
//  DASHBOARD LOGIC
// ======================================================
export function initializeDashboard() {
    const newOrdersCount = document.querySelector('.card-red .count');
    const inProgressCount = document.querySelector('.card-blue .count');
    const deliveryCount = document.querySelector('.card-purple .count');
    const completedCount = document.querySelector('.card-green .count');

    if (!newOrdersCount) return;

    const q = query(collection(db, "orders"));

    onSnapshot(q, (snapshot) => {
        let counts = { pending: 0, processing: 0, delivery: 0, completed: 0 };

        snapshot.forEach((doc) => {
            const data = doc.data();
            const status = data.status ? data.status.toLowerCase().trim() : 'pending';

            if (status === 'pending') counts.pending++;
            else if (status === 'processing' || status === 'pickup' || status === 'wash' || status === 'fold') counts.processing++;
            else if (status === 'out for delivery') counts.delivery++;
            else if (status === 'completed') counts.completed++;
        });

        if (newOrdersCount) newOrdersCount.innerText = counts.pending;
        if (inProgressCount) inProgressCount.innerText = counts.processing;
        if (deliveryCount) deliveryCount.innerText = counts.delivery;
        if (completedCount) completedCount.innerText = counts.completed;
    }, (error) => {
        console.error("Error getting dashboard stats:", error);
    });
}

// ======================================================
//  ORDERS PAGE LOGIC (FIXED FOR FLUTTER APP SYNC)
// ======================================================
export function initializeOrders() {
    const tableBody = document.getElementById('orders-table-body');
    const entriesInfo = document.getElementById('entries-info');
    const paginationContainer = document.getElementById('pagination-buttons');
    
    // Modal Elements
    const modal = document.getElementById('editStatusModal');
    const modalSelect = document.getElementById('modalStatusSelect'); 
    const saveBtn = document.getElementById('modalSaveBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeIcon = document.querySelector('.close-modal-btn');

    // Custom Dropdown Elements
    const customWrapper = document.querySelector('.custom-select-wrapper');
    const customSelect = customWrapper ? customWrapper.querySelector('.custom-select') : null;
    const customTrigger = customWrapper ? customWrapper.querySelector('.custom-select-trigger') : null;
    const customTriggerText = customTrigger ? customTrigger.querySelector('span') : null;
    const customOptions = customWrapper ? customWrapper.querySelectorAll('.custom-option') : null;
    
    let currentEditId = null;
    let allOrdersData = []; 
    
    // --- PAGINATION SETTINGS ---
    let currentPage = 1;
    const rowsPerPage = 4;

    const closeModal = () => {
        if(modal) modal.classList.remove('active');
        if(customSelect) customSelect.classList.remove('open');
        currentEditId = null;
    };

    if(cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if(closeIcon) closeIcon.addEventListener('click', closeModal);
    if(modal) {
        window.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (customTrigger && customSelect && customOptions) {
        customTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            customSelect.classList.toggle('open');
        });

        customOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                customOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');

                const text = option.textContent;
                const value = option.getAttribute('data-value');
                if(customTriggerText) customTriggerText.textContent = text;
                if(modalSelect) modalSelect.value = value;

                customSelect.classList.remove('open');
            });
        });

        window.addEventListener('click', (e) => {
            if (!customWrapper.contains(e.target)) {
                customSelect.classList.remove('open');
            }
        });
    }

    // --- FIX: UPDATING USER APP STATUS ---
    if(saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (currentEditId && modalSelect) {
                const newStatus = modalSelect.value;
                
                try {
                    // 1. Get current order data locally
                    const orderData = allOrdersData.find(o => o.id === currentEditId);
                    
                    if (!orderData) {
                        alert("Error: Data not loaded. Please refresh.");
                        return;
                    }

                    console.log("Saving Order ID:", currentEditId);

                    // 2. Find the User ID (tries all common field names)
                    const userId = orderData.userId || 
                                   orderData.uid || 
                                   orderData.senderId || 
                                   orderData.customerId || 
                                   orderData.user_id;

                    console.log("Found User ID:", userId); 

                    // 3. Update GLOBAL Admin Orders (Using setDoc with merge to be safe)
                    await setDoc(doc(db, "orders", currentEditId), { status: newStatus }, { merge: true });

                    // 4. Update CUSTOMER Mobile App (Personal Booking)
                    if (userId) {
                        try {
                            await setDoc(doc(db, "users", userId, "bookings", currentEditId), { status: newStatus }, { merge: true });
                            console.log("Updated users/bookings successfully");
                        } catch(e) {
                            console.warn("Bookings update failed, trying orders...", e);
                            try {
                                await setDoc(doc(db, "users", userId, "orders", currentEditId), { status: newStatus }, { merge: true });
                                console.log("Updated users/orders successfully");
                            } catch(err) {
                                console.error("FATAL: Could not update user subcollection.", err);
                            }
                        }
                    } else {
                        console.warn("No User ID found on this order. Cannot update customer app.");
                    }

                    closeModal();
                    alert("Status Updated Successfully!"); 

                } catch(e) {
                    console.error("Update failed:", e);
                    alert("Error: " + e.message);
                }
            }
        });
    }

    if (!tableBody) return;

    // Listen to Orders Collection
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));

    onSnapshot(q, (snapshot) => {
        allOrdersData = [];
        snapshot.forEach((docSnap) => {
            allOrdersData.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });
        
        const totalPages = Math.ceil(allOrdersData.length / rowsPerPage);
        if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        renderTable(currentPage);
    });

    function renderTable(page) {
        tableBody.innerHTML = '';

        if (allOrdersData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">No orders found</td></tr>`;
            if(entriesInfo) entriesInfo.innerText = "Showing 0 entries";
            if(paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedItems = allOrdersData.slice(startIndex, endIndex);

        const showEnd = Math.min(endIndex, allOrdersData.length);
        if(entriesInfo) entriesInfo.innerText = `Showing ${startIndex + 1} to ${showEnd} of ${allOrdersData.length} entries`;

        let displayIndex = startIndex + 1;

        paginatedItems.forEach((order) => {
            const orderId = order.id;

            let dateStr = "N/A", timeStr = "";
            if (order.timestamp && typeof order.timestamp.toDate === "function") {
                const d = order.timestamp.toDate();
                dateStr = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
                timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            }

            let statusClass = "pending", statusLabel = "Pending";
            let dbStatus = order.status || "Pending";
            let dbStatusLower = dbStatus.toLowerCase();

            if (dbStatusLower.includes("process") || dbStatusLower === "pickup" || dbStatusLower === "wash" || dbStatusLower === "fold") {
                statusClass = "processing"; 
                statusLabel = "Processing"; 
            } else if (dbStatusLower === "out for delivery") {
                statusClass = "delivery";
                statusLabel = "Out for Delivery";
            } else if (dbStatusLower === "completed") {
                statusClass = "completed"; 
                statusLabel = "Completed";
            } else {
                statusLabel = dbStatus;
            }

            let itemsText = Array.isArray(order.selectedItems) ? order.selectedItems.join(", ") : (order.selectedItems || "");
            let comments = order.comments ? `<span class="note">Note: ${order.comments}</span>` : "";

            const safeName = (order.customerName || "Guest").replace(/'/g, "\\'");
            const safeItems = itemsText.replace(/'/g, "\\'");
            const safeTotal = (order.totalPrice || 0);
            
            const row = `
                <tr>
                    <td data-label="#">${displayIndex++}</td>
                    <td data-label="Date" class="td-date">
                        <p>${dateStr}</p>
                        <span>${timeStr}</span>
                    </td>
                    <td data-label="Name" class="td-user">
                        <p>${order.customerName || "Guest"}</p>
                        <span>${order.email || ""}</span>
                    </td>
                    <td data-label="Address">${order.address || ""}</td>
                    <td data-label="Contact">${order.phone || ""}</td>
                    <td data-label="Details" class="td-details">
                        ${itemsText}
                        ${comments}
                    </td>
                    <td data-label="Total" class="td-price">₱${order.totalPrice || 0}</td>
                    <td data-label="Status"><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                    <td data-label="Actions">
                        <div class="actions">
                            <button class="icon-btn view-btn" onclick="alert('ORDER DETAILS:\\n------------------\\nName: ${safeName}\\nItems: ${safeItems}\\nTotal: ₱${safeTotal}\\nStatus: ${statusLabel}')">
                                <span class="material-icons-outlined">visibility</span>
                            </button>
                            <button class="icon-btn edit-btn" onclick="window.openEditModal('${orderId}', '${dbStatus}')"><span class="material-icons-outlined">edit</span></button>
                            <button class="icon-btn del-btn" onclick="window.deleteOrder('${orderId}')"><span class="material-icons-outlined">delete_outline</span></button>
                        </div>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

        renderPaginationButtons();
    }

    function renderPaginationButtons() {
        if (!paginationContainer) return;
        paginationContainer.innerHTML = '';

        const totalPages = Math.ceil(allOrdersData.length / rowsPerPage);

        // Previous Button
        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '<span class="material-icons-outlined">chevron_left</span>';
        prevBtn.classList.add('pg-btn');
        
        if (currentPage === 1) {
            prevBtn.style.opacity = '0.5';
            prevBtn.style.cursor = 'not-allowed';
            prevBtn.disabled = true;
        } else {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderTable(currentPage);
                }
            });
        }
        paginationContainer.appendChild(prevBtn);

        // Number Buttons
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.classList.add('pg-btn');
            
            if (i === currentPage) {
                btn.classList.add('active');
            }

            btn.addEventListener('click', () => {
                currentPage = i;
                renderTable(currentPage);
            });

            paginationContainer.appendChild(btn);
        }

        // Next Button
        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '<span class="material-icons-outlined">chevron_right</span>';
        nextBtn.classList.add('pg-btn');
        
        if (currentPage === totalPages || totalPages === 0) {
            nextBtn.style.opacity = '0.5';
            nextBtn.style.cursor = 'not-allowed';
            nextBtn.disabled = true;
        } else {
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderTable(currentPage);
                }
            });
        }
        paginationContainer.appendChild(nextBtn);
    }

    window.openEditModal = (id, currentStatus) => {
        currentEditId = id;
        
        let selectValue = currentStatus;
        if(modalSelect) {
            modalSelect.value = selectValue;
        }

        if (customOptions && customTriggerText) {
            customOptions.forEach(opt => opt.classList.remove('selected'));
            const matchingOption = Array.from(customOptions).find(opt => opt.getAttribute('data-value') === selectValue);
            
            if (matchingOption) {
                matchingOption.classList.add('selected');
                customTriggerText.textContent = matchingOption.textContent;
            } else {
                customTriggerText.textContent = selectValue;
            }
        }

        if(modal) modal.classList.add('active');
    };

    window.deleteOrder = async (id) => {
        if(confirm("Delete this order?")) { 
            try {
                // Delete Global
                await deleteDoc(doc(db, "orders", id));
                
                // Delete User Booking
                const orderData = allOrdersData.find(o => o.id === id);
                const userId = orderData ? (orderData.userId || orderData.uid || orderData.senderId || orderData.customerId) : null;
                if(userId) {
                     try { await deleteDoc(doc(db, "users", userId, "bookings", id)); } catch(e){}
                     try { await deleteDoc(doc(db, "users", userId, "orders", id)); } catch(e){}
                }
            } catch(e) {
                console.error(e);
            }
        }
    };
}

function initApp() {
    initializeSidebar();
    const page = window.location.pathname.split('/').pop();

    if(page !== 'login.html') { 
        handleAuthRouting(); 
        handleLogout(); 
    }

    if (page === 'dashboard.html' || page === '') {
        initializeDashboard(); 
    } 
    else if (page === 'orders.html') {
        initializeOrders();
    }
    else if (page === 'customers.html') {
        initializeCustomers();
    }
    else if (page === 'schedule.html') {
        initializeSchedule();
    }
}

document.addEventListener('DOMContentLoaded', initApp);