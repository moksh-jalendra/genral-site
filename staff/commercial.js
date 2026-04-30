import { db, auth, rtdb } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await get(child(ref(rtdb), `staff/${user.uid}`));
        if (snap.exists() && (snap.val().role === "commercial" || snap.val().role === "admin")) {
            loadRedemptions();
            loadWithdrawals();
        } else window.location.href = "index.html";
    } else window.location.href = "index.html";
});

// NEW: Send a notification directly to a user
window.sendCommercialNotification = async () => {
    const targetUid = document.getElementById('notify-target-uid').value.trim();
    const message = document.getElementById('notify-message').value.trim();

    if (!targetUid || !message) return alert("Please enter both User ID and Message.");

    try {
        await addDoc(collection(db, "notifications"), {
            target: "individual",
            userId: targetUid,
            title: "Finance & Support Update",
            message: message,
            type: "info",
            timestamp: new Date()
        });
        alert("Notification sent successfully!");
        document.getElementById('notify-target-uid').value = '';
        document.getElementById('notify-message').value = '';
    } catch (error) {
        alert("Error sending notification.");
    }
};

async function loadRedemptions() {
    const tbody = document.getElementById('redemptions-body');
    const snap = await getDocs(query(collection(db, "redemptions"), where("status", "==", "processing")));
    tbody.innerHTML = "";
    if (snap.empty) return tbody.innerHTML = "<tr><td colspan='4'>No pending redemptions.</td></tr>";

    snap.forEach(d => {
        const req = d.data();
        tbody.innerHTML += `
            <tr>
                <td>${req.userId}</td>
                <td>${req.rewardName || req.rewardTitle}</td>
                <td>${req.cost} Coins</td>
                <td>
                    <button onclick="processGiftCard('${d.id}', '${req.userId}', true, ${req.cost})">Send Code</button>
                    <button class="reject" onclick="processGiftCard('${d.id}', '${req.userId}', false, ${req.cost})">Reject</button>
                </td>
            </tr>`;
    });
}

async function loadWithdrawals() {
    const tbody = document.getElementById('withdrawals-body');
    const snap = await getDocs(query(collection(db, "withdrawals"), where("status", "==", "pending")));
    tbody.innerHTML = "";
    if (snap.empty) return tbody.innerHTML = "<tr><td colspan='4'>No pending cash withdrawals.</td></tr>";

    snap.forEach(d => {
        const req = d.data();
        tbody.innerHTML += `
            <tr>
                <td>${req.userEmail || req.userId}</td><td>${req.amount} Coins</td><td>${req.method ? req.method.toUpperCase() : 'N/A'}: ${req.details || 'N/A'}</td>
                <td>
                    <button onclick="payCash('${d.id}', '${req.userId}', true)">Mark Paid</button>
                    <button class="reject" onclick="payCash('${d.id}', '${req.userId}', false)">Reject</button>
                </td>
            </tr>`;
    });
}

window.processGiftCard = async (reqId, userId, isApproved, cost) => {
    let secretCode = "";
    if (isApproved) {
        secretCode = prompt("Enter the Gift Card / Voucher Code to send to the user:");
        if (!secretCode) {
            alert("You must enter a code to approve this redemption.");
            return; 
        }
    } else {
        const confirmReject = confirm(`Are you sure you want to reject this and refund ${cost} coins?`);
        if (!confirmReject) return;
    }

    try {
        const res = await fetch("https://promptlypi-backend.onrender.com/staff/process-redemption", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                staffUid: auth.currentUser.uid,
                reqId: reqId,
                userId: userId,
                isApproved: isApproved,
                secretCode: secretCode,
                cost: cost
            })
        });
        const data = await res.json();
        alert(data.message);
        loadRedemptions(); 
    } catch (e) {
        console.error(e);
        alert("Error connecting to secure server.");
    }
};

window.payCash = async (reqId, userId, isApproved) => {
    try {
        const res = await fetch("https://promptlypi-backend.onrender.com/staff/process-withdrawal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ staffUid: auth.currentUser.uid, reqId: reqId, userId: userId, isApproved: isApproved })
        });
        const data = await res.json();
        alert(data.message);
        loadWithdrawals(); 
    } catch (e) { alert("Error connecting to secure server."); }
};