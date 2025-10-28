from flask import Blueprint, request, jsonify, session

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    # Simple authentication (in production, use proper auth with hashing)
    if username == 'admin' and password == 'admin':
        session['user'] = username
        session['authenticated'] = True
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': username
        })
    else:
        return jsonify({
            'success': False,
            'message': 'Invalid credentials'
        }), 401

@auth_bp.route('/api/check-auth')
def check_auth():
    if session.get('authenticated'):
        return jsonify({'authenticated': True, 'user': session.get('user')})
    return jsonify({'authenticated': False})

@auth_bp.route('/api/logout')
def logout():
    session.clear()
    return jsonify({'success': True})