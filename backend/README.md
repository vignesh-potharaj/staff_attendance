# Smart Staff Attendance - Backend

This directory contains the FastAPI backend for the Smart Staff Attendance system.

## Setup

1. **Virtual Environment**: Ensure you have a virtual environment created in the root directory:
   ```powershell
   python -m venv venv
   ```

2. **Install Dependencies**: Install the required Python packages:
   ```powershell
   .\venv\Scripts\pip install -r backend/requirements.txt
   ```

3. **Environment Variables**: A default `.env` file has been created in this directory. You can modify it if needed:
   ```env
   DATABASE_URL=sqlite:///./sql_app.db
   SECRET_KEY=your_secret_key_here
   ```

## Running the Server

To run the backend server with auto-reload, execute the following command from the **root directory** of the project:

```powershell
.\venv\Scripts\python -m backend.main
```

The server will be available at `http://localhost:8000`.

## API Documentation

Once the server is running, you can access the interactive API documentation at:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
