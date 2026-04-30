import { db, auth, rtdb } from "../firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await get(child(ref(rtdb), `staff/${user.uid}`));
        if (snap.exists() && (snap.val().role === "moderator" || snap.val().role === "admin")) {
            
            document.getElementById('invite-link').value = `${window.location.origin}/auth.html?ref=${user.uid}`;
            
            if( snap.val().role === 'admin'){
                loadNetwork('organic');
                loadQueue('admin_queue');
                loadImageQueue('admin_queue')
                return;
            }
            if( snap.val().role === 'moderator'){
                loadNetwork(user.uid);
                loadQueue(user.uid);
                loadImageQueue(user.uid);
                return;
            }
        } else window.location.href = "index.html";
    } else window.location.href = "index.html";
});

// UPDATED: Now fetches engagement stats for the table
async function loadNetwork(modId) {
    const q = query(collection(db, "users"), where("invitedBy", "==", modId));
    const snap = await getDocs(q);
    document.getElementById('network-count').innerText = snap.size;

    const tbody = document.getElementById('invited-users-body');
    tbody.innerHTML = "";

    if (snap.empty) {
        tbody.innerHTML = "<tr><td colspan='4'>No users invited yet.</td></tr>";
        return;
    }

    snap.forEach(docSnap => {
        const data = docSnap.data();
        const views = data.totalLifetimeViews || 0;
        const seconds = data.totalLifetimeSeconds || 0;
        
        tbody.innerHTML += `
            <tr>
                <td>${docSnap.id}</td>
                <td>${views}</td>
                <td>${seconds}s</td>
                <td>
                    <button class="btn-action" onclick="openNotifyCard('${docSnap.id}')">Message</button>
                </td>
            </tr>
        `;
    });
}

// NEW: Opens the notification UI
window.openNotifyCard = (targetUid) => {
    document.getElementById('notify-card').style.display = 'block';
    document.getElementById('notify-title').innerText = `Send Message to ${targetUid}`;
    document.getElementById('notify-target-uid').value = targetUid;
    document.getElementById('notify-message').value = '';
    // Scroll to the card
    document.getElementById('notify-card').scrollIntoView({ behavior: 'smooth' });
};

// NEW: Sends the notification
window.sendUserNotification = async () => {
    const targetUid = document.getElementById('notify-target-uid').value;
    const message = document.getElementById('notify-message').value;

    if (!message) return alert("Message cannot be empty.");

    try {
        await addDoc(collection(db, "notifications"), {
            target: "individual",
            userId: targetUid,
            title: "Message from your Moderator",
            message: message,
            type: "info",
            timestamp: new Date()
        });
        alert("Notification sent successfully!");
        document.getElementById('notify-card').style.display = 'none';
    } catch (error) {
        alert("Error sending notification.");
    }
};

async function loadQueue(modId) {
    const container = document.getElementById('queue-container');
    const q = query(collection(db, "articles"), where("status", "==", "reviewing"), where("assignedMod", "==", modId));
    const snap = await getDocs(q);
    
    container.innerHTML = "";
    if (snap.empty) return container.innerHTML = "<p>Inbox Zero! No articles to review.</p>";

    snap.forEach(docSnap => {
        const data = docSnap.data();
        container.innerHTML += `
            <div class="article-box">
                <h4>${data.title} (By: ${data.authorName})</h4>
                <a href="../article.html?id=${docSnap.id}&source=mod" target="_blank" style="color: #7366ff;">Read Article</a><br><br>
                <button class="btn-approve" onclick="review('${docSnap.id}', 'published')">Approve</button>
                <button class="btn-reject" onclick="review('${docSnap.id}', 'rejected')">Reject</button>
            </div>
        `;
    });
}

window.review = async (articleId, status) => {
    try {
        const res = await fetch("https://promptlypi-backend.onrender.com/staff/review-article", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                staffUid: auth.currentUser.uid,
                articleId: articleId,
                status: status
            })
        });
        const data = await res.json();
        alert(data.message);
        const modId = auth.currentUser.uid; 
        loadQueue(modId);
    } catch (e) {
        alert("Error connecting to server.");
    }
};

async function loadImageQueue(queueName) {
    const container = document.getElementById('image-queue-container');
    const q = query(collection(db, "pending_image_deletions"), where("status", "==", "awaiting_admin_deletion"), where("assignedMod", "==", queueName));
    const snap = await getDocs(q);
    
    container.innerHTML = "";
    if (snap.empty) return container.innerHTML = "<p>Queue is empty! No images to delete.</p>";

    snap.forEach(docSnap => {
        const data = docSnap.data();
        container.innerHTML += `
            <div class="article-box">
                <img src="${data.imageUrl}" style="max-height: 80px; border-radius: 5px; margin-bottom: 10px;"><br>
                <a href="${data.deleteUrl}" target="_blank" style="color: #f73164; font-weight: bold; text-decoration: none;">1. Open ImgBB Delete Link</a><br><br>
                <button class="btn-approve" onclick="clearImageQueue('${docSnap.id}', '${queueName}')">2. Mark as Cleared</button>
            </div>
        `;
    });
}

window.clearImageQueue = async (queueId, queueName) => {
    try {
        const res = await fetch("https://promptlypi-backend.onrender.com/staff/clear-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                staffUid: auth.currentUser.uid,
                queueId: queueId
            })
        });
        const data = await res.json();
        if (data.success) {
            loadImageQueue(queueName); 
        } else {
            alert("Error clearing image.");
        }
    } catch (e) { alert("Server error."); }
};