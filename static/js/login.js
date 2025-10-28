class LoginManager {
    constructor() {
        this.init();
    }

    init() {
        console.log('🔐 Initializing Login Manager...');
        this.setupEventListeners();
        this.checkExistingAuth();
    }

    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Enter key support
        const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
        inputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleLogin();
                }
            });
        });
    }

    async checkExistingAuth() {
        try {
            const response = await fetch('/api/check-auth');
            const data = await response.json();
            
            if (data.authenticated) {
                window.location.href = '/';
            }
        } catch (error) {
            console.log('No existing auth session');
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const submitBtn = document.querySelector('#login-form button[type="submit"]');
        const errorDiv = document.getElementById('error-message');

        // Basic validation
        if (!username || !password) {
            this.showError('Please enter both username and password');
            return;
        }

        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Login successful');
                this.showSuccess('Login successful! Redirecting...');
                
                // Redirect to dashboard after short delay
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                this.showError(data.message || 'Login failed');
            }

        } catch (error) {
            console.error('❌ Login error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            // Restore button state
            submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            submitBtn.disabled = false;
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.innerHTML = `
                <div class="alert alert-error">
                    <i class="fas fa-exclamation-circle"></i>
                    ${message}
                </div>
            `;
            errorDiv.style.display = 'block';
        }
    }

    showSuccess(message) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i>
                    ${message}
                </div>
            `;
            errorDiv.style.display = 'block';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.loginManager = new LoginManager();
});