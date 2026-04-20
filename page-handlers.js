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
  apiKey: "AIzaSyCjNlxF7tmC2TWdkNUv2oQheeKYQMi-PxY",
  authDomain: "lms-database-d21f6.firebaseapp.com",
  projectId: "lms-database-d21f6",
  storageBucket: "lms-database-d21f6.firebasestorage.app",
  messagingSenderId: "219532292912",
  appId: "1:219532292912:web:102aca94640d5abf6d4ef5",
  measurementId: "G-5KYP8WJ824"
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ======================================================
//  GLOBAL: INITIALIZE ORDERS (Admin Dashboard)
// ======================================================
export function initializeOrders() {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;

    // --- UPDATE STATUS FUNCTION (SYNCED) ---
    window.updateOrderStatus = async (orderId, newStatus) => {
        if (!confirm(`Are you sure you want to update this order to "${newStatus}"?`)) return; 

        try {
            const globalOrderRef = doc(db, "orders", orderId);
            const globalSnap = await getDoc(globalOrderRef);

            if (!globalSnap.exists()) {
                alert("Error: Order ID not found in database!");
                return;
            }

            const orderData = globalSnap.data();
            const userId = orderData.userId; 

            await updateDoc(globalOrderRef, { 
                status: newStatus,
                updatedAt: new Date()
            });

            if (userId) {
                const userOrderRef = doc(db, "users", userId, "bookings", orderId);
                await setDoc(userOrderRef, { 
                    status: newStatus,
                    updatedAt: new Date()
                }, { merge: true });
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

    const ordersQuery = query(collection(db, "orders"));

    // LISTEN FOR DATA (With error catching to fix the 'permission-denied' issue)
    onSnapshot(ordersQuery, (snapshot) => {
        let rowsHtml = '';

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">No orders found</td></tr>';
            return;
        }

        const docs = [];
        snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
        
        // Sort by timestamp
        docs.sort((a, b) => {
            const tA = a.timestamp?.seconds || a.createdAt?.seconds || 0;
            const tB = b.timestamp?.seconds || b.createdAt?.seconds || 0;
            return tB - tA; 
        });

        docs.forEach((order, index) => {
            const orderId = order.id;
            const fullName = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Unknown";
            const displayPrice = order.totalPrice || order.price || 0;
            
            let dateString = "N/A";
            const ts = order.timestamp || order.createdAt;
            if (ts && typeof ts.toDate === 'function') {
                dateString = ts.toDate().toLocaleDateString();
            }

            const status = order.status || "Pending"; 
            const statuses = ["Pending", "Processing", "Ready for Pickup", "Out for Delivery", "Completed"];

            let statusColor = "#f97316"; 
            if (status === "Processing") statusColor = "#3b82f6";
            if (status.includes("Pickup")) statusColor = "#a855f7"; 
            if (status === "Out for Delivery") statusColor = "#eab308";
            if (status === "Completed") statusColor = "#22c55e"; 

            let itemsDisplay = order.selectedItems || "No items";
            if (Array.isArray(itemsDisplay)) itemsDisplay = itemsDisplay.join(", ");

            rowsHtml += `
                <tr>
                    <td>#${index + 1}</td>
                    <td>${dateString}</td>
                    <td><b>${fullName}</b></td>
                    <td>${order.address || "N/A"}</td>
                    <td>${order.phone || "N/A"}</td>
                    <td><div style="max-height:50px; overflow-y:auto; font-size:12px;">${itemsDisplay}</div></td>
                    <td>₱${displayPrice}</td>
                    <td><span style="color:${statusColor}; font-weight:bold;">${status}</span></td>
                    <td>
                        <select onchange="window.updateOrderStatus('${orderId}', this.value)" style="padding:5px; border-radius:4px; border:1px solid #ddd;">
                            ${statuses.map(s => `<option value="${s}" ${status === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                        <button onclick="window.deleteOrder('${orderId}')" style="margin-left:5px; color:red; border:none; background:none; cursor:pointer;">
                            <span class="material-icons-sharp">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = rowsHtml;
    }, (error) => {
        console.error("Firestore Listen Error:", error);
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red; padding:20px;">Permission Denied. Please ensure you are logged in.</td></tr>`;
    });
}

// ======================================================
//  RIDER MANAGEMENT (Sequential ID & Vehicle Info)
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
        } catch (err) { riderIdInput.value = "RDR-0001"; }
    };

    if(openBtn) openBtn.onclick = async () => {
        if(modal) modal.classList.add("active");
        if(riderIdInput) await setSequentialID();
    };

    const hideModal = () => {
        if(modal) { modal.classList.remove("active"); if(riderForm) riderForm.reset(); }
    };

    if(closeBtn) closeBtn.onclick = hideModal;
    if(cancelBtn) cancelBtn.onclick = hideModal;

    if(riderForm) {
        riderForm.onsubmit = async (e) => {
            e.preventDefault();
            const riderId = riderIdInput.value.trim();
            const riderRef = doc(db, "riders", riderId);

            const nameVal = document.getElementById('rider-name')?.value || "";
            const emailVal = document.getElementById('rider-email')?.value || "";
            const phoneVal = document.getElementById('rider-phone')?.value || "";
            const passVal = document.getElementById('rider-password')?.value || "";
            const bikeVal = document.getElementById('rider-motorcycle')?.value || "Standard Bike";
            const plateVal = document.getElementById('rider-plate')?.value || "---";

            try {
                const existing = await getDoc(riderRef);
                if (existing.exists()) { alert(`Account exists!`); return; }
                await setDoc(riderRef, {
                    riderId, name: nameVal, email: emailVal, phone: phoneVal,
                    password: passVal, motorcycle: bikeVal, plateNumber: plateVal,
                    status: "Active", role: "rider", createdAt: new Date()
                });
                alert("Rider registered!");
                hideModal();
            } catch (err) { alert("Error: " + err.message); }
        };
    }

    onSnapshot(query(collection(db, "riders"), orderBy("createdAt", "desc")), (snapshot) => {
        tableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const rider = docSnap.data();
            tableBody.innerHTML += `
                <tr>
                    <td>${rider.riderId || docSnap.id}</td>
                    <td>${rider.name}</td>
                    <td>${rider.motorcycle || 'N/A'} <br> <small>${rider.plateNumber || ''}</small></td>
                    <td>${rider.phone}</td>
                    <td><span class="status-badge completed">Active</span></td>
                    <td>
                        <button onclick="window.deleteRider('${docSnap.id}')" style="background:none; border:none; color:red; cursor:pointer;">
                            <span class="material-icons-sharp">delete</span>
                        </button>
                    </td>
                </tr>`;
        });
    });

    window.deleteRider = async (id) => {
        if (!confirm("Remove this rider?")) return;
        await deleteDoc(doc(db, "riders", id));
    };
}

// ======================================================
//  DISPATCH CENTER (Rider Assignment)
// ======================================================
export function initializeDispatch() {
    const ordersContainer = document.getElementById('dispatch-orders-container');
    if (!ordersContainer) return;

    window.assignRider = async (orderId) => {
        const riderId = prompt("Enter Rider ID (e.g., RDR-0001):");
        if (!riderId) return;

        try {
            const riderSnap = await getDoc(doc(db, "riders", riderId));
            if (!riderSnap.exists()) { alert("Error: Rider ID not found!"); return; }

            const riderData = riderSnap.data();
            const orderRef = doc(db, "orders", orderId);
            const orderSnap = await getDoc(orderRef);
            
            const updateData = {
                status: "Ready for Pickup",
                assignedRiderId: riderId,
                assignedRiderName: riderData.name || "Unknown",
                assignedRiderPhone: riderData.phone || "No Phone",
                assignedRiderBike: riderData.motorcycle || "Standard",
                assignedRiderPlate: riderData.plateNumber || "---",
                updatedAt: new Date()
            };

            await updateDoc(orderRef, updateData);
            const userId = orderSnap.data().userId;
            if(userId) await setDoc(doc(db, "users", userId, "bookings", orderId), updateData, { merge: true });

            alert(`Assigned ${riderData.name} to the order!`);
        } catch(e) { alert("Error: " + e.message); }
    };

    onSnapshot(query(collection(db, "orders")), (snapshot) => {
        let html = '';
        if (snapshot.empty) {
            ordersContainer.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">No active orders.</p>';
            return;
        }
        
        snapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id;
            if(order.status === "Completed") return;

            const fullName = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Unknown";
            const displayPrice = order.totalPrice || order.price || 0;
            let statusColor = "#f97316"; 
            if (order.status === "Processing") statusColor = "#3b82f6";
            if (order.status === "Ready for Pickup") statusColor = "#a855f7";
            if (order.status === "Out for Delivery") statusColor = "#eab308";

            let assignedInfo = order.assignedRiderName ? `<div style="margin-top:10px; font-size:12px; color:#444; background:#f0f9ff; padding:5px; border-radius:4px;">
                <strong>Rider:</strong> ${order.assignedRiderName} <br>
                <strong>Plate:</strong> ${order.assignedRiderPlate || '--'}
            </div>` : "";

            html += `
            <div class="order-card" style="border-left: 5px solid ${statusColor}; background:#fff; padding:15px; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span style="font-weight:bold; color:#666;">#${orderId.substring(0,5).toUpperCase()}</span>
                    <span style="font-weight:bold; color:#0077B6;">₱${displayPrice}</span>
                </div>
                <h3 style="margin:0 0 5px 0;">${fullName}</h3>
                <p style="color:#666; font-size:12px; margin-bottom:10px;">${order.address || "No Address"}</p>
                <div style="margin-bottom:15px; font-weight:bold; color:${statusColor};">${order.status || "Pending"}</div>
                ${assignedInfo}
                <button onclick="window.assignRider('${orderId}')" style="width:100%; padding:10px; margin-top:10px; background:#0077B6; color:white; border:none; border-radius:6px; cursor:pointer;">
                    ${order.assignedRiderId ? "Re-Assign Rider" : "Assign Rider"}
                </button>
            </div>`;
        });
        ordersContainer.innerHTML = html;
    });
}