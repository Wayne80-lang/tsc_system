```markdown
# TSC System Access

A comprehensive full-stack system for managing access requests to various TSC internal systems. This application streamlines the workflow for requesting, approving, and auditing user access rights across the organization.

## Features

- **Access Request Workflow**: Automated workflow for users to request access to systems (e.g., Active Directory, CRM, HRMIS).
- **Role-Based Dashboards**: Dedicated interfaces for different user roles:
  - **Requester**: Submit and track requests.
  - **HOD**: Approve requests for their directorate.
  - **ICT**: Technical validation and processing.
  - **System Admin**: Final provisioning and management.
  - **Super Admin**: Global configurations, user management, and audit logs.
- **Multi-Level Approval**: Configurable approval chains involving HODs, ICT, and System Admins.
- **Audit Logging**: Comprehensive tracking of all actions for security and compliance.
- **Reporting**: Exportable reports in Excel and PDF formats.
- **Notifications**: Automated email updates for request status changes.

## Tech Stack

### Backend (API)
- **Framework**: Django 5.0+ & Django REST Framework (DRF)
- **Database**: MySQL
- **Authentication**: Token-based Authentication
- **Task Processing**: ReportLab (PDF), OpenPyXL (Excel)
- **Containerization**: Docker & Docker Compose

### Frontend (Client)
- **Framework**: Next.js 16 (App Router)
- **Library**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State Management**: React Hooks & Context
- **HTTP Client**: Axios
- **UI Components**: Shadcn/UI (Button, Toast, Input, etc.) & Lucide React Icons

## Prerequisites

- **Python**: 3.10 or higher
- **Node.js**: 18.0 or higher
- **MySQL Server**
- **Git**

## Installation Guide

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd tsc_system

```

### 2. Backend Setup (`tsc_system_access`)

Navigate to the backend directory:

```bash
cd tsc_system_access

```

**Create and activate a virtual environment:**

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate

```

**Install dependencies:**

```bash
pip install -r requirements.txt

```

**Configure Environment Variables:**

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env

```


2. Open `.env` and configure your database credentials, email settings, and secret key.

**Setup Database:**

```bash
python manage.py migrate
python manage.py createsuperuser

```

**Run the Development Server:**

```bash
python manage.py runserver

```

*The backend API will run at `http://127.0.0.1:8000/*`

### 3. Frontend Setup (`tsc_system_frontend`)

Open a new terminal and navigate to the frontend directory:

```bash
cd tsc_system_frontend

```

**Install Node dependencies:**

```bash
npm install

```

**Run the Development Server:**

```bash
npm run dev

```

*The frontend application will run at `http://localhost:3000/*`

## Docker Deployment

The backend is containerized for easy deployment.

1. Navigate to the backend directory:
```bash
cd tsc_system_access

```


2. Build and run the container:
```bash
docker-compose up --build

```



## Project Structure

```
tsc_system/
├── tsc_system_access/      # Django Backend
│   ├── access_request/     # Core application logic, models, and views
│   ├── tsc_system_access/  # Project settings and configuration
│   ├── Dockerfile          # Docker build instructions
│   └── requirements.txt    # Python dependencies
│
└── tsc_system_frontend/    # Next.js Frontend
    ├── app/                # App Router pages (Dashboard, Login, etc.)
    ├── components/         # Reusable UI components
    ├── lib/                # Utilities and API configuration
    └── package.json        # Node dependencies

```

```

```
