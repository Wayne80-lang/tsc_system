# TSC System Access

A Django-based system for managing access requests to various TSC internal systems.

## Features

- **Access Request Workflow**: Users can request access to systems (e.g., Active Directory, CRM, HRMIS).
- **Multi-Level Approval**: Requests go through HOD, ICT, and System Admin approval stages.
- **Dashboards**: Dedicated dashboards for HODs, ICT staff, and System Admins.
- **Email Notifications**: Automated emails for request status updates.
- **Reporting**: Export reports to Excel and PDF.

## Tech Stack

- **Backend**: Django 5.0+
- **Database**: MySQL
- **Frontend**: HTML, CSS (Bootstrap/Custom), JavaScript
- **Utilities**: ReportLab (PDF), OpenPyXL (Excel)

## Prerequisites

- Python 3.10+
- MySQL Server
- Git

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd tsc_system_access
    ```

2.  **Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    # Windows
    venv\Scripts\activate
    # Linux/Mac
    source venv/bin/activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    - Copy `.env.example` to `.env`:
      ```bash
      cp .env.example .env
      # Windows
      copy .env.example .env
      ```
    - Open `.env` and update the values with your local configuration (Database credentials, Email settings, etc.).

5.  **Apply Migrations:**
    ```bash
    python manage.py migrate
    ```

6.  **Create a Superuser:**
    ```bash
    python manage.py createsuperuser
    ```

7.  **Run the Development Server:**
    ```bash
    python manage.py runserver
    ```

## Docker Support

The project includes a `Dockerfile` and `docker-compose.yml` for containerized deployment.

1.  **Build and Run:**
    ```bash
    docker-compose up --build
    ```

## License

[License Name]
