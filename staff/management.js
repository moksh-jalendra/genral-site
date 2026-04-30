import { db, auth, rtdb } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { collection, addDoc, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await get(child(ref(rtdb), `staff/${user.uid}`));
        if (!snap.exists() || (snap.val().role !== "management" && snap.val().role !== "admin")) {
            window.location.href = "index.html";
        } else {
            loadActiveRewards();
        }
    } else window.location.href = "index.html";
});

document.getElementById('addRewardBtn').addEventListener('click', async () => {
    const title = document.getElementById('reward-title').value;
    const cost = parseInt(document.getElementById('reward-cost').value);
    const img = document.getElementById('reward-image').value;

    if (!title || !cost) return alert("Required fields missing.");
    await addDoc(collection(db, "rewards_store"), { title, cost, image: img, active: true });
    alert("Live on Redeem Store!");
    
    // Clear inputs and reload table
    document.getElementById('reward-title').value = '';
    document.getElementById('reward-cost').value = '';
    document.getElementById('reward-image').value = '';
    loadActiveRewards();
});

document.getElementById('sendNotifBtn').addEventListener('click', async () => {
    const title = document.getElementById('notif-title').value;
    const message = document.getElementById('notif-body').value;

    if (!title || !message) return alert("Required fields missing.");
    
    if(!confirm("Are you absolutely sure you want to send this to EVERY user?")) return;

    await addDoc(collection(db, "notifications"), { target: "all", title, message, type: "system", timestamp: new Date() });
    alert("Global Alert Sent.");
    document.getElementById('notif-title').value = '';
    document.getElementById('notif-body').value = '';
});

// NEW: Load and display active rewards
async function loadActiveRewards() {
    const tbody = document.getElementById('active-rewards-body');
    const snap = await getDocs(collection(db, "rewards_store"));
    
    tbody.innerHTML = "";
    if (snap.empty) return tbody.innerHTML = "<tr><td colspan='3'>Store is empty.</td></tr>";

    snap.forEach(d => {
        const reward = d.data();
        tbody.innerHTML += `
            <tr>
                <td>${reward.title}</td>
                <td>${reward.cost} Coins</td>
                <td>
                    <button class="btn-delete" onclick="removeReward('${d.id}', '${reward.title}')">Remove</button>
                </td>
            </tr>`;
    });
}

// NEW: Remove a reward from the store directly via Firestore
window.removeReward = async (rewardId, title) => {
    if (!confirm(`Are you sure you want to permanently delete '${title}' from the store?`)) return;

    try {
        await deleteDoc(doc(db, "rewards_store", rewardId));
        alert("Reward deleted from store.");
        loadActiveRewards();
    } catch (error) {
        alert("Error deleting reward.");
    }
};

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));