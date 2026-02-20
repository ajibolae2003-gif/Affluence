# Inventory Management System

A full-stack inventory management application with React frontend and Flask backend.

## Features

- **Inventory Management**: Add, view, and search products
- **Order Management**: Create and track customer orders
- **Shipping Queue**: Manage shipping status and tracking
- **Reports**: View sales statistics and product performance
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- Lucide React (icons)

### Backend
- Flask 3.0
- SQLAlchemy (SQLite database)
- Flask-CORS

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- Python 3.8 or higher
- npm or yarn

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Start the Flask server:
```bash
python app.py
```

The backend API will be available at `http://localhost:5000`

## API Endpoints

- `GET /api/inventory` - Get all products and stats
- `POST /api/inventory` - Add a new product
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create a new order
- `GET /api/shipping` - Get shipping queue
- `PATCH /api/shipping/<order_id>` - Update shipping status
- `GET /api/products/search?id=<query>` - Search products
- `GET /api/health` - Health check

## Database

The application uses SQLite by default. The database file `inventory.db` will be created automatically when you first run the Flask server.

### Database Schema

- **products**: Product inventory information
- **orders**: Customer orders
- **shipping**: Shipping queue and tracking

## Usage

1. Start both the Flask backend (`python app.py`) and React frontend (`npm run dev`)
2. Open your browser to `http://localhost:5173`
3. Use the navigation to access different sections:
   - **Inventory**: View and add products
   - **Customers**: View and create orders
   - **Shipping**: Manage shipping queue
   - **Reports**: View sales statistics

## Notes

- The database is automatically initialized on first run
- All dummy/test data has been removed from the frontend
- The backend validates stock availability before creating orders
- When an order is marked as "delivered", inventory is automatically updated
