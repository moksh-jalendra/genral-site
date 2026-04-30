import { db, auth, rtdb } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await get(child(ref(rtdb), `staff/${user.uid}`));
        if (snap.exists() && snap.val().role === "admin") {
            loadModStats();
        } else {
            window.location.href = "index.html";
        }
    } else window.location.href = "index.html";
});

document.getElementById('assignRoleBtn').addEventListener('click', async () => {
    const targetUid = document.getElementById('target-uid').value.trim();
    const role = document.getElementById('role-select').value;
    if (!targetUid) return alert("Enter a UID.");

    try {
        const res = await fetch("https://promptlypi-backend.onrender.com/staff/assign-role", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                staffUid: auth.currentUser.uid,
                targetUid: targetUid,
                newRole: role
            })
        });
        
        const data = await res.json();
        alert(data.message);
        
    } catch (e) { 
        alert("Error connecting to secure server."); 
    }
});

async function loadModStats() {
    const tbody = document.getElementById('mod-table-body');
    try {
        const staffSnap = await get(child(ref(rtdb), `staff`));
        tbody.innerHTML = "";
        
        staffSnap.forEach((childSnap) => {
            if (childSnap.val().role === "moderator") {
                const modId = childSnap.key;
                getDocs(query(collection(db, "users"), where("invitedBy", "==", modId))).then(userSnap => {
                    tbody.innerHTML += `<tr><td>${modId}</td><td>${userSnap.size} Users</td></tr>`;
                });
            }
        });
    } catch (e) { tbody.innerHTML = "<tr><td colspan='2'>Error loading stats.</td></tr>"; }
}

// NEW: Manual Database Sweeper
window.triggerDatabaseSweep = async () => {
    if (!auth.currentUser) return alert("System Error: Not logged in.");
    
    if (!confirm("Are you sure you want to sweep the view logs database? This permanently deletes view records older than 24 hours.")) return;

    const sweepBtn = document.getElementById('sweepButton');
    const originalText = sweepBtn.innerText;
    sweepBtn.innerText = "Sweeping... Please wait.";
    sweepBtn.disabled = true;

    try {
        const res = await fetch("https://promptlypi-backend.onrender.com/staff/cleanup-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ staffUid: auth.currentUser.uid })
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert(data.message); 
        } else {
            alert("Sweep failed: " + data.message);
        }
    } catch (error) {
        alert("Error connecting to server for cleanup.");
        console.error(error);
    } finally {
        sweepBtn.innerText = originalText;
        sweepBtn.disabled = false;
    }
};