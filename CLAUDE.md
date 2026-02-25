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
npx http-server -p 8081

# Python 3
python -m http.server 8081

# PHP (if available)
php -S localhost:8081
```

Access the application at `http://localhost:8081`

### File Serving Requirements
- Must run on localhost or HTTPS (Google OAuth requirement)
- Port 8081 is configured in Google Cloud Console settings

### Google Apps Script Deployment
Deploy the backend Google Apps Script code using:

```bash
npm run deploy:gas
```

This command automatically updates the Google Apps Script project with the latest code from `gas/google-apps-script.js`.

## Current Specifications

### Application Overview
This is a Japanese shift management web application with Google OAuth authentication. Users can:
- View and manage work shifts
- Set capacity (required staff) for each date
- Submit shift requests for specific time slots
- View remaining available slots in real-time

### Core Features

#### 1. Authentication & Authorization
- **Google OAuth Integration**: Uses Google Identity Services (GSI) for login
- **Email-based Authorization**: Only users with authorized email addresses can access
- **Admin Role Management**: Admin users have additional permissions for capacity settings

#### 2. Shift Management System
- **Time Slots**: 30-minute intervals from 13:00 to 18:00 (13:00-13:30, 13:30-14:00, etc.)
- **Date Range**: Supports shifts from current date through next fiscal year (March 31)
- **Real-time Availability**: Shows remaining slots based on capacity settings and current applications

#### 3. Capacity Management
- **Default Capacity by Day of Week**:
  - Sunday/Saturday: 0 people (no shifts)
  - Wednesday: 2 people
  - Monday/Tuesday/Thursday/Friday: 3 people
- **Custom Capacity Setting**: Admin users can override default capacity for specific dates
- **Real-time Updates**: Capacity changes immediately reflect in available slots

#### 4. Data Storage & Backend
- **Google Spreadsheet Backend**: All data stored in Google Sheets
- **Google Apps Script API**: Handles server-side logic and data processing

### Technical Architecture

#### Frontend (Client-side)
- **Pure HTML/CSS/JavaScript**: No build system or frameworks
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time UI Updates**: Immediate feedback on capacity and availability changes

#### Backend (Google Apps Script)
- **RESTful API**: Handles GET/POST requests for data operations
- **Spreadsheet Integration**: Direct integration with Google Sheets for data persistence
- **Property Service**: Secure storage of configuration settings

#### Data Structure
**Spreadsheet Sheets**:
1. **シフト (Shifts)**: Individual shift applications
   - Columns: Timestamp, UserID, UserName, Email, Date, TimeSlot, Content
2. **人数設定 (Capacity)**: Daily capacity settings  
   - Columns: Timestamp, Date, Capacity, UpdaterID, UpdaterName
3. **ユーザー (Users)**: User registration data
   - Columns: Timestamp, UserID, Name, Email, ProfileImageURL

### Key Algorithms

#### Remaining Slots Calculation
```
remainingSlots = configuredCapacity - currentApplications
```

#### Default Capacity Assignment
- Based on day of week with configurable overrides
- Automatically initializes capacity for entire fiscal year

#### Time Slot Generation
- Generates 30-minute intervals programmatically
- Supports flexible time range configuration

### Development & Deployment

#### Local Development
- Use `npm run dev` to start local server on port 8081
- Google OAuth requires localhost or HTTPS

#### Backend Deployment  
- Use `npm run deploy:gas` to deploy Google Apps Script code
- Automatically updates backend with latest changes

#### Configuration
- Google OAuth Client ID configured in both frontend and backend
- Authorized user emails managed through configuration

### Security Considerations
- **Client-side Token Processing**: JWT tokens decoded on client-side only
- **Email-based Access Control**: Restricts access to authorized users only
- **No Server-side Session**: Stateless authentication using Google tokens
- **Secure Configuration**: Sensitive settings stored in Google Apps Script Properties

This system provides a complete shift management solution with real-time availability tracking using Google Spreadsheets for data storage.

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
- Authorized origins configured for localhost:8081 and 127.0.0.1:8081

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