import { db } from './firebase-core.js';

import {
    collection,
    onSnapshot,
    query,
    orderBy,
    doc,
    updateDoc,
    deleteDoc,
    setDoc,
    getDoc,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/* =========================================================
   DASHBOARD
========================================================= */
export function initializeDashboard() {
    console.log("Dashboard initialized");
}

/* =========================================================
   ORDERS PAGE LOGIC (UPDATED)
========================================================= */
export function initializeOrders() {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;

    const ordersQuery = query(collection(db, "orders"));

    onSnapshot(ordersQuery, (snapshot) => {
        let rowsHtml = '';

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">No orders found in database</td></tr>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id;

            // Data Mapping Fallbacks
            const fullName = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Unknown Customer";
            const displayPrice = order.totalPrice || order.price || 0;

            let itemsString = "No items";
            const rawItems = order.items || order.selectedItems;
            
            if (Array.isArray(rawItems)) {
                itemsString = rawItems.join(", ");
            } else if (typeof rawItems === 'string') {
                itemsString = rawItems;
            }

            let dateString = "No Date";
            if (order.timestamp && typeof order.timestamp.toDate === 'function') {
                const date = order.timestamp.toDate();
                dateString = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            } else if (order.createdAt) {
                const date = new Date(order.createdAt);
                dateString = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            }

            let statusColor = "orange";
            const status = order.status || "Pending"; 
            if (status === "Completed") statusColor = "green";
            if (status === "Pickup") statusColor = "blue";

            rowsHtml += `
                <tr>
                    <td>${dateString}</td>
                    <td>${fullName}</td>
                    <td>${order.address || "N/A"}</td>
                    <td>${order.phone || "N/A"}</td>
                    <td>${order.email || "N/A"}</td>
                    <td>
                        <div style="font-size: 0.85em; max-width: 200px; overflow-wrap: break-word;">
                            <strong>Items:</strong> ${itemsString}<br>
                            <strong>Total:</strong> ₱${displayPrice}
                        </div>
                    </td>
                    <td>${order.comments || "None"}</td>
                    <td>
                        <span style="color:${statusColor}; font-weight:bold;">
                            ${status}
                        </span>
                    </td>
                    <td>
                        <select
                            onchange="window.updateOrderStatus('${orderId}', this.value)"
                            style="padding:5px; border-radius:5px; margin-bottom: 5px;"
                        >
                            <option value="" disabled selected>Update</option>
                            <option value="Pending">Pending</option>
                            <option value="Pickup">Ready for Pickup</option>
                            <option value="Completed">Completed</option>
                        </select>

                        <button
                            onclick="window.deleteOrder('${orderId}')"
                            style="background:red; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = rowsHtml;
    });

    window.updateOrderStatus = async (id, status) => {
        try {
            await updateDoc(doc(db, "orders", id), { status: status });
            console.log("Status updated to", status);
        } catch (err) {
            alert("Error updating status: " + err.message);
        }
    };

    window.deleteOrder = async (id) => {
        if (!confirm("Are you sure you want to delete this order?")) return;
        try {
            await deleteDoc(doc(db, "orders", id));
        } catch (err) {
            alert("Error deleting order: " + err.message);
        }
    };
}

/* =========================================================
   CUSTOMERS
========================================================= */
export function initializeCustomers() {}

/* =========================================================
   RIDER MANAGEMENT
========================================================= */
export function initializeSchedule() {
    const tableBody = document.getElementById('rider-table-body');
    const modal = document.getElementById('riderModal');
    const openBtn = document.getElementById('open-rider-modal');
    const closeBtn = document.getElementById('close-rider-modal');
    const cancelBtn = document.getElementById('cancel-rider');
    const riderForm = document.getElementById('rider-form');
    const riderIdInput = document.getElementById('rider-id');

    if (!tableBody) return;

    const setSequentialID = async () => {
        try {
            const snapshot = await getDocs(collection(db, "riders"));
            let maxNum = 0;

            snapshot.forEach(docSnap => {
                const riderId = docSnap.data().riderId;
                if (riderId?.startsWith("RDR-")) {
                    const num = parseInt(riderId.split("-")[1]);
                    if (!isNaN(num) && num > maxNum) maxNum = num;
                }
            });

            riderIdInput.value = `RDR-${String(maxNum + 1).padStart(4, "0")}`;
        } catch (err) {
            console.error("ID generation error:", err);
            riderIdInput.value = "RDR-0001";
        }
    };

    if(openBtn) {
        openBtn.onclick = async () => {
            modal.classList.add("active");
            await setSequentialID();
        };
    }

    const hideModal = () => {
        if(modal) {
            modal.classList.remove("active");
            if(riderForm) riderForm.reset();
        }
    };

    if(closeBtn) closeBtn.onclick = hideModal;
    if(cancelBtn) cancelBtn.onclick = hideModal;

    if(riderForm) {
        riderForm.onsubmit = async (e) => {
            e.preventDefault();

            const riderId = riderIdInput.value.trim();
            const riderRef = doc(db, "riders", riderId);

            try {
                const existing = await getDoc(riderRef);
                if (existing.exists()) {
                    alert(`This account already exists! (ID: ${riderId})`);
                    return;
                }

                await setDoc(riderRef, {
                    riderId,
                    name: document.getElementById('rider-name').value,
                    email: document.getElementById('rider-email').value,
                    phone: document.getElementById('rider-phone').value,
                    password: document.getElementById('rider-password').value,
                    status: "Active",
                    role: "rider",
                    createdAt: new Date()
                });

                alert("Rider registered successfully!");
                hideModal();
            } catch (err) {
                alert("Error saving rider: " + err.message);
            }
        };
    }

    const ridersQuery = query(
        collection(db, "riders"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(ridersQuery, (snapshot) => {
        tableBody.innerHTML = '';

        snapshot.forEach((docSnap) => {
            const rider = docSnap.data();

            tableBody.innerHTML += `
                <tr>
                    <td>${rider.riderId}</td>
                    <td>${rider.name}</td>
                    <td>${rider.email}</td>
                    <td>${rider.phone}</td>
                    <td><span class="status-badge completed">Active</span></td>
                    <td>
                        <button
                            onclick="window.deleteRider('${docSnap.id}')"
                            style="background:none; border:none; color:red; cursor:pointer;"
                        >
                            <span class="material-icons-sharp">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        });
    });

    window.deleteRider = async (id) => {
        if (!confirm("Remove this rider?")) return;
        await deleteDoc(doc(db, "riders", id));
    };
}

/* =========================================================
   DISPATCH CENTER (NEW FUNCTION)
========================================================= */
export function initializeDispatch() {
    const ordersContainer = document.getElementById('dispatch-orders-container');
    const fleetContainer = document.getElementById('dispatch-fleet-container');

    // 1. Fetch ALL Orders for the Pipeline
    if (ordersContainer) {
        // Query all orders (no filter, as requested)
        const ordersQuery = query(collection(db, "orders"));

        onSnapshot(ordersQuery, (snapshot) => {
            let html = '';

            if (snapshot.empty) {
                ordersContainer.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">No active orders found.</p>';
                return;
            }

            snapshot.forEach((docSnap) => {
                const order = docSnap.data();
                const orderId = docSnap.id;
                
                // --- Data Mapping (Same as Orders Page) ---
                const fullName = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Unknown";
                const displayPrice = order.totalPrice || order.price || 0;
                
                // Truncate ID for display (e.g., #1 or abcd...)
                const displayId = orderId.length > 5 ? orderId.substring(0,5).toUpperCase() : orderId;
                
                // Status Badge Color logic for the card
                let statusColor = "#f97316"; // Orange (Pending)
                if (order.status === "Completed") statusColor = "#10b981"; // Green
                if (order.status === "Pickup") statusColor = "#0077B6"; // Blue

                html += `
                <div class="order-card" style="border-left: 5px solid ${statusColor};">
                    <div class="card-top">
                        <span class="order-id" style="color:#64748b;">ORDER #${displayId}</span>
                        <span class="order-price">₱${displayPrice}</span>
                    </div>
                    <div class="card-body">
                        <h3>${fullName}</h3>
                        <div class="card-address">
                            <span class="material-icons-sharp" style="font-size: 16px;">location_on</span>
                            <span>${order.address || "No Address Provided"}</span>
                        </div>
                        <div style="margin-bottom:10px; font-size:0.8rem; color:${statusColor}; font-weight:bold; text-transform:uppercase;">
                            Status: ${order.status || "Pending"}
                        </div>
                        <button class="assign-btn" onclick="window.assignRider('${orderId}')">
                            <span class="material-icons-sharp" style="font-size: 18px;">person_add</span>
                            Assign Rider
                        </button>
                    </div>
                </div>
                `;
            });

            ordersContainer.innerHTML = html;
        });
    }

    // 2. Fetch Riders for Fleet Availability
    if (fleetContainer) {
        const ridersQuery = query(collection(db, "riders"));

        onSnapshot(ridersQuery, (snapshot) => {
            let html = '';

            if (snapshot.empty) {
                fleetContainer.innerHTML = '<p style="color:#888;">No riders registered.</p>';
                return;
            }

            snapshot.forEach((docSnap) => {
                const rider = docSnap.data();
                
                // Initials for Avatar
                const initial = rider.name ? rider.name.charAt(0).toUpperCase() : "?";
                
                // Determine Status (This implies you might add a 'status' field to riders later. Defaulting to Active)
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
                </div>
                `;
            });

            fleetContainer.innerHTML = html;
        });
    }

    // Placeholder function for the Assign button
    window.assignRider = (orderId) => {
        alert(`Assigning rider for Order ID: ${orderId}\n(This feature can be connected to a modal later!)`);
    };
}