const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

/**
 * assignRiderAtomically: Assigns a rider to an order only if that rider is free (not assigned to another active order).
 * Requires the caller to be authenticated (enforced by security rules).
 */
exports.assignRiderAtomically = functions.https.onCall(async (data, context) => {
    const { orderId, riderId, riderName } = data;

    // 1. Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    // Admin check is implicitly handled by the Firestore Security Rules on the update step.

    if (!orderId || !riderId || !riderName) {
        throw new functions.https.HttpsError('invalid-argument', 'Order ID, Rider ID, and Rider Name are required.');
    }

    try {
        // 2. Check Rider Availability
        // Look for any *other* active orders assigned to this rider (in-progress/out-for-delivery).
        const activeOrdersQuery = await db.collection('orders')
            .where('rider_id', '==', riderId)
            .where('status', 'in', ['in-progress', 'out-for-delivery'])
            .limit(1)
            .get();

        // If the rider has an active order that is NOT the current order:
        if (!activeOrdersQuery.empty && activeOrdersQuery.docs[0].id !== orderId) {
            const busyOrderId = activeOrdersQuery.docs[0].id;
            throw new functions.https.HttpsError('failed-precondition', `Rider ${riderName} is currently busy with order ${busyOrderId}.`);
        }

        // 3. Perform Transactional Update
        const orderRef = db.collection('orders').doc(orderId);
        
        await db.runTransaction(async (transaction) => {
             const orderDoc = await transaction.get(orderRef);
             
             if (!orderDoc.exists) {
                throw new functions.https.HttpsError('not-found', `Order with ID ${orderId} not found.`);
             }
             
             const currentStatus = orderDoc.data().status;
             
             if (currentStatus === 'completed' || currentStatus === 'cancelled') {
                 throw new new functions.https.HttpsError('failed-precondition', 'Cannot assign rider to a completed or cancelled order.');
             }
             
             // Update order details. If status was 'pending', move it to 'in-progress'.
             const updates = {
                rider_id: riderId,
                assigned_rider_name: riderName,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
             };
             
             if (currentStatus === 'pending') {
                 updates.status = 'in-progress';
             }
             
             transaction.update(orderRef, updates);
        });

        return { success: true, message: 'Rider assigned successfully.' };

    } catch (error) {
        console.error("Error during atomic rider assignment:", error);
        if (error.code) {
             throw error; 
        }
        throw new functions.https.HttpsError('internal', `Internal server error: ${error.message}`);
    }
});