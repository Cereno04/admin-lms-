// js/page-handlers.js
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
   ORDERS PAGE LOGIC
========================================================= */
export function initializeOrders() {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;

    const ordersQuery = query(
        collection(db, "orders"),
        orderBy("timestamp", "desc")
    );

    onSnapshot(ordersQuery, (snapshot) => {
        tableBody.innerHTML = '';

        snapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id;

            /* ---- Date Formatting ---- */
            let dateString = "N/A";
            if (order.timestamp) {
                const date = order.timestamp.toDate();
                dateString = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            }

            /* ---- Items Formatting ---- */
            let itemsString = "No items";
            if (Array.isArray(order.selectedItems)) {
                itemsString = order.selectedItems.join(", ");
            } else if (order.selectedItems) {
                itemsString = order.selectedItems;
            }

            /* ---- Status Color ---- */
            let statusColor = "orange";
            if (order.status === "Completed") statusColor = "green";
            if (order.status === "Pickup") statusColor = "blue";

            tableBody.innerHTML += `
                <tr>
                    <td>${dateString}</td>
                    <td>${order.customerName || "Unknown"}</td>
                    <td>${order.address || "N/A"}</td>
                    <td>${order.phone || "N/A"}</td>
                    <td>${order.email || "N/A"}</td>
                    <td>
                        <div style="font-size: 0.85em;">
                            <strong>Items:</strong> ${itemsString}<br>
                            <strong>Total:</strong> ₱${order.totalPrice || 0}
                        </div>
                    </td>
                    <td>${order.comments || "None"}</td>
                    <td>
                        <span style="color:${statusColor}; font-weight:bold;">
                            ${order.status}
                        </span>
                    </td>
                    <td>
                        <select
                            onchange="window.updateOrderStatus('${orderId}', this.value)"
                            style="padding:5px; border-radius:5px;"
                        >
                            <option value="" disabled selected>Action</option>
                            <option value="Pending">Mark Pending</option>
                            <option value="Pickup">Ready for Pickup</option>
                            <option value="Completed">Mark Completed</option>
                        </select>

                        <button
                            onclick="window.deleteOrder('${orderId}')"
                            style="margin-left:5px; background:red; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;"
                        >
                            X
                        </button>
                    </td>
                </tr>
            `;
        });
    });

    /* ---- Global Actions ---- */
    window.updateOrderStatus = async (id, status) => {
        try {
            await updateDoc(doc(db, "orders", id), { status });
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
   CUSTOMERS (Placeholder)
========================================================= */
export function initializeCustomers() {}

/* =========================================================
   RIDER MANAGEMENT (Sequential IDs)
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

    /* ---- Generate Sequential Rider ID ---- */
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

    /* ---- Modal Controls ---- */
    openBtn.onclick = async () => {
        modal.classList.add("active");
        await setSequentialID();
    };

    const hideModal = () => {
        modal.classList.remove("active");
        riderForm.reset();
    };

    closeBtn.onclick = hideModal;
    cancelBtn.onclick = hideModal;

    /* ---- Form Submission ---- */
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

    /* ---- Riders Table Listener ---- */
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
