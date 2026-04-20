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
//  1. ORDERS MANAGEMENT (Fetching & Table UI)
// ======================================================
export function initializeOrders() {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;

    // Helper for Status Updates
    window.updateOrderStatus = async (orderId, newStatus) => {
        if (!confirm(`Update order to "${newStatus}"?`)) return;

        try {
            const globalOrderRef = doc(db, "orders", orderId);
            const globalSnap = await getDoc(globalOrderRef);

            if (!globalSnap.exists()) {
                alert("Order not found in database.");
                return;
            }

            const orderData = globalSnap.data();
            const userId = orderData.userId; 

            // Update Main Orders Collection
            await updateDoc(globalOrderRef, { 
                status: newStatus,
                updatedAt: new Date()
            });

            // Sync to User's Private Subcollection
            if (userId) {
                const userOrderRef = doc(db, "users", userId, "bookings", orderId);
                await setDoc(userOrderRef, { 
                    status: newStatus,
                    updatedAt: new Date()
                }, { merge: true });
            } 
            alert(`Updated to: ${newStatus}`);
        } catch (error) {
            alert("Update failed: " + error.message);
        }
    };

    window.deleteOrder = async (id) => {
        if (!confirm("Permanently delete this order?")) return;
        try {
            await deleteDoc(doc(db, "orders", id));
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    // Real-time listener for ALL orders
    const ordersQuery = query(collection(db, "orders"), orderBy("timestamp", "desc"));

    onSnapshot(ordersQuery, (snapshot) => {
        let rowsHtml = '';
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">No orders found in database</td></tr>';
            return;
        }

        snapshot.forEach((docSnap, index) => {
            const order = docSnap.data();
            const orderId = docSnap.id;
            
            // Robust Field Mapping (Handles Flutter & Web versions)
            const fullName = order.fullName || order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim() || "Guest";
            const displayPrice = order.totalPrice || order.price || 0;
            const phone = order.phone || order.contact || "N/A";
            const status = order.status || "Pending";

            let dateString = "N/A";
            if (order.timestamp?.toDate) {
                dateString = order.timestamp.toDate().toLocaleDateString();
            } else if (order.createdAt) {
                dateString = new Date(order.createdAt).toLocaleDateString();
            }

            // UI Color Logic
            let statusColor = "#f97316"; 
            if (status.includes("Processing")) statusColor = "#3b82f6";
            if (status.includes("Pickup")) statusColor = "#a855f7"; 
            if (status.includes("Delivery")) statusColor = "#eab308";
            if (status === "Completed" || status === "Done") statusColor = "#22c55e"; 

            let itemsDisplay = order.selectedItems || order.items || "No items";
            if (Array.isArray(itemsDisplay)) itemsDisplay = itemsDisplay.join(", ");

            rowsHtml += `
                <tr>
                    <td>#${index + 1}</td>
                    <td>${dateString}</td>
                    <td><b>${fullName}</b></td>
                    <td>${order.address || "N/A"}</td>
                    <td>${phone}</td>
                    <td><div style="max-height:50px; overflow-y:auto; font-size:12px;">${itemsDisplay}</div></td>
                    <td>₱${displayPrice}</td>
                    <td><span style="color:${statusColor}; font-weight:bold;">${status}</span></td>
                    <td>
                        <select onchange="window.updateOrderStatus('${orderId}', this.value)" style="padding:4px; border-radius:4px;">
                            <option value="Pending" ${status==='Pending'?'selected':''}>Pending</option>
                            <option value="Processing" ${status==='Processing'?'selected':''}>Processing</option>
                            <option value="Ready for Pickup" ${status==='Ready for Pickup'?'selected':''}>Ready for Pickup</option>
                            <option value="Out for Delivery" ${status==='Out for Delivery'?'selected':''}>Out for Delivery</option>
                            <option value="Completed" ${status==='Completed'?'selected':''}>Completed</option>
                        </select>
                        <button onclick="window.deleteOrder('${orderId}')" style="margin-left:5px; color:red; border:none; background:none; cursor:pointer;">
                            <span class="material-icons-sharp" style="font-size:18px;">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = rowsHtml;
    });
}

// ======================================================
//  2. RIDER MANAGEMENT
// ======================================================
export function initializeSchedule() {
    const tableBody = document.getElementById('rider-table-body');
    const modal = document.getElementById('riderModal');
    const openBtn = document.getElementById('open-rider-modal');
    const riderForm = document.getElementById('rider-form');

    if (!tableBody) return;

    if(openBtn) {
        openBtn.onclick = async () => {
            modal.classList.add("active");
            const snapshot = await getDocs(collection(db, "riders"));
            document.getElementById('rider-id').value = `RDR-${String(snapshot.size + 1).padStart(4, "0")}`;
        };
    }

    if(riderForm) {
        riderForm.onsubmit = async (e) => {
            e.preventDefault();
            try {
                const rId = document.getElementById('rider-id').value;
                await setDoc(doc(db, "riders", rId), {
                    riderId: rId,
                    name: document.getElementById('rider-name').value,
                    email: document.getElementById('rider-email').value,
                    phone: document.getElementById('rider-phone').value,
                    password: document.getElementById('rider-password').value,
                    motorcycle: document.getElementById('rider-motorcycle').value,
                    plateNumber: document.getElementById('rider-plate').value,
                    status: "Active",
                    role: "rider",
                    createdAt: new Date()
                });
                alert("Rider registered!");
                modal.classList.remove("active");
                riderForm.reset();
            } catch (err) { alert(err.message); }
        };
    }

    onSnapshot(query(collection(db, "riders"), orderBy("createdAt", "desc")), (snapshot) => {
        tableBody.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const r = docSnap.data();
            tableBody.innerHTML += `
                <tr>
                    <td>${r.riderId}</td>
                    <td>${r.name}</td>
                    <td>${r.motorcycle} <br><small>${r.plateNumber}</small></td>
                    <td>${r.phone}</td>
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
        if (confirm("Remove rider?")) await deleteDoc(doc(db, "riders", id));
    };
}

// ======================================================
//  3. DISPATCH CENTER (Fixing the "Empty" issue)
// ======================================================
export function initializeDispatch() {
    const ordersContainer = document.getElementById('dispatch-orders-container');
    if (!ordersContainer) return;

    window.assignRider = async (orderId) => {
        const riderId = prompt("Enter Rider ID (e.g., RDR-0001):");
        if (!riderId) return;

        try {
            const riderSnap = await getDoc(doc(db, "riders", riderId));
            if (!riderSnap.exists()) return alert("Rider not found!");

            const riderData = riderSnap.data();
            const updateData = {
                status: "Ready for Pickup",
                assignedRiderId: riderId,
                assignedRiderName: riderData.name,
                assignedRiderPhone: riderData.phone,
                assignedRiderBike: riderData.motorcycle,
                assignedRiderPlate: riderData.plateNumber,
                updatedAt: new Date()
            };

            await updateDoc(doc(db, "orders", orderId), updateData);
            
            // Sync with User
            const orderSnap = await getDoc(doc(db, "orders", orderId));
            const uId = orderSnap.data().userId;
            if(uId) await setDoc(doc(db, "users", uId, "bookings", orderId), updateData, { merge: true });

            alert(`Assigned ${riderData.name}!`);
        } catch(e) { alert(e.message); }
    };

    onSnapshot(collection(db, "orders"), (snapshot) => {
        let html = '';
        const activeOrders = [];
        
        snapshot.forEach(d => {
            const data = d.data();
            // Only show orders that are NOT completed in the Dispatch view
            if(data.status !== "Completed" && data.status !== "Done") {
                activeOrders.push({id: d.id, ...data});
            }
        });

        if (activeOrders.length === 0) {
            ordersContainer.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">No active orders for dispatch.</p>';
            return;
        }

        activeOrders.forEach(order => {
            const fullName = order.fullName || order.customerName || "Customer";
            html += `
            <div class="order-card" style="border-left: 5px solid #3b82f6; background:#fff; padding:15px; border-radius:10px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between;">
                    <span style="font-weight:bold;">#${order.id.substring(0,5).toUpperCase()}</span>
                    <span style="color:#0077B6; font-weight:bold;">₱${order.totalPrice || order.price || 0}</span>
                </div>
                <h3>${fullName}</h3>
                <p style="font-size:12px; color:#666;">${order.address || "No address"}</p>
                <div style="margin: 10px 0; font-weight:bold; color:#f97316;">${order.status || 'Pending'}</div>
                <button onclick="window.assignRider('${order.id}')" style="width:100%; padding:8px; background:#0077B6; color:white; border:none; border-radius:5px; cursor:pointer;">
                    Assign Rider
                </button>
            </div>`;
        });
        ordersContainer.innerHTML = html;
    });
}