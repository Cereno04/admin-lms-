import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, 
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

// --- FIREBASE CONFIGURATION ---
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
//  GLOBAL: INITIALIZE ORDERS (Admin Dashboard)
// ======================================================
export function initializeOrders() {
    const tableBody = document.getElementById('orders-table-body');
    
    // --- UPDATE STATUS FUNCTION (SYNCED) ---
    window.updateOrderStatus = async (orderId, newStatus) => {
        // Confirmation dialog
        if (!confirm(`Are you sure you want to update this order to "${newStatus}"?`)) {
            return; 
        }

        try {
            console.log(`Starting update for Order ID: ${orderId} to Status: ${newStatus}`);

            // 1. Reference the Global Order
            const globalOrderRef = doc(db, "orders", orderId);
            const globalSnap = await getDoc(globalOrderRef);

            if (!globalSnap.exists()) {
                alert("Error: Order ID not found in database!");
                return;
            }

            const orderData = globalSnap.data();
            const userId = orderData.userId; // This identifies which user owns the order

            // 2. Update the Global Order Collection
            await updateDoc(globalOrderRef, { 
                status: newStatus,
                updatedAt: new Date()
            });

            // 3. Sync to User's Personal Collection (Ensures App List updates)
            if (userId) {
                const userOrderRef = doc(db, "users", userId, "bookings", orderId);
                
                // Using setDoc with merge: true acts like update but creates if missing (safety net)
                await setDoc(userOrderRef, { 
                    status: newStatus,
                    updatedAt: new Date()
                }, { merge: true });

                console.log(`Successfully synced status to User ID: ${userId}`);
            } else {
                console.warn("Warning: This order has no userId attached.");
            }
            
            alert(`Status successfully updated to: ${newStatus}`);

        } catch (error) {
            console.error("Update failed:", error);
            alert("Error updating status: " + error.message);
        }
    };

    window.deleteOrder = async (id) => {
        if (!confirm("Permanently delete this order?")) return;
        try {
            await deleteDoc(doc(db, "orders", id));
            alert("Order deleted.");
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    // --- RENDER TABLE ---
    if (!tableBody) return;

    // Listen to real-time updates
    const ordersQuery = query(collection(db, "orders"));

    onSnapshot(ordersQuery, (snapshot) => {
        let rowsHtml = '';

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">No orders found</td></tr>';
            return;
        }

        // Sort by timestamp descending (Newest first)
        const docs = [];
        snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => {
            const tA = a.timestamp?.seconds || 0;
            const tB = b.timestamp?.seconds || 0;
            return tB - tA; 
        });

        docs.forEach((order, index) => {
            const orderId = order.id;
            // Handle name variations
            const fullName = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Unknown";
            const displayPrice = order.totalPrice || order.price || 0;
            
            // Format Date
            let dateString = "N/A";
            if (order.timestamp && typeof order.timestamp.toDate === 'function') {
                dateString = order.timestamp.toDate().toLocaleDateString();
            }

            // Normalize Status
            const status = order.status || "Pending"; 

            // Select Dropdown Logic
            const isPending = status === "Pending" ? "selected" : "";
            const isProcessing = (status === "Processing") ? "selected" : "";
            const isPickup = (status === "Ready for Pickup" || status === "Pickup") ? "selected" : "";
            const isDelivery = (status === "Out for Delivery") ? "selected" : "";
            const isCompleted = (status === "Completed") ? "selected" : "";

            // Status Badge Color Logic
            let statusColor = "#f97316"; 
            if (status === "Processing") statusColor = "#3b82f6";
            if (status === "Ready for Pickup" || status === "Pickup") statusColor = "#a855f7"; 
            if (status === "Out for Delivery") statusColor = "#eab308";
            if (status === "Completed") statusColor = "#22c55e"; 

            // Handle Items Display
            let itemsDisplay = order.selectedItems || "No items";
            if (Array.isArray(itemsDisplay)) {
                itemsDisplay = itemsDisplay.join(", ");
            }

            rowsHtml += `
                <tr>
                    <td>#${index + 1}</td>
                    <td>${dateString}</td>
                    <td><b>${fullName}</b></td>
                    <td>${order.address || "N/A"}</td>
                    <td>${order.phone || "N/A"}</td>
                    <td><div style="max-height:50px; overflow-y:auto; font-size:12px;">${itemsDisplay}</div></td>
                    <td>₱${displayPrice}</td>
                    <td>
                        <span style="color:${statusColor}; font-weight:bold; display:block; margin-bottom:5px;">${status}</span>
                    </td>
                    <td>
                        <select onchange="window.updateOrderStatus('${orderId}', this.value)" style="padding:5px; border-radius:4px; border:1px solid #ddd; cursor:pointer;">
                            <option value="Pending" ${isPending}>Pending</option>
                            <option value="Processing" ${isProcessing}>Processing</option>
                            <option value="Ready for Pickup" ${isPickup}>Ready for Pickup</option>
                            <option value="Out for Delivery" ${isDelivery}>Out for Delivery</option>
                            <option value="Completed" ${isCompleted}>Completed</option>
                        </select>
                        <button onclick="window.deleteOrder('${orderId}')" style="margin-left:5px; color:red; border:none; background:none; cursor:pointer;" title="Delete Order">
                            <span class="material-icons-sharp">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = rowsHtml;
    });
}

// ======================================================
//  RIDER MANAGEMENT
// ======================================================
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
                if (riderId && riderId.startsWith("RDR-")) {
                    const num = parseInt(riderId.split("-")[1]);
                    if (!isNaN(num) && num > maxNum) maxNum = num;
                }
            });
            riderIdInput.value = `RDR-${String(maxNum + 1).padStart(4, "0")}`;
        } catch (err) {
            riderIdInput.value = "RDR-0001";
        }
    };

    if(openBtn) {
        openBtn.onclick = async () => {
            if(modal) modal.classList.add("active");
            if(riderIdInput) await setSequentialID();
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
                    alert(`Account exists!`);
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
                alert("Rider registered!");
                hideModal();
            } catch (err) {
                alert("Error: " + err.message);
            }
        };
    }

    const ridersQuery = query(collection(db, "riders"), orderBy("createdAt", "desc"));
    onSnapshot(ridersQuery, (snapshot) => {
        tableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const rider = docSnap.data();
            tableBody.innerHTML += `
                <tr>
                    <td>${rider.riderId || docSnap.id}</td>
                    <td>${rider.name}</td>
                    <td>${rider.email}</td>
                    <td>${rider.phone}</td>
                    <td><span class="status-badge completed">Active</span></td>
                    <td>
                        <button onclick="window.deleteRider('${docSnap.id}')" style="background:none; border:none; color:red; cursor:pointer;">
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

// ======================================================
//  DISPATCH CENTER
// ======================================================
export function initializeDispatch() {
    const ordersContainer = document.getElementById('dispatch-orders-container');
    const fleetContainer = document.getElementById('dispatch-fleet-container');

    // 1. Assign Rider Logic
    window.assignRider = async (orderId) => {
        const riderId = prompt("Enter Rider ID to assign (e.g., RDR-0001):");
        if (!riderId) return;

        try {
            // Update Global Order
            const orderRef = doc(db, "orders", orderId);
            const orderSnap = await getDoc(orderRef);
            
            if (!orderSnap.exists()) {
                alert("Order not found!");
                return;
            }

            const riderName = "Assigned Rider"; // Ideally fetch real name from riders collection

            // Update Global Order
            await updateDoc(orderRef, {
                status: "Ready for Pickup",
                assignedRiderId: riderId,
                assignedRiderName: riderName,
                updatedAt: new Date()
            });

            // Update User Booking (Sync)
            const userId = orderSnap.data().userId;
            if(userId) {
                const userRef = doc(db, "users", userId, "bookings", orderId);
                await setDoc(userRef, {
                    status: "Ready for Pickup",
                    assignedRiderId: riderId,
                    assignedRiderName: riderName,
                    updatedAt: new Date()
                }, { merge: true });
            }
            alert("Rider Assigned & Status Updated!");
        } catch(e) {
            console.error(e);
            alert("Error assigning rider: " + e.message);
        }
    };

    if (ordersContainer) {
        const ordersQuery = query(collection(db, "orders"));
        onSnapshot(ordersQuery, (snapshot) => {
            let html = '';
            if (snapshot.empty) {
                ordersContainer.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">No active orders.</p>';
                return;
            }
            
            snapshot.forEach((docSnap) => {
                const order = docSnap.data();
                const orderId = docSnap.id;
                
                // Only show active orders in dispatch
                if(order.status === "Completed") return;

                const fullName = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Unknown";
                const displayPrice = order.totalPrice || order.price || 0;
                
                let statusColor = "#f97316"; 
                if (order.status === "Processing") statusColor = "#3b82f6";
                if (order.status === "Ready for Pickup") statusColor = "#a855f7";
                if (order.status === "Out for Delivery") statusColor = "#eab308";

                html += `
                <div class="order-card" style="border-left: 5px solid ${statusColor}; background:#fff; padding:15px; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span style="font-weight:bold; color:#666;">#${orderId.substring(0,5).toUpperCase()}</span>
                        <span style="font-weight:bold; color:#0077B6;">₱${displayPrice}</span>
                    </div>
                    <h3 style="margin:0 0 5px 0;">${fullName}</h3>
                    <p style="color:#666; font-size:12px; margin-bottom:10px;">${order.address || "No Address"}</p>
                    
                    <div style="margin-bottom:15px; font-weight:bold; color:${statusColor};">
                        ${order.status || "Pending"}
                    </div>
                    
                    <button onclick="window.assignRider('${orderId}')" style="width:100%; padding:10px; background:#0077B6; color:white; border:none; border-radius:6px; cursor:pointer;">
                        Assign Rider
                    </button>
                </div>`;
            });
            ordersContainer.innerHTML = html;
        });
    }
}