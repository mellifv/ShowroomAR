// auth-check.js - Manage authentication state in navigation
class AuthManager {
    static updateNavigation() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const navAuth = document.getElementById('nav-auth');
        
        if (!navAuth) return;
        
        if (token && user) {
            // User is logged in - show welcome message and logout
            navAuth.innerHTML = `
                <span class="user-welcome">Welcome, ${user.name}</span>
                <button class="btn-logout" onclick="AuthManager.logout()">Logout</button>
            `;
        } else {
            // User is not logged in - show login/register
            navAuth.innerHTML = `
                <a href="../auth/login.html" class="btn-login">Login</a>
                <a href="../auth/register.html" class="btn-register">Register</a>
            `;
        }
    }
    
    static logout() {
        // Clear authentication data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Update navigation
        this.updateNavigation();
        
        // Redirect to home page
        window.location.href = 'index.html';
    }
}

// Update navigation when page loads
document.addEventListener('DOMContentLoaded', function() {
    AuthManager.updateNavigation();
});

// Also update when coming back to the page
window.addEventListener('storage', function() {
    AuthManager.updateNavigation();
});