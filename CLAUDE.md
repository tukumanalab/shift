# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a simple Japanese Google Login web application demonstrating OAuth2 authentication using Google Identity Services (GSI). The application consists of pure HTML, CSS, and vanilla JavaScript without any build system or package management.

## Development Commands

### Running the Application
Start a local development server using one of these commands:

```bash
# npm (recommended)
npm run dev

# Node.js with http-server
npx http-server

# Python 3
python -m http.server 3000

# PHP (if available)
php -S localhost:3000
```

Access the application at `http://localhost:8080` (default http-server port)

### File Serving Requirements
- Must run on localhost or HTTPS (Google OAuth requirement)
- Port 3000 is configured in Google Cloud Console settings

## Architecture

### File Structure
- `index.html` - Single-page application with embedded CSS
- `app.js` - Authentication logic and DOM manipulation
- `README.md` - Japanese documentation with setup instructions

### Authentication Flow
1. Google Identity Services initializes on page load
2. User clicks Google Sign-In button → triggers popup OAuth flow
3. `handleCredentialResponse()` receives JWT token from Google
4. `decodeJwtResponse()` manually decodes JWT payload
5. `showProfile()` displays user information and switches UI state
6. `signOut()` clears session and resets UI

### Google OAuth Configuration
- Client ID is hardcoded in both `index.html` and `app.js`
- Current client ID: `your_google_client_id_here`
- Authorized origins configured for localhost:3000 and 127.0.0.1:3000

## Key Implementation Details

### JWT Token Handling
The application manually decodes Google's JWT tokens using base64 URL decoding rather than using a JWT library. The `decodeJwtResponse()` function handles the token parsing.

### UI State Management
Two main UI states managed through CSS classes:
- Login state: `#loginSection` visible, `#profileSection` hidden
- Authenticated state: `#loginSection` hidden, `#profileSection` visible

### Security Considerations
- This is a demo/learning application with hardcoded credentials
- Google OAuth tokens are processed client-side only
- No server-side validation or session management
- Suitable for development/educational purposes only