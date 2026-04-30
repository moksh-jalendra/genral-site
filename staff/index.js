import { auth, rtdb } from "../firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const emailInput = document.getElementById('staff-email');
const passwordInput = document.getElementById('staff-password');
const loginBtn = document.getElementById('staffLoginBtn');
const errorMsg = document.getElementById('error-message');

// Track selected role
let selectedRole = "moderator"; 

// Handle role button clicks
document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        const clickedBtn = e.currentTarget;
        clickedBtn.classList.add('active');
        selectedRole = clickedBtn.getAttribute('data-role');
    });
});

loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError("Please enter both email and password.");
        return;
    }

    loginBtn.innerText = "Authenticating...";
    loginBtn.disabled = true;
    errorMsg.style.display = "none";

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Fetch their actual role from the Realtime Database
        const dbRef = ref(rtdb);
        const staffSnap = await get(child(dbRef, `staff/${user.uid}`));

        if (staffSnap.exists()) {
            const actualRole = staffSnap.val().role; 
            console.log(actualRole)
            
            // --- DOWNWARD ACCESS LOGIC ---
            // Admins can log into ANY dashboard they selected
            if (actualRole === "admin") {
                routeToDashboard(selectedRole);
            } 
            // Regular staff must select their exact role
            else if (actualRole === selectedRole) {
                routeToDashboard(actualRole);
            } 
            // Staff tried to access a department they don't belong to
            else {
                auth.signOut();
                showError(`Access Denied: You do not have permissions for the ${selectedRole.toUpperCase()} department.`);
            }
        } else {
            auth.signOut();
            showError("Unauthorized. You are not registered in the staff database.");
        }

    } catch (error) {
        console.error("Staff Login Error:", error);
        showError("Invalid email or password.");
    } finally {
        loginBtn.innerText = "Access Portal";
        loginBtn.disabled = false;
    }
});

function routeToDashboard(role) {
    if (role === "admin") window.location.href = "admin-dashboard.html";
    else if (role === "commercial") window.location.href = "commercial.html";
    else if (role === "management") window.location.href = "management.html";
    else if (role === "moderator") window.location.href = "mod-dashboard.html";
}

function showError(message) {
    errorMsg.innerText = message;
    errorMsg.style.display = "block";
}