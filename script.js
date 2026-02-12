import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
//  1. GLOBAL UTILITIES (Alert & Confirm)
// ======================================================
function showAlert(message) {
    return new Promise((resolve) => {
        alert(message); 
        resolve();
    });
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const result = confirm(`${title}\n\n${message}`);
        resolve(result);
    });
}

// ======================================================
//  2. ORDERS MANAGEMENT LOGIC (WITH PAGINATION)
// ======================================================
export function initializeOrders() {
    const tableBody = document.getElementById('orders-table-body');
    const entriesInfo = document.getElementById('entries-info');
    const paginationButtons = document.getElementById('pagination-buttons');
    
    // Modal Elements
    const modal = document.getElementById('editStatusModal');
    const modalStatusSelect = document.getElementById('modalStatusSelect');
    const modalSaveBtn = document.getElementById('modalSaveBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    
    // Custom Dropdown Elements
    const customSelectWrapper = document.querySelector('.custom-select-wrapper');
    const customSelect = document.querySelector('.custom-select');
    const customSelectTrigger = document.querySelector('.custom-select-trigger span');
    
    // Pagination State
    let allOrders = []; // Stores all fetched data
    let currentPage = 1;
    const rowsPerPage = 5;
    let currentOrderId = null;

    if (!tableBody) return;

    // --- A. Setup Custom Dropdown Logic ---
    if (customSelect) {
        customSelect.addEventListener('click', () => {
            customSelect.classList.toggle('open');
        });

        document.querySelectorAll('.custom-option').forEach(option => {
            option.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                const text = this.textContent;
                customSelectTrigger.textContent = text;
                customSelect.classList.remove('open');
                if(modalStatusSelect) modalStatusSelect.value = value;
                document.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
            });
        });
    }

    // --- B. Render Functions (Pagination Logic) ---
    
    function renderTable() {
        tableBody.innerHTML = '';
        
        // 1. Sort Orders (Newest First)
        allOrders.sort((a, b) => {
            const dateA = a.timestamp ? a.timestamp.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date(0));
            const dateB = b.timestamp ? b.timestamp.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date(0));
            return dateB - dateA;
        });

        // 2. Calculate Pagination Slices
        const totalItems = allOrders.length;
        const totalPages = Math.ceil(totalItems / rowsPerPage);
        
        // Ensure current page is valid
        if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
        const paginatedItems = allOrders.slice(startIndex, endIndex);

        // 3. Update "Showing X entries" text
        if (totalItems === 0) {
            entriesInfo.innerText = "Showing 0 entries";
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">No orders found.</td></tr>';
            renderPaginationControls(0);
            return;
        } else {
            entriesInfo.innerText = `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} entries`;
        }

        // 4. Generate Rows
        paginatedItems.forEach((data, index) => {
            // Absolute index for the row number (#)
            const absoluteIndex = startIndex + index + 1;
            const id = data.id;

            // Data Mapping
            const fullName = data.customerName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || "Unknown";
            const price = data.totalPrice || data.price || 0;
            
            let itemsDisplay = "No items";
            const rawItems = data.items || data.selectedItems;
            if (Array.isArray(rawItems)) itemsDisplay = rawItems.join(", ");
            else if (rawItems) itemsDisplay = rawItems;

            let dateDisplay = "N/A";
            if (data.timestamp && typeof data.timestamp.toDate === 'function') {
                dateDisplay = data.timestamp.toDate().toLocaleDateString();
            } else if (data.createdAt) {
                dateDisplay = new Date(data.createdAt).toLocaleDateString();
            }

            let statusClass = "pending";
            const statusText = data.status || "Pending";
            if(statusText === "Completed") statusClass = "completed";
            if(statusText === "Processing" || statusText === "Pickup") statusClass = "processing";

            const row = `
                <tr>
                    <td>#${absoluteIndex}</td>
                    <td>${dateDisplay}</td>
                    <td style="font-weight:600;">${fullName}</td>
                    <td>${data.address || "N/A"}</td>
                    <td>
                        <div>${data.phone || ""}</div>
                        <div style="font-size:11px; color:#888;">${data.email || ""}</div>
                    </td>
                    <td>
                        <div style="font-size:12px; line-height:1.4; max-height:60px; overflow-y:auto;">
                            ${itemsDisplay}
                        </div>
                    </td>
                    <td style="font-weight:bold; color:var(--color-primary);">₱${price}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="icon-btn edit-btn" onclick="window.openEditModal('${id}', '${statusText}')">
                            <span class="material-icons-sharp">edit</span>
                        </button>
                        <button class="icon-btn del-btn" onclick="window.deleteOrder('${id}')">
                            <span class="material-icons-sharp">delete</span>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

        renderPaginationControls(totalPages);
    }

    function renderPaginationControls(totalPages) {
        paginationButtons.innerHTML = '';
        if (totalPages <= 1) return;

        // Prev Button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pg-btn';
        prevBtn.innerHTML = '«';
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        };
        paginationButtons.appendChild(prevBtn);

        // Page Numbers
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.className = `pg-btn ${i === currentPage ? 'active' : ''}`;
            btn.innerText = i;
            btn.onclick = () => {
                currentPage = i;
                renderTable();
            };
            paginationButtons.appendChild(btn);
        }

        // Next Button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pg-btn';
        nextBtn.innerHTML = '»';
        nextBtn.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        };
        paginationButtons.appendChild(nextBtn);
    }

    // --- C. Fetch Data Real-time ---
    const q = query(collection(db, "orders"));

    onSnapshot(q, (snapshot) => {
        allOrders = [];
        snapshot.forEach((docSnap) => {
            // Save ID inside the object for easier access
            allOrders.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        renderTable(); // Triggers render and pagination
    });

    // --- D. Window Actions ---
    window.openEditModal = (id, currentStatus) => {
        currentOrderId = id;
        modal.style.display = "block";
        modal.classList.add('active'); // Ensure CSS transition works if set up
        
        if(modalStatusSelect) modalStatusSelect.value = currentStatus;
        if(customSelectTrigger) customSelectTrigger.textContent = currentStatus;
    };

    window.deleteOrder = async (id) => {
        const confirmed = await showConfirm("Delete Order?", "Are you sure you want to remove this order?");
        if (confirmed) {
            try {
                await deleteDoc(doc(db, "orders", id));
            } catch (error) {
                console.error("Error deleting:", error);
                alert("Failed to delete.");
            }
        }
    };

    // --- E. Modal Buttons ---
    const hideModal = () => {
        modal.style.display = "none";
        modal.classList.remove('active');
        currentOrderId = null;
    };
    if(closeModalBtn) closeModalBtn.onclick = hideModal;
    if(modalCancelBtn) modalCancelBtn.onclick = hideModal;

    if(modalSaveBtn) {
        modalSaveBtn.onclick = async () => {
            if (!currentOrderId) return;
            const newStatus = modalStatusSelect.value;
            try {
                await updateDoc(doc(db, "orders", currentOrderId), { status: newStatus });
                hideModal();
            } catch (error) {
                console.error("Error updating:", error);
                alert("Failed to update status.");
            }
        };
    }
}

// ======================================================
//  3. RIDER MANAGEMENT LOGIC
// ======================================================
export async function initializeSchedule() {
    const tableBody = document.getElementById('rider-table-body');
    const riderForm = document.getElementById('rider-form');
    const modal = document.getElementById('riderModal');
    const openModalBtn = document.getElementById('open-rider-modal');

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

    const q = query(collection(db, "riders"), orderBy("riderId", "asc"));
    onSnapshot(q, (snapshot) => {
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
//  4. DISPATCH CENTER LOGIC (UPDATED WITH MODAL)
// ======================================================
export function initializeDispatch() {
    const ordersContainer = document.getElementById('dispatch-orders-container');
    const fleetContainer = document.getElementById('dispatch-fleet-container');
    
    // Modal Elements
    const modal = document.getElementById('assignModal');
    const closeModalBtn = document.getElementById('closeAssignModal');
    const cancelBtn = document.getElementById('cancelAssignBtn');
    const modalFleetList = document.getElementById('modal-fleet-list');

    // Pagination & State
    let allDispatchOrders = [];
    let allRiders = []; // Store riders globally within this scope
    let currentPage = 1;
    const itemsPerPage = 6;
    let currentSelectedOrderId = null;

    // --- 1. MODAL FUNCTIONS ---
    
    // Function to close modal
    const closeAssignModal = () => {
        if(modal) modal.classList.remove('active');
        currentSelectedOrderId = null;
    };

    if(closeModalBtn) closeModalBtn.onclick = closeAssignModal;
    if(cancelBtn) cancelBtn.onclick = closeAssignModal;

    // Function to Assign Rider (Updates Firebase)
    window.confirmAssignment = async (riderId, riderName) => {
        if(!currentSelectedOrderId) return;
        
        const confirmed = confirm(`Assign ${riderName} to this order?`);
        if(confirmed) {
            try {
                // 1. Update Order Status
                await updateDoc(doc(db, "orders", currentSelectedOrderId), {
                    status: "Pickup", // Or "Processing" depending on your flow
                    assignedRiderId: riderId,
                    assignedRiderName: riderName,
                    assignedAt: new Date()
                });

                // 2. Optional: Update Rider Status to 'Busy'
                // await updateDoc(doc(db, "riders", riderId), { status: "Busy" });

                alert("Rider assigned successfully!");
                closeAssignModal();
            } catch (error) {
                console.error("Assignment Error:", error);
                alert("Failed to assign rider.");
            }
        }
    };

    // Main Function to Open Modal (Triggered by HTML button)
    window.assignRider = (orderId) => {
        currentSelectedOrderId = orderId;
        const order = allDispatchOrders.find(o => o.id === orderId);
        
        if(!order) return;

        // 1. Fill Order Info
        const fullName = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Unknown";
        document.getElementById('modal-customer-name').innerText = fullName;
        document.getElementById('modal-customer-addr').innerText = order.address || "No address";
        document.getElementById('modal-order-price').innerText = `₱${order.totalPrice || order.price || 0}`;

        // 2. AI Recommendation Logic (Simulated)
        // Find the "best" rider (e.g., fewest deliveries or active status)
        let recommendedRider = null;
        let lowestDeliveries = Infinity;

        // Populate deliveries logic if missing
        const ridersWithStats = allRiders.map(r => {
            return {
                ...r,
                deliveriesCompleted: r.deliveriesCompleted || Math.floor(Math.random() * 50) + 5
            };
        });

        // Sort by deliveries (ascending) to find the one with least workload
        ridersWithStats.sort((a, b) => a.deliveriesCompleted - b.deliveriesCompleted);
        
        if(ridersWithStats.length > 0) {
            recommendedRider = ridersWithStats[0];
            const aiText = document.getElementById('ai-rec-text');
            aiText.innerHTML = `"${recommendedRider.name} is selected to help balance the workload among the dispatch team as they have the lowest number of total deliveries (${recommendedRider.deliveriesCompleted})."`;
        } else {
             document.getElementById('ai-rec-text').innerHTML = "No riders available for recommendation.";
        }

        // 3. Generate Rider List inside Modal
        modalFleetList.innerHTML = '';
        
        if(ridersWithStats.length === 0) {
            modalFleetList.innerHTML = '<p style="text-align:center; color:#999; padding:10px;">No riders found.</p>';
        } else {
            ridersWithStats.forEach(rider => {
                const initial = rider.name ? rider.name.charAt(0).toUpperCase() : "?";
                const isBusy = rider.status !== "Active" && rider.status !== "Available";
                
                // If this is the recommended rider, mark as AI PICK
                const isAiPick = recommendedRider && rider.riderId === recommendedRider.riderId;
                
                const statusText = isBusy ? "BUSY" : "AVAILABLE"; 
                const tagClass = isBusy ? "tag-busy" : "tag-avail";
                
                // If it's the AI pick, add the green badge to the name
                const aiBadgeHTML = isAiPick ? `<span class="ai-pick-badge">AI PICK</span>` : '';

                const riderItem = document.createElement('div');
                riderItem.className = 'rider-select-item';
                // Add highlight border if AI pick
                if(isAiPick) riderItem.style.borderColor = "#10b981";

                riderItem.onclick = () => window.confirmAssignment(rider.riderId || rider.id, rider.name);
                
                riderItem.innerHTML = `
                    <div class="rider-initial">${initial}</div>
                    <div class="rider-details">
                        <span class="rider-name">${rider.name} ${aiBadgeHTML}</span>
                        <span class="rider-stats">${rider.deliveriesCompleted} completed deliveries</span>
                    </div>
                    ${isBusy ? `<span class="status-tag ${tagClass}">${statusText}</span>` : ''} 
                `;
                modalFleetList.appendChild(riderItem);
            });
        }

        // 4. Show Modal
        modal.classList.add('active');
    };

    // --- 2. RENDER MAIN DASHBOARD ---

    // Create Pagination Container
    let paginationContainer = document.getElementById('dispatch-pagination');
    if (!paginationContainer && ordersContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'dispatch-pagination';
        paginationContainer.style.cssText = "display:flex; justify-content:center; gap:8px; margin:25px 0;";
        ordersContainer.parentNode.insertBefore(paginationContainer, ordersContainer.nextSibling);
    }

    const renderDispatch = () => {
        if (!ordersContainer) return;

        const totalItems = allDispatchOrders.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const currentSlice = allDispatchOrders.slice(startIndex, startIndex + itemsPerPage);

        let html = '';
        if (totalItems === 0) {
            html = '<p style="grid-column: 1/-1; text-align:center; color:#888;">No active orders found.</p>';
        } else {
            currentSlice.forEach(order => {
                const fullName = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Unknown";
                const displayPrice = order.totalPrice || order.price || 0;
                const displayId = order.id.length > 5 ? order.id.substring(0,5).toUpperCase() : order.id;
                let statusColor = "#f97316"; 
                if (order.status === "Completed") statusColor = "#10b981";
                if (order.status === "Pickup") statusColor = "#0077B6";

                html += `
                <div class="order-card" style="border-left: 5px solid ${statusColor}; display: flex; flex-direction: column; height: 100%;">
                    <div class="card-top">
                        <span class="order-id" style="color:#64748b;">ORDER #${displayId}</span>
                        <span class="order-price">₱${displayPrice}</span>
                    </div>
                    <div class="card-body" style="flex: 1; display: flex; flex-direction: column;">
                        <h3>${fullName}</h3>
                        <div class="card-address" style="margin-bottom: 1rem;">
                            <span class="material-icons-sharp" style="font-size: 16px;">location_on</span>
                            <span>${order.address || "No Address Provided"}</span>
                        </div>
                        <div style="margin-top: auto; margin-bottom:10px; font-size:0.8rem; color:${statusColor}; font-weight:bold; text-transform:uppercase;">
                            Status: ${order.status || "Pending"}
                        </div>
                        <button class="assign-btn" onclick="window.assignRider('${order.id}')">
                            <span class="material-icons-sharp" style="font-size: 18px;">person_add</span>
                            Assign Rider
                        </button>
                    </div>
                </div>`;
            });
        }
        ordersContainer.innerHTML = html;
        renderPaginationControls(totalPages);
    };

    function renderPaginationControls(totalPages) {
        if (!paginationContainer) return;
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;

        const createBtn = (text, onClick, active = false) => {
            const btn = document.createElement('button');
            btn.innerText = text;
            btn.style.cssText = `min-width:32px; height:32px; border-radius:6px; border:1px solid #dfe3e8; background:${active?'#0077B6':'#fff'}; color:${active?'#fff':'#0077B6'}; cursor:pointer;`;
            btn.onclick = onClick;
            return btn;
        };

        paginationContainer.appendChild(createBtn('«', () => { if(currentPage>1){currentPage--; renderDispatch();} }));
        for(let i=1; i<=totalPages; i++) {
            paginationContainer.appendChild(createBtn(i, () => { currentPage=i; renderDispatch(); }, i===currentPage));
        }
        paginationContainer.appendChild(createBtn('»', () => { if(currentPage<totalPages){currentPage++; renderDispatch();} }));
    }

    // --- 3. FETCH DATA ---

    // Fetch Orders
    const qOrders = query(collection(db, "orders"));
    onSnapshot(qOrders, (snapshot) => {
        allDispatchOrders = [];
        snapshot.forEach((docSnap) => {
            allDispatchOrders.push({ id: docSnap.id, ...docSnap.data() });
        });
        allDispatchOrders.sort((a, b) => {
            const dateA = a.timestamp ? a.timestamp.toDate() : new Date(0);
            const dateB = b.timestamp ? b.timestamp.toDate() : new Date(0);
            return dateB - dateA;
        });
        renderDispatch();
    });

    // Fetch Riders (Saved to variable for Modal use)
    const qRiders = query(collection(db, "riders"));
    onSnapshot(qRiders, (snapshot) => {
        allRiders = []; // Update global list
        let html = '';
        
        snapshot.forEach((docSnap) => {
            const rider = { id: docSnap.id, ...docSnap.data() };
            allRiders.push(rider);

            // Render Small Fleet Cards (Bottom right section)
            const initial = rider.name ? rider.name.charAt(0).toUpperCase() : "?";
            const isAvailable = rider.status === "Active" || rider.status === "Available";
            const statusClass = isAvailable ? "status-avail" : "status-busy";
            const statusText = isAvailable ? "Available" : "Busy";
            const avatarClass = isAvailable ? "avatar-green" : "avatar-orange";
            const dotClass = isAvailable ? "bg-green" : "bg-orange";

            html += `
            <div class="rider-card">
                <div class="rider-avatar ${avatarClass}">${initial}</div>
                <div class="rider-info">
                    <h4>${rider.name}</h4>
                    <span class="rider-status ${statusClass}">${statusText}</span>
                </div>
                <div class="status-indicator ${dotClass}"></div>
            </div>`;
        });
        if(fleetContainer) fleetContainer.innerHTML = html || '<p>No riders.</p>';
    });
}

// ======================================================
//  5. ROUTER & INITIALIZATION
// ======================================================
document.addEventListener('DOMContentLoaded', () => {
    // Sidebar Toggle
    const hb = document.getElementById("hamburger-btn");
    const sb = document.getElementById("sidebar");
    if(hb && sb) hb.onclick = () => sb.classList.toggle("active");

    // Page Detection
    const path = window.location.pathname;
    const page = path.split('/').pop();

    console.log("Current page detected:", page);

    if (page === 'schedule.html') {
        initializeSchedule();
    } else if (page === 'orders.html') {
        initializeOrders();
    } else if (page === 'dispatch.html') {
        initializeDispatch(); 
    }
});