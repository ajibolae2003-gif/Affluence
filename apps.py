from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from io import BytesIO
from datetime import datetime

import requests


import resend
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import atexit

resend.api_key = "re_3YXkitfT_JNgrf6SfSazPjMXsDLW2tX4n"
REPORT_EMAIL = "ajibolae2003@gmail.com"
REPORT_INTERVAL_DAYS = 7  # Change this to whatever interval you want
app = Flask(__name__)

# Enhanced CORS configuration - Allow all origins for development
# For production, replace '*' with specific origins
# Set automatic_options=True to handle OPTIONS automatically
CORS(app, 
     resources={r"/api/*": {
         "origins": "*",
         "methods": ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"]
     }},
     supports_credentials=False,
     automatic_options=True)

# Database configuration - Using SQLite for simplicity, can be changed to PostgreSQL
database_url = os.environ.get('DATABASE_URL', f'sqlite:///{os.path.join(os.path.abspath(os.path.dirname(__file__)), "inventory.db")}')

# Render gives Postgres URLs starting with "postgres://" but SQLAlchemy needs "postgresql://"
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Database Models

# PRODUCT - Master product information (no pricing/quantity)
class Product(db.Model):
    __tablename__ = 'products'
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    # Legacy columns kept for backward compatibility with existing SQLite schema.
    # New logic uses Batch for quantities, but these satisfy NOT NULL constraints.
    quantity = db.Column(db.Integer, nullable=False, default=0)
    sold = db.Column(db.Integer, nullable=False, default=0)
    # Legacy pricing columns also kept for backward compatibility.
    cost = db.Column(db.Float, nullable=False, default=0.0)
    price = db.Column(db.Float, nullable=False, default=0.0)
    # Legacy column kept for backward compatibility with existing SQLite schema.
    # New logic primarily uses Batch.date_added, but this ensures NOT NULL constraint is satisfied.
    date_received = db.Column(db.Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    category = db.Column(db.String(200), nullable=True)
    description = db.Column(db.Text, nullable=True)
    image = db.Column(db.String(500), nullable=True)
    # Optional label used for UI (e.g., size/packaging notes)
    label = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    batches = db.relationship('Batch', backref='product', lazy=True, cascade='all, delete-orphan', order_by='Batch.date_added.asc()')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'price': float(self.price) if getattr(self, 'price', None) is not None else 0.0,
            'cost': float(self.cost) if getattr(self, 'cost', None) is not None else 0.0,
            'dateReceived': self.date_received.strftime('%Y-%m-%d') if getattr(self, 'date_received', None) else None,
            'category': self.category,
            'description': self.description,
            'image': self.image,
            'label': self.label,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

# BATCH - Individual stock batch with pricing and quantity
class Batch(db.Model):
    __tablename__ = 'batches'
    
    id = db.Column(db.String(50), primary_key=True)  # Batch ID (unique)
    product_id = db.Column(db.String(50), db.ForeignKey('products.id'), nullable=False)
    cost_price = db.Column(db.Float, nullable=False)
    selling_price = db.Column(db.Float, nullable=False)
    shipping_cost = db.Column(db.Float, nullable=True, default=0.0)
    quantity_added = db.Column(db.Integer, nullable=False, default=0)
    quantity_remaining = db.Column(db.Integer, nullable=False, default=0)
    quantity_sold = db.Column(db.Integer, nullable=False, default=0)
    date_added = db.Column(db.Date, nullable=False)
    supplier = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    sales = db.relationship('Sale', backref='batch', lazy=True)
    price_changes = db.relationship('PriceChange', backref='batch', lazy=True, order_by='PriceChange.date_changed.desc()')
    
    def to_dict(self):
        return {
            'id': self.id,
            'productId': self.product_id,
            'costPrice': self.cost_price,
            'sellingPrice': self.selling_price,
            'shippingCost': self.shipping_cost or 0.0,
            'quantityAdded': self.quantity_added,
            'quantityRemaining': self.quantity_remaining,
            'quantitySold': self.quantity_sold,
            'dateAdded': self.date_added.strftime('%Y-%m-%d') if self.date_added else None,
            'supplier': self.supplier,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

# SALE - Individual sales transaction with FIFO tracking
class Sale(db.Model):
    __tablename__ = 'sales'
    
    id = db.Column(db.String(50), primary_key=True)
    batch_id = db.Column(db.String(50), db.ForeignKey('batches.id'), nullable=False)
    order_id = db.Column(db.String(50), db.ForeignKey('orders.id'), nullable=True)  # Link to order if exists
    customer_name = db.Column(db.String(200), nullable=False)
    quantity_sold = db.Column(db.Integer, nullable=False)
    selling_price_used = db.Column(db.Float, nullable=False)  # Price at time of sale
    cost_price_used = db.Column(db.Float, nullable=False)  # FIFO cost from batch
    revenue = db.Column(db.Float, nullable=False)  # quantity * selling_price_used
    cost = db.Column(db.Float, nullable=False)  # quantity * cost_price_used
    profit = db.Column(db.Float, nullable=False)  # revenue - cost
    date_sold = db.Column(db.Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    def to_dict(self):
        return {
            'id': self.id,
            'batchId': self.batch_id,
            'orderId': self.order_id,
            'customerName': self.customer_name,
            'quantitySold': self.quantity_sold,
            'sellingPriceUsed': self.selling_price_used,
            'costPriceUsed': self.cost_price_used,
            'revenue': self.revenue,
            'cost': self.cost,
            'profit': self.profit,
            'dateSold': self.date_sold.strftime('%Y-%m-%d') if self.date_sold else None
        }

# PRICE CHANGE - Track price changes for batches
class PriceChange(db.Model):
    __tablename__ = 'price_changes'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    batch_id = db.Column(db.String(50), db.ForeignKey('batches.id'), nullable=False)
    change_type = db.Column(db.String(20), nullable=False)  # 'cost' or 'selling'
    old_price = db.Column(db.Float, nullable=False)
    new_price = db.Column(db.Float, nullable=False)
    date_changed = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    changed_by = db.Column(db.String(200), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'batchId': self.batch_id,
            'changeType': self.change_type,
            'oldPrice': self.old_price,
            'newPrice': self.new_price,
            'dateChanged': self.date_changed.isoformat() if self.date_changed else None,
            'changedBy': self.changed_by,
            'notes': self.notes
        }

class Customer(db.Model):
    __tablename__ = 'customers'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(200), nullable=True)
    name = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(50), nullable=True)
    email = db.Column(db.String(200), nullable=True)
    address = db.Column(db.Text, nullable=True)
    quantity_weight = db.Column(db.Float, nullable=True)  # Weight preference for orders
    account_number = db.Column(db.String(100), nullable=True)
    upline = db.Column(db.String(200), nullable=True)
    total_orders = db.Column(db.Integer, default=0)
    total_spent = db.Column(db.Float, default=0.0)
    first_order_date = db.Column(db.Date, nullable=True)
    last_order_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'quantityWeight': self.quantity_weight,
            'accountNumber': self.account_number,
            'upline': self.upline,
            'totalOrders': self.total_orders,
            'totalSpent': self.total_spent,
            'firstOrderDate': self.first_order_date.strftime('%Y-%m-%d') if self.first_order_date else None,
            'lastOrderDate': self.last_order_date.strftime('%Y-%m-%d') if self.last_order_date else None
        }

class Order(db.Model):
    __tablename__ = 'orders'
    
    id = db.Column(db.String(50), primary_key=True)
    customer_name = db.Column(db.String(200), nullable=False)
    product_id = db.Column(db.String(50), db.ForeignKey('products.id'), nullable=False)  # Keep for compatibility
    quantity = db.Column(db.Integer, nullable=False)
    address = db.Column(db.Text, nullable=False)
    invoice = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(50), nullable=False, default='pending')
    payment_method = db.Column(db.String(50), nullable=True)
    payment_proof = db.Column(db.String(500), nullable=True)
    payment_reference = db.Column(db.String(200), nullable=True)
    amount_paid = db.Column(db.Float, nullable=True)
    payment_confirmed = db.Column(db.Boolean, default=False)
    date_created = db.Column(db.Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    product = db.relationship('Product', backref='orders')
    sales = db.relationship('Sale', backref='order', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'customerName': self.customer_name,
            'productId': self.product_id,
            'quantity': self.quantity,
            'address': self.address,
            'invoice': self.invoice,
            'status': self.status,
            'paymentMethod': self.payment_method,
            'paymentProof': self.payment_proof,
            'paymentReference': self.payment_reference,
            'paymentConfirmed': self.payment_confirmed,
            'amountPaid': self.amount_paid,
            'dateCreated': self.date_created.strftime('%Y-%m-%d') if self.date_created else None
        }

class Shipping(db.Model):
    __tablename__ = 'shipping'
    
    id = db.Column(db.String(50), db.ForeignKey('orders.id'), primary_key=True)
    customer_name = db.Column(db.String(200), nullable=False)
    product_id = db.Column(db.String(50), db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    address = db.Column(db.Text, nullable=False)
    tracking_number = db.Column(db.String(100), nullable=True)
    shipping_cost = db.Column(db.Float, nullable=True)
    shipping_company = db.Column(db.String(200), nullable=True)
    shipping_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='pending')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    order = db.relationship('Order', backref='shipping')
    product = db.relationship('Product', backref='shipping')
    history = db.relationship('ShippingHistory', backref='shipping', cascade='all, delete-orphan', order_by='ShippingHistory.timestamp.desc()')
    
    def to_dict(self):
        return {
            'id': self.id,
            'customerName': self.customer_name,
            'productId': self.product_id,
            'quantity': self.quantity,
            'address': self.address,
            'trackingNumber': self.tracking_number or '',
            'shippingCost': str(self.shipping_cost) if self.shipping_cost else '',
            'shippingCompany': self.shipping_company or '',
            'shippingDate': self.shipping_date.strftime('%Y-%m-%d') if self.shipping_date else None,
            'status': self.status,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }

class ShippingHistory(db.Model):
    __tablename__ = 'shipping_history'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    shipping_id = db.Column(db.String(50), db.ForeignKey('shipping.id'), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    tracking_number = db.Column(db.String(100), nullable=True)
    shipping_cost = db.Column(db.Float, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'status': self.status,
            'trackingNumber': self.tracking_number or '',
            'shippingCost': str(self.shipping_cost) if self.shipping_cost else '',
            'notes': self.notes or '',
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }

# Initialize database
with app.app_context():
    db.create_all()
    
    # Migrations
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        
        # Migration: Add shipping_cost column if it doesn't exist
        products_columns = [col['name'] for col in inspector.get_columns('products')]
        if 'shipping_cost' not in products_columns:
            print("Adding shipping_cost column to products table...")
            with db.engine.begin() as conn:
                conn.execute(text('ALTER TABLE products ADD COLUMN shipping_cost REAL DEFAULT 0.0'))
            print("Migration completed: shipping_cost column added successfully.")
        if 'label' not in products_columns:
            print("Adding label column to products table...")
            with db.engine.begin() as conn:
                conn.execute(text('ALTER TABLE products ADD COLUMN label VARCHAR(200)'))
            print("Migration completed: label column added successfully.")
        
        # Migration: Add payment_reference and payment_confirmed columns if they don't exist
        orders_columns = [col['name'] for col in inspector.get_columns('orders')]
        if 'payment_reference' not in orders_columns:
            print("Adding payment_reference column to orders table...")
            with db.engine.begin() as conn:
                conn.execute(text('ALTER TABLE orders ADD COLUMN payment_reference VARCHAR(200)'))
            print("Migration completed: payment_reference column added.")
        
        if 'payment_confirmed' not in orders_columns:
            print("Adding payment_confirmed column to orders table...")
            with db.engine.begin() as conn:
                conn.execute(text('ALTER TABLE orders ADD COLUMN payment_confirmed BOOLEAN DEFAULT 0'))
            print("Migration completed: payment_confirmed column added.")
        if 'amount_paid' not in orders_columns:
            print("Adding amount_paid column to orders table...")
            with db.engine.begin() as conn:
                conn.execute(text('ALTER TABLE orders ADD COLUMN amount_paid REAL'))
            print("Migration completed: amount_paid column added.")
        
        # Migration: Add username and quantity_weight columns to customers table if they don't exist
        if inspector.has_table('customers'):
            customers_columns = [col['name'] for col in inspector.get_columns('customers')]
            if 'username' not in customers_columns:
                print("Adding username column to customers table...")
                with db.engine.begin() as conn:
                    conn.execute(text('ALTER TABLE customers ADD COLUMN username VARCHAR(200)'))
                print("Migration completed: username column added.")
            
            if 'quantity_weight' not in customers_columns:
                print("Adding quantity_weight column to customers table...")
                with db.engine.begin() as conn:
                    conn.execute(text('ALTER TABLE customers ADD COLUMN quantity_weight REAL'))
                print("Migration completed: quantity_weight column added.")
            if 'account_number' not in customers_columns:
                print("Adding account_number column to customers table...")
            if 'upline' not in customers_columns:
                print("Adding upline column to customers table...")
                with db.engine.begin() as conn:
                    conn.execute(text('ALTER TABLE customers ADD COLUMN upline VARCHAR(200)'))
                print("Migration completed: upline column added.")
                with db.engine.begin() as conn:
                    conn.execute(text('ALTER TABLE customers ADD COLUMN account_number VARCHAR(100)'))
                print("Migration completed: account_number column added.")

        # Migration: Add shipping_company and shipping_date columns to shipping table if they don't exist
        if inspector.has_table('shipping'):
            shipping_columns = [col['name'] for col in inspector.get_columns('shipping')]
            if 'shipping_company' not in shipping_columns:
                print("Adding shipping_company column to shipping table...")
                with db.engine.begin() as conn:
                    conn.execute(text('ALTER TABLE shipping ADD COLUMN shipping_company VARCHAR(200)'))
                print("Migration completed: shipping_company column added.")
            if 'shipping_date' not in shipping_columns:
                print("Adding shipping_date column to shipping table...")
                with db.engine.begin() as conn:
                    conn.execute(text('ALTER TABLE shipping ADD COLUMN shipping_date DATE'))
                print("Migration completed: shipping_date column added.")
        
        # Create new tables for Product/Batch separation if they don't exist
        if not inspector.has_table('batches'):
            print("Creating batches table...")
            db.create_all()
            print("Migration completed: batches table created.")
        if not inspector.has_table('sales'):
            print("Creating sales table...")
            db.create_all()
            print("Migration completed: sales table created.")
        if not inspector.has_table('price_changes'):
            print("Creating price_changes table...")
            db.create_all()
            print("Migration completed: price_changes table created.")
            
        # Migrate existing products table structure if needed
        if inspector.has_table('products'):
            products_columns = [col['name'] for col in inspector.get_columns('products')]
            if 'category' not in products_columns:
                print("Adding category column to products table...")
                with db.engine.begin() as conn:
                    conn.execute(text('ALTER TABLE products ADD COLUMN category VARCHAR(200)'))
                print("Migration completed: category column added.")
            if 'description' not in products_columns:
                print("Adding description column to products table...")
                with db.engine.begin() as conn:
                    conn.execute(text('ALTER TABLE products ADD COLUMN description TEXT'))
                print("Migration completed: description column added.")
    except Exception as e:
        if 'duplicate column' not in str(e).lower() and 'already exists' not in str(e).lower():
            print(f"Migration note: {e}")

# API Routes

# Catch-all OPTIONS handler for CORS preflight under /api/*
# Browsers require a 2xx response for preflight. Without this, Flask may return
# a default HTML 404 for OPTIONS on variable routes (before before_request runs).
@app.route('/api/<path:_path>', methods=['OPTIONS'])
def api_preflight(_path):
    response = jsonify({'status': 'ok'})
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
    response.headers.add("Access-Control-Max-Age", "3600")
    return response, 200

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    try:
        products = Product.query.all()
        products_data = []
        
        total_stock = 0
        total_sold = 0
        
        for product in products:
            # Aggregate batch data for product
            batches = Batch.query.filter_by(product_id=product.id).all()
            product_dict = product.to_dict()
            
            # Calculate totals from batches
            product_quantity = sum(b.quantity_remaining for b in batches)
            product_sold = sum(b.quantity_sold for b in batches)

            # Derive display price/cost from latest batch where possible
            latest_batch = None
            if batches:
                latest_batch = max(
                    batches,
                    key=lambda b: b.date_added or datetime.min.replace(tzinfo=timezone.utc)
                )
            if latest_batch:
                product_dict['price'] = float(latest_batch.selling_price)
                product_dict['cost'] = float(latest_batch.cost_price)
                product_dict['shippingCost'] = float(latest_batch.shipping_cost or 0.0)
            else:
                # Fallback to legacy product fields
                product_dict['price'] = float(getattr(product, 'price', 0.0) or 0.0)
                product_dict['cost'] = float(getattr(product, 'cost', 0.0) or 0.0)
                product_dict['shippingCost'] = 0.0
            
            product_dict['quantity'] = product_quantity
            product_dict['sold'] = product_sold
            product_dict['batches'] = [b.to_dict() for b in batches]
            
            total_stock += product_quantity
            total_sold += product_sold
            
            products_data.append(product_dict)
        
        total_products = len(products)
        low_stock_count = len([p for p in products_data if p['quantity'] < 50])
        
        return jsonify({
            'products': products_data,
            'stats': {
                'totalProducts': total_products,
                'totalStock': total_stock,
                'totalSold': total_sold,
                'lowStockCount': low_stock_count
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


import json, os

SETTINGS_FILE = 'report_settings.json'

def load_report_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, 'r') as f:
            return json.load(f)
    return {'email': REPORT_EMAIL, 'intervalDays': REPORT_INTERVAL_DAYS}

def save_report_settings(data):
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(data, f)

@app.route('/api/settings/report', methods=['GET'])
def get_report_settings():
    return jsonify(load_report_settings())

@app.route('/api/settings/report', methods=['POST'])
def update_report_settings():
    data = request.get_json()
    email = data.get('email', '').strip()
    interval_days = int(data.get('intervalDays', 7))

    if not email or interval_days < 1:
        return jsonify({'error': 'Invalid email or interval'}), 400

    save_report_settings({'email': email, 'intervalDays': interval_days})

    # Reschedule the job with the new interval
    try:
        scheduler.reschedule_job(
            'send_reports',
            trigger=IntervalTrigger(days=interval_days)
        )
    except Exception as e:
        print(f'Could not reschedule job: {e}')

    return jsonify({'message': 'Settings saved', 'email': email, 'intervalDays': interval_days})
    
@app.route('/api/inventory', methods=['POST'])
def add_inventory():
    try:
        raw_body = request.get_data(as_text=True)  # helpful for debugging invalid JSON
        data = request.get_json(silent=True)
        
        # Validate required fields
        if data is None:
            return jsonify({'error': 'Invalid JSON payload', 'rawBodyPreview': (raw_body or '')[:500]}), 400
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['productId', 'productName', 'batchId', 'dateReceived', 'quantity', 'cost', 'price']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Check if batch ID already exists
        existing_batch = Batch.query.filter_by(id=data['batchId']).first()
        if existing_batch:
            return jsonify({'error': 'Batch ID already exists'}), 400
        
        # Parse date
        try:
            date_received = datetime.strptime(data['dateReceived'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        
        # Get or create product
        product = Product.query.filter_by(id=data['productId']).first()
        if not product:
            # Create new product (keep legacy columns in sync for backward compatibility)
            product = Product(
                id=data['productId'],
                name=data['productName'],
                quantity=0,
                sold=0,
                cost=float(data['cost']),
                price=float(data['price']),
                date_received=date_received,
                category=data.get('category'),
                description=data.get('description'),
                image=data.get('image'),
                label=data.get('label')
            )
            db.session.add(product)
        else:
            # Update product info if provided
            if data.get('productName'):
                product.name = data['productName']
            if data.get('category'):
                product.category = data['category']
            if data.get('description'):
                product.description = data['description']
            if data.get('image'):
                product.image = data['image']
            if 'label' in data:
                product.label = data['label'] or None
            # Keep legacy pricing fields roughly in sync with latest batch info
            if data.get('cost') is not None:
                product.cost = float(data['cost'])
            if data.get('price') is not None:
                product.price = float(data['price'])


        
        # Create batch
        quantity = int(data['quantity'])
        batch = Batch(
            id=data['batchId'],
            product_id=data['productId'],
            cost_price=float(data['cost']),
            selling_price=float(data['price']),
            shipping_cost=float(data.get('shippingCost', 0)) if data.get('shippingCost') else 0.0,
            quantity_added=quantity,
            quantity_remaining=quantity,
            quantity_sold=0,
            date_added=date_received,
            supplier=data.get('supplier')
        )
        
        db.session.add(batch)
        db.session.commit()
        
        return jsonify({
            'message': 'Product and batch added successfully',
            'product': product.to_dict(),
            'batch': batch.to_dict()
        }), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': f'Invalid value: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"Error adding inventory: {error_details}")
        return jsonify({'error': str(e), 'details': error_details}), 500

@app.route('/api/inventory/<product_id>', methods=['PATCH'])
def update_inventory_quantity(product_id):
    """Update product fields (quantity for staff to add stock, price/cost/label for admin edits)
    
    Note: For quantity updates, creates a new batch. For price updates, updates the latest batch.
    """
    try:
        product = Product.query.filter_by(id=product_id).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        raw_body = request.get_data(as_text=True)
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({'error': 'Invalid JSON payload', 'rawBodyPreview': (raw_body or '')[:500]}), 400
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Handle quantity addition - create a new batch
        if 'quantity' in data:
            try:
                quantity_to_add = int(data['quantity'])
                if quantity_to_add <= 0:
                    return jsonify({'error': 'Quantity must be greater than 0'}), 400
                
                # Get the latest batch to use its pricing
                latest_batch = Batch.query.filter_by(product_id=product_id)\
                    .order_by(Batch.date_added.desc()).first()
                
                if not latest_batch:
                    return jsonify({'error': 'No batches found for this product. Please add inventory first.'}), 400
                
                # Create a new batch with the same pricing as the latest batch
                from datetime import date
                import uuid
                new_batch_id = f"{product_id}-BATCH-{str(uuid.uuid4())[:8].upper()}"
                
                new_batch = Batch(
                    id=new_batch_id,
                    product_id=product_id,
                    cost_price=latest_batch.cost_price,
                    selling_price=latest_batch.selling_price,
                    shipping_cost=latest_batch.shipping_cost or 0.0,
                    quantity_added=quantity_to_add,
                    quantity_remaining=quantity_to_add,
                    quantity_sold=0,
                    date_added=date.today(),
                    supplier=data.get('supplier') or latest_batch.supplier
                )
                db.session.add(new_batch)
                
            except (ValueError, TypeError) as e:
                return jsonify({'error': f'Invalid quantity value: {str(e)}'}), 400
        
        # Handle batch price updates - update the latest batch
        if 'price' in data or 'cost' in data or 'sellingPrice' in data or 'costPrice' in data:
            latest_batch = Batch.query.filter_by(product_id=product_id)\
                .order_by(Batch.date_added.desc()).first()
            
            if not latest_batch:
                return jsonify({'error': 'No batches found for this product'}), 400
            
            price_changes = []
            
            if 'price' in data or 'sellingPrice' in data:
                new_selling = float(data.get('sellingPrice') or data.get('price'))
                if new_selling != latest_batch.selling_price:
                    price_change = PriceChange(
                        batch_id=latest_batch.id,
                        change_type='selling',
                        old_price=latest_batch.selling_price,
                        new_price=new_selling,
                        changed_by=data.get('changedBy', 'System'),
                        notes=data.get('notes', 'Price updated via API')
                    )
                    db.session.add(price_change)
                    price_changes.append(price_change.to_dict())
                    latest_batch.selling_price = new_selling
            
            if 'cost' in data or 'costPrice' in data:
                new_cost = float(data.get('costPrice') or data.get('cost'))
                if new_cost != latest_batch.cost_price:
                    price_change = PriceChange(
                        batch_id=latest_batch.id,
                        change_type='cost',
                        old_price=latest_batch.cost_price,
                        new_price=new_cost,
                        changed_by=data.get('changedBy', 'System'),
                        notes=data.get('notes', 'Cost updated via API')
                    )
                    db.session.add(price_change)
                    price_changes.append(price_change.to_dict())
                    latest_batch.cost_price = new_cost
        
        # Update product metadata
        if 'shippingCost' in data:
            # Note: shipping_cost is stored per batch, not per product
            # Update latest batch if needed
            latest_batch = Batch.query.filter_by(product_id=product_id)\
                .order_by(Batch.date_added.desc()).first()
            if latest_batch:
                try:
                    latest_batch.shipping_cost = float(data['shippingCost']) if data['shippingCost'] not in (None, '') else 0.0
                except (ValueError, TypeError):
                    return jsonify({'error': 'Invalid shipping cost value'}), 400
        
        if 'label' in data:
            product.label = data['label'] or None

        db.session.commit()
        
        # Return updated product with batches
        batches = Batch.query.filter_by(product_id=product_id).all()
        product_dict = product.to_dict()
        product_dict['quantity'] = sum(b.quantity_remaining for b in batches)
        product_dict['sold'] = sum(b.quantity_sold for b in batches)
        product_dict['batches'] = [b.to_dict() for b in batches]
        
        return jsonify({
            'message': 'Product updated successfully',
            'product': product_dict
        }), 200
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Error updating inventory: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders', methods=['GET'])
def get_orders():
    try:
        product_id = request.args.get('productId')
        if product_id:
            # Get orders for specific product
            orders = Order.query.filter_by(product_id=product_id).all()
        else:
            # Get all orders
            orders = Order.query.all()
        
        orders_data = []
        for order in orders:
            order_dict = order.to_dict()
            # Get shipping details for this order
            shipping = Shipping.query.filter_by(id=order.id).first()
            if shipping:
                # Get shipping history to find transit and shipped dates
                history = ShippingHistory.query.filter_by(shipping_id=order.id).order_by(ShippingHistory.timestamp.asc()).all()
                transit_date = None
                shipped_date = None
                for h in history:
                    if h.status == 'transit' and not transit_date:
                        transit_date = h.timestamp
                    if h.status == 'shipped' and not shipped_date:
                        shipped_date = h.timestamp
                
                order_dict['shipping'] = {
                    'status': shipping.status,
                    'trackingNumber': shipping.tracking_number or '',
                    'shippingCost': str(shipping.shipping_cost) if shipping.shipping_cost else '',
                    'shippingCompany': shipping.shipping_company or '',
                    'shippingDate': shipping.shipping_date.strftime('%Y-%m-%d') if shipping.shipping_date else None,
                    'transitDate': transit_date.isoformat() if transit_date else None,
                    'shippedDate': shipped_date.isoformat() if shipped_date else None,
                    'address': shipping.address
                }
            orders_data.append(order_dict)
        
        return jsonify({'orders': orders_data}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders', methods=['POST'])
def add_order():
    try:
        data = request.json
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['customerName', 'productId', 'quantity', 'address']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Generate order ID
        try:
            last_order = Order.query.order_by(Order.id.desc()).first()
            if last_order:
                last_num = int(last_order.id.replace('ORD', ''))
                order_id = f'ORD{str(last_num + 1).zfill(3)}'
            else:
                order_id = 'ORD001'
        except Exception as e:
            return jsonify({'error': f'Error generating order ID: {str(e)}'}), 500
        
        # Check if product exists
        product = Product.query.filter_by(id=data['productId']).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        try:
            quantity_requested = int(data['quantity'])
            if quantity_requested <= 0:
                return jsonify({'error': 'Quantity must be greater than 0'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid quantity value'}), 400
        
        # FIFO: Get batches with remaining stock, ordered by date_added (oldest first)
        batches = Batch.query.filter_by(product_id=data['productId'])\
            .filter(Batch.quantity_remaining > 0)\
            .order_by(Batch.date_added.asc()).all()
        
        # Check total available stock
        total_available = sum(b.quantity_remaining for b in batches)
        if total_available < quantity_requested:
            return jsonify({'error': f'Insufficient stock. Available: {total_available}, Requested: {quantity_requested}'}), 400
        
        # Get current selling price (use latest batch or product default)
        current_selling_price = batches[-1].selling_price if batches else 0.0
        
        # Amount paid (optional)
        amount_paid = None
        if 'amountPaid' in data and data['amountPaid'] not in (None, '', []):
            try:
                amount_paid = float(data['amountPaid'])
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid amountPaid value'}), 400
        
        # Save or update customer information
        customer = Customer.query.filter_by(name=data['customerName']).first()
        order_date = datetime.now(timezone.utc).date()
        # Use amountPaid if provided; otherwise use current selling price
        order_total = amount_paid if amount_paid is not None else current_selling_price * quantity_requested
        
        if customer:
            # Update existing customer
            customer.total_orders += 1
            customer.total_spent += order_total
            if data.get('address') and (not customer.address or customer.address != data.get('address')):
                customer.address = data['address']
            if data.get('email') and (not customer.email or customer.email != data.get('email')):
                customer.email = data.get('email')
            if data.get('phone') and (not customer.phone or customer.phone != data.get('phone')):
                customer.phone = data.get('phone')
            if data.get('username') and (not customer.username or customer.username != data.get('username')):
                customer.username = data.get('username')
            if data.get('upline') and (not customer.upline or customer.upline != data.get('upline')):
                customer.upline = data.get('upline')
            if data.get('accountNumber'):
                customer.account_number = data.get('accountNumber')
            customer.last_order_date = order_date
            if not customer.first_order_date:
                customer.first_order_date = order_date
        else:
            # Create new customer
            customer = Customer(
                name=data['customerName'],
                username=data.get('username'),
                upline=data.get('upline'),
                email=data.get('email'),
                phone=data.get('phone'),
                address=data.get('address'),
                quantity_weight=None,
                account_number=data.get('accountNumber'),
                total_orders=1,
                total_spent=order_total,
                first_order_date=order_date,
                last_order_date=order_date
            )
            db.session.add(customer)
        
        # Create order
        order = Order(
            id=order_id,
            customer_name=data['customerName'],
            product_id=data['productId'],
            quantity=quantity_requested,
            address=data['address'],
            invoice=data.get('invoice') or None,
            payment_method=data.get('paymentMethod') or None,
            payment_proof=data.get('paymentProof') or None,
            payment_reference=data.get('paymentReference') or None,
            amount_paid=amount_paid,
            payment_confirmed=data.get('paymentConfirmed', False),
            status='pending',
            date_created=order_date
        )
        db.session.add(order)
        
        # FIFO allocation: Allocate quantity from batches (oldest first)
        remaining_qty = quantity_requested
        sales_created = []
        total_revenue = 0.0
        total_cost = 0.0
        
# In add_order(), keep sale creation simple — no shipping cost yet:
        for batch in batches:
            if remaining_qty <= 0:
                break
            
            qty_from_batch = min(remaining_qty, batch.quantity_remaining)
            
            revenue = qty_from_batch * current_selling_price
            product_cost = qty_from_batch * batch.cost_price
            profit = revenue - product_cost  # shipping not known yet
            
            sale_id = f'SALE{order_id.replace("ORD", "")}-{len(sales_created) + 1}'
            
            sale = Sale(
                id=sale_id,
                batch_id=batch.id,
                order_id=order_id,
                customer_name=data['customerName'],
                quantity_sold=qty_from_batch,
                selling_price_used=current_selling_price,
                cost_price_used=batch.cost_price,
                revenue=revenue,
                cost=product_cost,
                profit=profit,
                date_sold=order_date
            )
            db.session.add(sale)
            sales_created.append(sale.to_dict())
            
            batch.quantity_remaining -= qty_from_batch
            batch.quantity_sold += qty_from_batch
            
            total_revenue += revenue
            total_cost += product_cost
            remaining_qty -= qty_from_batch
        
        # Create shipping entry
        shipping = Shipping(
            id=order_id,
            customer_name=data['customerName'],
            product_id=data['productId'],
            quantity=quantity_requested,
            address=data['address'],
            status='pending'
        )
        db.session.add(shipping)
        
        # Create initial shipping history entry
        initial_history = ShippingHistory(
            shipping_id=order_id,
            status='pending',
            notes='Order created and added to shipping queue'
        )
        db.session.add(initial_history)

        if 'shippingCost' in data and data['shippingCost']:
            new_shipping_cost = float(data['shippingCost']) if data['shippingCost'] else 0.0
            
            # Find all sales for this order and recalculate profit with shipping cost
            order = Order.query.filter_by(id=order_id).first()
            if order:
                order_sales = Sale.query.filter_by(order_id=order_id).all()
                total_units = sum(s.quantity_sold for s in order_sales)
                
                for sale in order_sales:
                    # Distribute shipping cost proportionally by quantity
                    sale_shipping_share = (sale.quantity_sold / total_units * new_shipping_cost) if total_units > 0 else 0
                    sale.cost = (sale.quantity_sold * sale.cost_price_used) + sale_shipping_share
                    sale.profit = sale.revenue - sale.cost
        
        db.session.commit()
        
        return jsonify({
            'message': 'Order created successfully',
            'order': order.to_dict(),
            'sales': sales_created,
            'totalRevenue': total_revenue,
            'totalCost': total_cost,
            'totalProfit': total_revenue - total_cost
        }), 201
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': f'Invalid value: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"Error adding order: {error_details}")
        return jsonify({'error': str(e), 'details': error_details}), 500

@app.route('/api/shipping', methods=['GET'])
def get_shipping():
    try:
        shipping_list = Shipping.query.all()
        shipping_data = [s.to_dict() for s in shipping_list]
        return jsonify({'shipping': shipping_data}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/shipping/<order_id>', methods=['PATCH'])
def update_shipping(order_id):
    try:
        shipping = Shipping.query.filter_by(id=order_id).first()
        if not shipping:
            return jsonify({'error': 'Shipping record not found'}), 404
        
        # Prevent updates if already shipped
        if shipping.status == 'shipped':
            return jsonify({'error': 'Cannot update shipping. Order has already been shipped.'}), 400
        
        data = request.json
        
        # Track changes for history
        status_changed = False
        tracking_changed = False
        cost_changed = False
        company_changed = False
        date_changed = False
        
        if 'trackingNumber' in data and data['trackingNumber'] != shipping.tracking_number:
            tracking_changed = True
            shipping.tracking_number = data['trackingNumber']
        if 'shippingCost' in data:
            new_cost = float(data['shippingCost']) if data['shippingCost'] else None
            if new_cost != shipping.shipping_cost:
                cost_changed = True
                shipping.shipping_cost = new_cost
        if 'shippingCompany' in data and data['shippingCompany'] != shipping.shipping_company:
            company_changed = True
            shipping.shipping_company = data['shippingCompany'] or None
        if 'shippingDate' in data:
            new_date = None
            if data['shippingDate']:
                try:
                    new_date = datetime.strptime(data['shippingDate'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'error': 'Invalid shippingDate format. Use YYYY-MM-DD'}), 400
            if new_date != shipping.shipping_date:
                date_changed = True
                shipping.shipping_date = new_date
        if 'status' in data and data['status'] != shipping.status:
            status_changed = True
            shipping.status = data['status']
            
            # Update order status when shipping status changes
            if data['status'] == 'shipped':
                order = Order.query.filter_by(id=order_id).first()
                if order:
                    order.status = 'shipped'
            # Note: Inventory is already updated when order is created, not when shipped
        
        # Create history entry if any changes were made
        if status_changed or tracking_changed or cost_changed or company_changed or date_changed:
            history = ShippingHistory(
                shipping_id=order_id,
                status=shipping.status,
                tracking_number=shipping.tracking_number,
                shipping_cost=shipping.shipping_cost,
                notes=data.get('notes', '')
            )
            db.session.add(history)
        
        db.session.commit()
        
        return jsonify({'message': 'Shipping updated successfully', 'shipping': shipping.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/reports/send-email', methods=['POST'])
def trigger_email_report():
    try:
        send_scheduled_reports()
        return jsonify({'message': 'Reports sent successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

        
@app.route('/api/reports/sales/pdf', methods=['GET'])
def export_sales_pdf():
    try:
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')

        # --- Fetch all sales ---
        query = Sale.query
        if start_date:
            query = query.filter(Sale.date_sold >= start_date)
        if end_date:
            query = query.filter(Sale.date_sold <= end_date)
        sales = query.order_by(Sale.date_sold.desc()).all()

        # --- Fetch all orders in range ---
        oq = Order.query
        if start_date:
            oq = oq.filter(Order.date >= start_date)
        if end_date:
            oq = oq.filter(Order.date <= end_date)
        orders = oq.order_by(Order.date.desc()).all()

        # --- Summary calculations ---
        total_revenue = sum(s.revenue or 0 for s in sales)
        total_cost = sum(s.cost or 0 for s in sales)
        total_profit = sum(s.profit or 0 for s in sales)
        total_units = sum(s.quantity_sold or 0 for s in sales)
        total_orders = len(orders)
        total_amount_paid = sum(o.amount_paid or 0 for o in orders)

        # --- Product breakdown ---
        product_map = {}
        for s in sales:
            batch = InventoryBatch.query.get(s.batch_id)
            product = Product.query.get(batch.product_id) if batch else None
            pid = product.id if product else 'Unknown'
            pname = product.name if product else 'Unknown'
            if pid not in product_map:
                product_map[pid] = {
                    'name': pname,
                    'units': 0,
                    'revenue': 0,
                    'cost': 0,
                    'profit': 0,
                    'orders': set()
                }
            product_map[pid]['units'] += s.quantity_sold or 0
            product_map[pid]['revenue'] += s.revenue or 0
            product_map[pid]['cost'] += s.cost or 0
            product_map[pid]['profit'] += s.profit or 0
            product_map[pid]['orders'].add(s.order_id)

        # --- Customer breakdown ---
        customer_map = {}
        for o in orders:
            cname = o.customer_name or 'Unknown'
            if cname not in customer_map:
                customer_map[cname] = {
                    'orders': 0,
                    'revenue': 0,
                    'amount_paid': 0,
                }
            customer_map[cname]['orders'] += 1
            customer_map[cname]['amount_paid'] += o.amount_paid or 0
            for s in sales:
                if s.order_id == o.id:
                    customer_map[cname]['revenue'] += s.revenue or 0

        # --- Build PDF ---
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=15*mm,
            leftMargin=15*mm,
            topMargin=15*mm,
            bottomMargin=15*mm
        )

        # Colors
        PRIMARY = colors.HexColor('#2FB7A1')
        DARK = colors.HexColor('#0F172A')
        LIGHT_BG = colors.HexColor('#F8FAFC')
        BORDER = colors.HexColor('#E3E8EF')
        PROFIT_GREEN = colors.HexColor('#16A34A')
        LOSS_RED = colors.HexColor('#DC2626')
        MUTED = colors.HexColor('#64748B')
        ROW_ALT = colors.HexColor('#F1F5F9')

        styles = getSampleStyleSheet()

        def style(name, **kwargs):
            return ParagraphStyle(name, **kwargs)

        title_style = style('Title', fontSize=22, textColor=DARK, fontName='Helvetica-Bold', spaceAfter=2)
        subtitle_style = style('Subtitle', fontSize=10, textColor=MUTED, fontName='Helvetica')
        section_style = style('Section', fontSize=13, textColor=DARK, fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=6)
        cell_style = style('Cell', fontSize=8, textColor=DARK, fontName='Helvetica')
        cell_right = style('CellRight', fontSize=8, textColor=DARK, fontName='Helvetica', alignment=TA_RIGHT)
        cell_bold = style('CellBold', fontSize=8, textColor=DARK, fontName='Helvetica-Bold')
        cell_bold_right = style('CellBoldRight', fontSize=8, textColor=DARK, fontName='Helvetica-Bold', alignment=TA_RIGHT)
        green_right = style('GreenRight', fontSize=8, textColor=PROFIT_GREEN, fontName='Helvetica-Bold', alignment=TA_RIGHT)
        red_right = style('RedRight', fontSize=8, textColor=LOSS_RED, fontName='Helvetica-Bold', alignment=TA_RIGHT)
        header_cell = style('HeaderCell', fontSize=8, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_CENTER)

        def fmt(n):
            return f"N{n:,.2f}"

        def profit_para(val):
            s = green_right if val >= 0 else red_right
            return Paragraph(fmt(val), s)

        story = []

        # ── Header ──
        now = datetime.now().strftime('%B %d, %Y %I:%M %p')
        date_range = ''
        if start_date or end_date:
            date_range = f"Period: {start_date or 'Start'} → {end_date or 'Today'}"

        header_data = [[
            Paragraph('Sales Report', title_style),
            Paragraph(f'Generated: {now}<br/>{date_range}', style('Right', fontSize=9, textColor=MUTED, alignment=TA_RIGHT))
        ]]
        header_table = Table(header_data, colWidths=['60%', '40%'])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(header_table)
        story.append(HRFlowable(width='100%', thickness=2, color=PRIMARY, spaceAfter=12))

        # ── Summary Cards ──
        story.append(Paragraph('Summary', section_style))

        margin = 15 * mm
        page_w = landscape(A4)[0] - 2 * margin
        col = page_w / 6

        def card(label, value, color=DARK):
            return [
                Paragraph(label, style(label, fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
                Paragraph(value, style(label+'v', fontSize=13, textColor=color, fontName='Helvetica-Bold', alignment=TA_CENTER))
            ]

        summary_data = [[
            *card('Total Revenue', fmt(total_revenue), PRIMARY),
            *card('Total Cost', fmt(total_cost), MUTED),
            *card('Gross Profit', fmt(total_profit), PROFIT_GREEN if total_profit >= 0 else LOSS_RED),
            *card('Total Orders', str(total_orders), DARK),
            *card('Units Sold', str(total_units), DARK),
            *card('Amount Collected', fmt(total_amount_paid), PRIMARY),
        ]]

        # Flatten into 2-row card layout
        card_row1 = [
            Paragraph('Total Revenue', style('l1', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Total Cost', style('l2', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Gross Profit', style('l3', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Total Orders', style('l4', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Units Sold', style('l5', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Amount Collected', style('l6', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
        ]
        card_row2 = [
            Paragraph(fmt(total_revenue), style('v1', fontSize=14, textColor=PRIMARY, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(fmt(total_cost), style('v2', fontSize=14, textColor=MUTED, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(fmt(total_profit), style('v3', fontSize=14, textColor=PROFIT_GREEN if total_profit >= 0 else LOSS_RED, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(str(total_orders), style('v4', fontSize=14, textColor=DARK, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(str(total_units), style('v5', fontSize=14, textColor=DARK, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(fmt(total_amount_paid), style('v6', fontSize=14, textColor=PRIMARY, fontName='Helvetica-Bold', alignment=TA_CENTER)),
        ]

        summary_table = Table([card_row1, card_row2], colWidths=[col]*6)
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
            ('BOX', (0,0), (-1,-1), 1, BORDER),
            ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER),
            ('ROWBACKGROUND', (0,0), (-1,0), [colors.HexColor('#EFF6FF')]),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('ROUNDEDCORNERS', [4]),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 14))

        # ── Product Breakdown ──
        story.append(Paragraph('Product Performance', section_style))

        prod_header = [
            Paragraph('Product', header_cell),
            Paragraph('Orders', header_cell),
            Paragraph('Units Sold', header_cell),
            Paragraph('Revenue', header_cell),
            Paragraph('Cost', header_cell),
            Paragraph('Gross Profit', header_cell),
            Paragraph('Margin %', header_cell),
        ]
        prod_rows = [prod_header]
        for pid, p in sorted(product_map.items(), key=lambda x: -x[1]['profit']):
            margin_pct = (p['profit'] / p['revenue'] * 100) if p['revenue'] else 0
            prod_rows.append([
                Paragraph(p['name'], cell_bold),
                Paragraph(str(len(p['orders'])), cell_right),
                Paragraph(str(p['units']), cell_right),
                Paragraph(fmt(p['revenue']), cell_right),
                Paragraph(fmt(p['cost']), cell_right),
                profit_para(p['profit']),
                Paragraph(f"{margin_pct:.1f}%", green_right if margin_pct >= 0 else red_right),
            ])

        # Totals row
        overall_margin = (total_profit / total_revenue * 100) if total_revenue else 0
        prod_rows.append([
            Paragraph('TOTAL', cell_bold),
            Paragraph(str(total_orders), cell_bold_right),
            Paragraph(str(total_units), cell_bold_right),
            Paragraph(fmt(total_revenue), cell_bold_right),
            Paragraph(fmt(total_cost), cell_bold_right),
            Paragraph(fmt(total_profit), style('tp', fontSize=8, textColor=PROFIT_GREEN if total_profit >= 0 else LOSS_RED, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
            Paragraph(f"{overall_margin:.1f}%", cell_bold_right),
        ])

        cw = page_w / 7
        prod_table = Table(prod_rows, colWidths=[cw*2, cw*0.7, cw*0.8, cw, cw, cw, cw*0.7])
        prod_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PRIMARY),
            ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#E2F4F1')),
            ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, ROW_ALT]),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LINEABOVE', (0,-1), (-1,-1), 1.5, PRIMARY),
        ]))
        story.append(prod_table)
        story.append(Spacer(1, 14))

        # ── Top Customers ──
        story.append(Paragraph('Top Customers', section_style))

        top_customers = sorted(customer_map.items(), key=lambda x: -x[1]['revenue'])[:15]

        cust_header = [
            Paragraph('Customer', header_cell),
            Paragraph('Orders', header_cell),
            Paragraph('Revenue', header_cell),
            Paragraph('Amount Paid', header_cell),
            Paragraph('Balance', header_cell),
        ]
        cust_rows = [cust_header]
        for cname, c in top_customers:
            balance = c['revenue'] - c['amount_paid']
            cust_rows.append([
                Paragraph(cname, cell_bold),
                Paragraph(str(c['orders']), cell_right),
                Paragraph(fmt(c['revenue']), cell_right),
                Paragraph(fmt(c['amount_paid']), cell_right),
                Paragraph(fmt(balance), style('bal', fontSize=8, textColor=LOSS_RED if balance > 0 else PROFIT_GREEN, fontName='Helvetica', alignment=TA_RIGHT)),
            ])

        cw2 = page_w / 5
        cust_table = Table(cust_rows, colWidths=[cw2*1.5, cw2*0.6, cw2, cw2, cw2])
        cust_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PRIMARY),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, ROW_ALT]),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(cust_table)
        story.append(PageBreak())

        # ── Individual Sales Transactions ──
        story.append(Paragraph('All Sales Transactions', section_style))

        txn_header = [
            Paragraph('Date', header_cell),
            Paragraph('Order ID', header_cell),
            Paragraph('Customer', header_cell),
            Paragraph('Product', header_cell),
            Paragraph('Qty', header_cell),
            Paragraph('Unit Price', header_cell),
            Paragraph('Cost/Unit', header_cell),
            Paragraph('Revenue', header_cell),
            Paragraph('Cost', header_cell),
            Paragraph('Profit', header_cell),
        ]
        txn_rows = [txn_header]

        for s in sales:
            batch = InventoryBatch.query.get(s.batch_id)
            product = Product.query.get(batch.product_id) if batch else None
            pname = product.name if product else 'Unknown'
            date_str = s.date_sold.strftime('%d/%m/%Y') if s.date_sold else '-'
            txn_rows.append([
                Paragraph(date_str, cell_style),
                Paragraph(s.order_id or '-', cell_style),
                Paragraph(s.customer_name or '-', cell_style),
                Paragraph(pname, cell_style),
                Paragraph(str(s.quantity_sold or 0), cell_right),
                Paragraph(fmt(s.selling_price_used or 0), cell_right),
                Paragraph(fmt(s.cost_price_used or 0), cell_right),
                Paragraph(fmt(s.revenue or 0), cell_right),
                Paragraph(fmt(s.cost or 0), cell_right),
                profit_para(s.profit or 0),
            ])

        cw3 = page_w / 10
        txn_table = Table(txn_rows, colWidths=[cw3*0.9, cw3*0.9, cw3*1.3, cw3*1.2, cw3*0.5, cw3, cw3, cw3, cw3, cw3])
        txn_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), PRIMARY),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, ROW_ALT]),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('FONTSIZE', (0,0), (-1,-1), 7.5),
        ]))
        story.append(txn_table)

        # ── Footer ──
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width='100%', thickness=1, color=BORDER))
        story.append(Paragraph(
            f'This report was auto-generated on {now}. All figures are in Nigerian Naira (NGN).',
            style('Footer', fontSize=7, textColor=MUTED, alignment=TA_CENTER, spaceBefore=6)
        ))

        doc.build(story)
        buffer.seek(0)

        filename = f"sales_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        print(f"PDF export error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/shipping/<order_id>/history', methods=['GET'])
def get_shipping_history(order_id):
    try:
        shipping = Shipping.query.filter_by(id=order_id).first()
        if not shipping:
            return jsonify({'error': 'Shipping record not found'}), 404
        
        history = ShippingHistory.query.filter_by(shipping_id=order_id).order_by(ShippingHistory.timestamp.desc()).all()
        history_data = [h.to_dict() for h in history]
        
        return jsonify({'history': history_data}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/customers', methods=['GET'])
def get_customers():
    try:
        search = request.args.get('search', '')
        if search:
            customers = Customer.query.filter(
                Customer.name.contains(search)
            ).limit(10).all()
        else:
            customers = Customer.query.all()
        customers_data = [c.to_dict() for c in customers]
        return jsonify({'customers': customers_data}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders/<order_id>/confirm-payment', methods=['POST'])
def confirm_payment(order_id):
    try:
        order = Order.query.filter_by(id=order_id).first()
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update payment information
        order.payment_reference = data.get('paymentReference')
        order.payment_proof = data.get('paymentProof')
        order.payment_confirmed = True
        order.status = 'confirmed'
        
        db.session.commit()
        
        return jsonify({
            'message': 'Payment confirmed successfully',
            'order': order.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/products/search', methods=['GET'])
def search_products():
    try:
        query = request.args.get('id', '')
        products = Product.query.filter(
            (Product.id.contains(query)) | (Product.name.contains(query))
        ).all()
        products_data = [p.to_dict() for p in products]
        return jsonify({'products': products_data}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/verify', methods=['GET'])
def verify_inventory():
    """Verify sold quantities by comparing inventory with actual orders"""
    try:
        # Get all products
        products = Product.query.all()
        # Get all orders
        orders = Order.query.all()
        
        # Calculate actual sold quantities from orders
        actual_sold = {}
        for order in orders:
            product_id = order.product_id
            if product_id not in actual_sold:
                actual_sold[product_id] = 0
            actual_sold[product_id] += order.quantity
        
        # Compare with inventory
        discrepancies = []
        total_orders_sold = 0
        total_inventory_sold = 0
        
        for product in products:
            actual = actual_sold.get(product.id, 0)
            stored = product.sold
            total_orders_sold += actual
            total_inventory_sold += stored
            
            if actual != stored:
                discrepancies.append({
                    'productId': product.id,
                    'productName': product.name,
                    'inventorySold': stored,
                    'ordersSold': actual,
                    'difference': actual - stored
                })
        
        return jsonify({
            'discrepancies': discrepancies,
            'summary': {
                'totalProducts': len(products),
                'productsWithDiscrepancies': len(discrepancies),
                'totalOrdersSold': total_orders_sold,
                'totalInventorySold': total_inventory_sold,
                'difference': total_orders_sold - total_inventory_sold
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/fix', methods=['POST'])
def fix_inventory():
    """Fix inventory sold quantities based on actual orders"""
    try:
        # Get all products
        products = Product.query.all()
        # Get all orders
        orders = Order.query.all()
        
        # Calculate actual sold quantities from orders
        actual_sold = {}
        for order in orders:
            product_id = order.product_id
            if product_id not in actual_sold:
                actual_sold[product_id] = 0
            actual_sold[product_id] += order.quantity
        
        # Update inventory
        fixed_count = 0
        for product in products:
            actual = actual_sold.get(product.id, 0)
            if product.sold != actual:
                product.sold = actual
                fixed_count += 1
        
        db.session.commit()
        
        # Return updated inventory
        products = Product.query.all()
        products_data = [p.to_dict() for p in products]
        total_sold = sum(p.sold for p in products)
        
        return jsonify({
            'message': f'Inventory fixed successfully. {fixed_count} product(s) updated.',
            'products': products_data,
            'totalSold': total_sold,
            'fixedCount': fixed_count
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Customer drill-down endpoint - supports both ID and name
@app.route('/api/customers/<identifier>/purchases', methods=['GET', 'OPTIONS'])
def get_customer_purchases(identifier):
    try:
        # Try to find customer by ID first, then by name
        customer = None
        if identifier.isdigit():
            customer = Customer.query.filter_by(id=int(identifier)).first()
        else:
            customer = Customer.query.filter_by(name=identifier).first()
        
        if not customer:
            return jsonify({
                'error': 'Customer not found',
                'message': f'No customer found with identifier: {identifier}'
            }), 404
        
        # Get all sales for this customer (by name)
        sales = Sale.query.filter_by(customer_name=customer.name).order_by(Sale.date_sold.desc()).all()
        
        purchases = []
        total_revenue = 0.0
        total_cost = 0.0
        
        for sale in sales:
            batch = Batch.query.filter_by(id=sale.batch_id).first()
            product = Product.query.filter_by(id=batch.product_id).first() if batch else None
            
            purchase = {
                'id': sale.id,
                'saleId': sale.id,
                'date': sale.date_sold.strftime('%Y-%m-%d') if sale.date_sold else None,
                'dateSold': sale.date_sold.strftime('%Y-%m-%d') if sale.date_sold else None,
                'productName': product.name if product else 'Unknown Product',
                'product': product.to_dict() if product else None,
                'batchId': sale.batch_id,
                'batch': batch.to_dict() if batch else None,
                'quantity': sale.quantity_sold,
                'quantitySold': sale.quantity_sold,
                'costPriceUsed': sale.cost_price_used,
                'costPriceFifo': sale.cost_price_used,
                'sellingPriceUsed': sale.selling_price_used,
                'sellingPrice': sale.selling_price_used,
                'revenue': sale.revenue,
                'cost': sale.cost,
                'profit': sale.profit
            }
            
            purchases.append(purchase)
            total_revenue += sale.revenue
            total_cost += sale.cost
        
        return jsonify({
            'customer': {
                'id': customer.id,
                'name': customer.name,
                'email': customer.email,
                'phone': customer.phone,
                'address': customer.address,
                'firstOrderDate': customer.first_order_date.strftime('%Y-%m-%d') if customer.first_order_date else None,
                'lastOrderDate': customer.last_order_date.strftime('%Y-%m-%d') if customer.last_order_date else None,
                'totalOrders': customer.total_orders,
                'totalSpent': customer.total_spent
            },
            'purchases': purchases,
            'summary': {
                'totalPurchases': len(purchases),
                'totalRevenue': total_revenue,
                'totalCost': total_cost,
                'totalCostFifo': total_cost,
                'totalProfit': total_revenue - total_cost
            }
        }), 200
    except ValueError:
        return jsonify({
            'error': 'Invalid customer identifier',
            'message': f'Invalid identifier format: {identifier}'
        }), 400
    except Exception as e:
        import traceback
        print(f"Error in get_customer_purchases: {traceback.format_exc()}")
        return jsonify({
            'error': 'Internal server error',
            'message': 'An error occurred while fetching customer purchases'
        }), 500

# Sales report with FIFO breakdown
@app.route('/api/reports/sales', methods=['GET'])
def get_sales_report():
    try:
        product_id = request.args.get('productId')
        date_from = request.args.get('dateFrom')
        date_to = request.args.get('dateTo')
        
        # Get all sales
        query = Sale.query
        if product_id:
            # Get batches for this product
            batches = Batch.query.filter_by(product_id=product_id).all()
            batch_ids = [b.id for b in batches]
            query = query.filter(Sale.batch_id.in_(batch_ids))
        
        if date_from:
            query = query.filter(Sale.date_sold >= datetime.strptime(date_from, '%Y-%m-%d').date())
        if date_to:
            query = query.filter(Sale.date_sold <= datetime.strptime(date_to, '%Y-%m-%d').date())
        
        sales = query.order_by(Sale.date_sold.desc()).all()
        
        # Group by product
        product_summary = {}
        total_revenue = 0.0
        total_cost = 0.0
        total_profit = 0.0
        
        for sale in sales:
            batch = Batch.query.filter_by(id=sale.batch_id).first()
            if not batch:
                continue
            
            product = Product.query.filter_by(id=batch.product_id).first()
            if not product:
                continue
            
            product_id_key = product.id
            
            if product_id_key not in product_summary:
                product_summary[product_id_key] = {
                    'product': product.to_dict(),
                    'batches': {},
                    'totalSold': 0,
                    'totalRevenue': 0.0,
                    'totalCost': 0.0,
                    'totalProfit': 0.0
                }
            
            # Group by batch
            batch_id_key = batch.id
            if batch_id_key not in product_summary[product_id_key]['batches']:
                product_summary[product_id_key]['batches'][batch_id_key] = {
                    'batch': batch.to_dict(),
                    'sales': [],
                    'totalSold': 0,
                    'totalRevenue': 0.0,
                    'totalCost': 0.0,
                    'totalProfit': 0.0
                }
            
            product_summary[product_id_key]['batches'][batch_id_key]['sales'].append(sale.to_dict())
            product_summary[product_id_key]['batches'][batch_id_key]['totalSold'] += sale.quantity_sold
            product_summary[product_id_key]['batches'][batch_id_key]['totalRevenue'] += sale.revenue
            product_summary[product_id_key]['batches'][batch_id_key]['totalCost'] += sale.cost
            product_summary[product_id_key]['batches'][batch_id_key]['totalProfit'] += sale.profit
            
            product_summary[product_id_key]['totalSold'] += sale.quantity_sold
            product_summary[product_id_key]['totalRevenue'] += sale.revenue
            product_summary[product_id_key]['totalCost'] += sale.cost
            product_summary[product_id_key]['totalProfit'] += sale.profit
            
            total_revenue += sale.revenue
            total_cost += sale.cost
            total_profit += sale.profit
        
        # Convert batches dict to list
        for product_id_key in product_summary:
            product_summary[product_id_key]['batches'] = list(product_summary[product_id_key]['batches'].values())
        
        return jsonify({
            'products': list(product_summary.values()),
            'summary': {
                'totalRevenue': total_revenue,
                'totalCost': total_cost,
                'totalProfit': total_profit,
                'unitsSold': sum(s.quantity_sold for s in sales)
            }
        }), 200
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

# Update batch price (with price change log)
@app.route('/api/batches/<batch_id>/price', methods=['PATCH'])
def update_batch_price(batch_id):
    try:
        batch = Batch.query.filter_by(id=batch_id).first()
        if not batch:
            return jsonify({'error': 'Batch not found'}), 404
        
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Track price changes
        price_changes = []
        
        if 'costPrice' in data:
            new_cost = float(data['costPrice'])
            if new_cost != batch.cost_price:
                price_change = PriceChange(
                    batch_id=batch_id,
                    change_type='cost',
                    old_price=batch.cost_price,
                    new_price=new_cost,
                    changed_by=data.get('changedBy', 'System'),
                    notes=data.get('notes')
                )
                db.session.add(price_change)
                price_changes.append(price_change.to_dict())
                batch.cost_price = new_cost
        
        if 'sellingPrice' in data:
            new_selling = float(data['sellingPrice'])
            if new_selling != batch.selling_price:
                price_change = PriceChange(
                    batch_id=batch_id,
                    change_type='selling',
                    old_price=batch.selling_price,
                    new_price=new_selling,
                    changed_by=data.get('changedBy', 'System'),
                    notes=data.get('notes')
                )
                db.session.add(price_change)
                price_changes.append(price_change.to_dict())
                batch.selling_price = new_selling
        
        db.session.commit()
        
        return jsonify({
            'message': 'Batch price updated successfully',
            'batch': batch.to_dict(),
            'priceChanges': price_changes
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Get price change history for a batch
@app.route('/api/batches/<batch_id>/price-history', methods=['GET'])
def get_batch_price_history(batch_id):
    try:
        batch = Batch.query.filter_by(id=batch_id).first()
        if not batch:
            return jsonify({'error': 'Batch not found'}), 404
        
        price_changes = PriceChange.query.filter_by(batch_id=batch_id).order_by(PriceChange.date_changed.desc()).all()
        
        return jsonify({
            'batch': batch.to_dict(),
            'priceHistory': [pc.to_dict() for pc in price_changes]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Price Change Log Report endpoint
@app.route('/api/reports/price-changes', methods=['GET'])
def get_price_change_log():
    """Get a flattened list of all price changes with product and batch context.
    
    Optional query params:
      - productId: filter changes to a specific product
    """
    try:
        product_id = request.args.get('productId')

        # Join PriceChange -> Batch -> Product for context
        query = PriceChange.query.join(Batch, PriceChange.batch_id == Batch.id)\
            .join(Product, Batch.product_id == Product.id)

        if product_id:
            query = query.filter(Product.id == product_id)

        changes = query.order_by(PriceChange.date_changed.desc()).all()

        results = []
        for change in changes:
            batch = change.batch
            product = batch.product if batch else None

            results.append({
                'id': change.id,
                'productId': product.id if product else None,
                'productName': product.name if product else None,
                'batchId': batch.id if batch else change.batch_id,
                'changeType': change.change_type,
                'oldPrice': change.old_price,
                'newPrice': change.new_price,
                'dateChanged': change.date_changed.isoformat() if change.date_changed else None,
                'changedBy': change.changed_by,
                'notes': change.notes
            })

        return jsonify({'changes': results}), 200
    except Exception as e:
        import traceback
        print(f"Error in get_price_change_log: {traceback.format_exc()}")
        return jsonify({'error': 'Internal server error while fetching price change log'}), 500

# Inventory Report endpoint
@app.route('/api/inventory-report', methods=['GET'])
def get_inventory_report():
    try:
        # Get all products with their batches
        products = Product.query.all()
        
        batches_data = []
        total_products = len(products)
        total_batches = 0
        total_units = 0
        total_inventory_value = 0.0
        low_stock_count = 0
        low_stock_threshold = 50
        
        for product in products:
            batches = Batch.query.filter_by(product_id=product.id).order_by(Batch.date_added.asc()).all()
            
            for batch in batches:
                inventory_value = batch.quantity_remaining * batch.cost_price
                is_low_stock = batch.quantity_remaining < low_stock_threshold
                
                if is_low_stock:
                    low_stock_count += 1
                
                batch_data = {
                    'productId': product.id,
                    'productName': product.name,
                    'batchId': batch.id,
                    'dateAdded': batch.date_added.strftime('%Y-%m-%d') if batch.date_added else None,
                    'costPrice': batch.cost_price,
                    'sellingPrice': batch.selling_price,
                    'quantityAdded': batch.quantity_added,
                    'quantitySold': batch.quantity_sold,
                    'quantityRemaining': batch.quantity_remaining,
                    'inventoryValue': inventory_value,
                    'supplier': batch.supplier,
                    'isLowStock': is_low_stock
                }
                
                batches_data.append(batch_data)
                total_batches += 1
                total_units += batch.quantity_remaining
                total_inventory_value += inventory_value
        
        return jsonify({
            'batches': batches_data,
            'summary': {
                'totalProducts': total_products,
                'totalBatches': total_batches,
                'totalUnitsInStock': total_units,
                'totalInventoryValue': total_inventory_value,
                'lowStockCount': low_stock_count,
                'lowStockThreshold': low_stock_threshold
            }
        }), 200
    except Exception as e:
        import traceback
        print(f"Error in get_inventory_report: {traceback.format_exc()}")
        return jsonify({
            'error': 'Internal server error',
            'message': 'An error occurred while fetching inventory report'
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'API is running'}), 200

# 404 Error Handler for undefined API routes
@app.errorhandler(404)
def not_found(error):
    # Handle OPTIONS requests that fall through to 404
    if request.method == "OPTIONS":
        response = jsonify({'status': 'ok'})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type, Authorization")
        response.headers.add('Access-Control-Allow-Methods', "GET, POST, PATCH, PUT, DELETE, OPTIONS")
        response.headers.add('Access-Control-Max-Age', "3600")
        return response, 200
    
    if request.path.startswith('/api/'):
        response = jsonify({
            'error': 'Endpoint not found',
            'message': f'The API endpoint {request.path} does not exist',
            'path': request.path,
            'method': request.method
        })
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 404
    return jsonify({'error': 'Not found'}), 404

# 500 Error Handler
@app.errorhandler(500)
def internal_error(error):
    if request.path.startswith('/api/'):
        return jsonify({
            'error': 'Internal server error',
            'message': 'An unexpected error occurred',
            'path': request.path
        }), 500
    return jsonify({'error': 'Internal server error'}), 500

# Handle OPTIONS requests for CORS preflight - MUST be before error handlers
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        # Create response with proper CORS headers
        response = jsonify({'status': 'ok'})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type, Authorization")
        response.headers.add('Access-Control-Allow-Methods', "GET, POST, PATCH, PUT, DELETE, OPTIONS")
        response.headers.add('Access-Control-Max-Age', "3600")
        # Return response immediately to stop further processing
        return response


@app.route('/api/inventory/<product_id>', methods=['DELETE'])
def delete_product(product_id):
    try:
        product = Product.query.filter_by(id=product_id).first()
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Delete related records first to avoid foreign key constraints
        # Get all batches for this product
        batches = Batch.query.filter_by(product_id=product_id).all()
        for batch in batches:
            # Delete price changes for each batch
            PriceChange.query.filter_by(batch_id=batch.id).delete()
            # Delete sales for each batch
            Sale.query.filter_by(batch_id=batch.id).delete()
        
        # Delete all batches
        Batch.query.filter_by(product_id=product_id).delete()
        
        # Delete related orders and their shipping
        orders = Order.query.filter_by(product_id=product_id).all()
        for order in orders:
            ShippingHistory.query.filter_by(shipping_id=order.id).delete()
            Shipping.query.filter_by(id=order.id).delete()
        Order.query.filter_by(product_id=product_id).delete()
        
        # Now safe to delete product
        db.session.delete(product)
        db.session.commit()
        
        return jsonify({'message': 'Product deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Error deleting product: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

def generate_pdf_report(report_type="sales"):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4),
                            rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm)

    # Black & white color scheme
    BLACK      = colors.HexColor('#000000')
    DARK       = colors.HexColor('#1A1A1A')
    MID        = colors.HexColor('#444444')
    MUTED      = colors.HexColor('#777777')
    LIGHT_BG   = colors.HexColor('#F2F2F2')
    ROW_ALT    = colors.HexColor('#F9F9F9')
    BORDER     = colors.HexColor('#CCCCCC')
    HEADER_BG  = colors.HexColor('#1A1A1A')
    TOTAL_BG   = colors.HexColor('#E0E0E0')

    page_w = landscape(A4)[0] - 30*mm

    def st(name, **kw):
        return ParagraphStyle(name, **kw)

    header_cell = st('H',   fontSize=8,  textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_CENTER)
    cell        = st('C',   fontSize=8,  textColor=DARK,         fontName='Helvetica')
    cell_r      = st('CR',  fontSize=8,  textColor=DARK,         fontName='Helvetica',      alignment=TA_RIGHT)
    cell_c      = st('CC',  fontSize=8,  textColor=DARK,         fontName='Helvetica',      alignment=TA_CENTER)
    cell_b      = st('CB',  fontSize=8,  textColor=DARK,         fontName='Helvetica-Bold')
    cell_br     = st('CBR', fontSize=8,  textColor=DARK,         fontName='Helvetica-Bold', alignment=TA_RIGHT)
    section_st  = st('SEC', fontSize=13, textColor=BLACK,        fontName='Helvetica-Bold', spaceBefore=14, spaceAfter=6)

    def fmt(n):
        return f"N{n:,.2f}"

    def profit_para(val):
        # In B&W: positive = bold black, negative = bold with parentheses
        if val >= 0:
            return Paragraph(fmt(val), cell_br)
        else:
            return Paragraph(f"({fmt(abs(val))})", st('neg', fontSize=8, textColor=DARK,
                             fontName='Helvetica-Bold', alignment=TA_RIGHT))

    def add_report_header(title, subtitle=""):
        hdr = Table([[
            Paragraph(title, st('T', fontSize=22, textColor=BLACK, fontName='Helvetica-Bold')),
            Paragraph(f'Generated: {now_str}<br/>{subtitle}',
                      st('TR', fontSize=9, textColor=MUTED, fontName='Helvetica', alignment=TA_RIGHT))
        ]], colWidths=['60%', '40%'])
        hdr.setStyle(TableStyle([
            ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(hdr)
        story.append(HRFlowable(width='100%', thickness=2, color=BLACK, spaceAfter=12))

    def make_summary_table(labels, values, ncols):
        col_w = page_w / ncols
        label_row = [Paragraph(l, st(f'sl{i}', fontSize=7, textColor=MUTED,
                               fontName='Helvetica', alignment=TA_CENTER)) for i, l in enumerate(labels)]
        val_row   = [Paragraph(v, st(f'sv{i}', fontSize=13, textColor=BLACK,
                               fontName='Helvetica-Bold', alignment=TA_CENTER)) for i, v in enumerate(values)]
        tbl = Table([label_row, val_row], colWidths=[col_w]*ncols)
        tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,-1), LIGHT_BG),
            ('BOX',           (0,0), (-1,-1), 1, BORDER),
            ('INNERGRID',     (0,0), (-1,-1), 0.5, BORDER),
            ('TOPPADDING',    (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ]))
        return tbl

    def make_table(rows, col_widths):
        tbl = Table(rows, colWidths=col_widths)
        tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0),  (-1,0),  HEADER_BG),
            ('BACKGROUND',    (0,-1), (-1,-1), TOTAL_BG),
            ('ROWBACKGROUNDS',(0,1),  (-1,-2), [colors.white, ROW_ALT]),
            ('GRID',          (0,0),  (-1,-1), 0.5, BORDER),
            ('TOPPADDING',    (0,0),  (-1,-1), 5),
            ('BOTTOMPADDING', (0,0),  (-1,-1), 5),
            ('LEFTPADDING',   (0,0),  (-1,-1), 5),
            ('RIGHTPADDING',  (0,0),  (-1,-1), 5),
            ('VALIGN',        (0,0),  (-1,-1), 'MIDDLE'),
            ('LINEABOVE',     (0,-1), (-1,-1), 1.5, BLACK),
        ]))
        return tbl

    story    = []
    now_str  = datetime.now().strftime('%B %d, %Y %I:%M %p')

    # ══════════════════════════════════════════════════════════════
    #  INVENTORY REPORT
    # ══════════════════════════════════════════════════════════════
    if report_type == "inventory":
        add_report_header("Inventory Report")

        products    = Product.query.all()
        total_value = 0
        total_units = 0
        low_count   = 0

        for product in products:
            batches = Batch.query.filter_by(product_id=product.id).all()
            qty     = sum(b.quantity_remaining for b in batches)
            latest  = max(batches, key=lambda b: b.date_added) if batches else None
            cost    = latest.cost_price if latest else 0
            total_value += qty * cost
            total_units += qty
            if qty < 50:
                low_count += 1

        story.append(make_summary_table(
            ['Total Products', 'Total Units in Stock', 'Inventory Value', 'Low Stock Items'],
            [str(len(products)), str(total_units), fmt(total_value), str(low_count)],
            4
        ))
        story.append(Spacer(1, 14))
        story.append(Paragraph('Stock by Product & Batch', section_st))

        rows = [[
            Paragraph('Product',         header_cell),
            Paragraph('Batch ID',        header_cell),
            Paragraph('Date Added',      header_cell),
            Paragraph('Supplier',        header_cell),
            Paragraph('Added',           header_cell),
            Paragraph('Sold',            header_cell),
            Paragraph('Remaining',       header_cell),
            Paragraph('Cost Price',      header_cell),
            Paragraph('Selling Price',   header_cell),
            Paragraph('Inventory Value', header_cell),
            Paragraph('Status',          header_cell),
        ]]

        for product in products:
            batches = Batch.query.filter_by(product_id=product.id).order_by(Batch.date_added.asc()).all()
            for i, batch in enumerate(batches):
                value  = batch.quantity_remaining * batch.cost_price
                is_low = batch.quantity_remaining < 50
                rows.append([
                    Paragraph(product.name if i == 0 else '', cell_b),
                    Paragraph(batch.id,  cell),
                    Paragraph(batch.date_added.strftime('%d/%m/%Y') if batch.date_added else '-', cell_c),
                    Paragraph(batch.supplier or '-', cell),
                    Paragraph(str(batch.quantity_added),     cell_r),
                    Paragraph(str(batch.quantity_sold),      cell_r),
                    Paragraph(str(batch.quantity_remaining), cell_r),
                    Paragraph(fmt(batch.cost_price),         cell_r),
                    Paragraph(fmt(batch.selling_price),      cell_r),
                    Paragraph(fmt(value),                    cell_br),
                    Paragraph('LOW STOCK' if is_low else 'OK',
                              st('st', fontSize=7, textColor=DARK,
                                 fontName='Helvetica-Bold', alignment=TA_CENTER)),
                ])

        rows.append([
            Paragraph('TOTAL', cell_br),
            Paragraph('', cell), Paragraph('', cell), Paragraph('', cell),
            Paragraph('', cell_r), Paragraph('', cell_r),
            Paragraph(str(total_units), cell_br),
            Paragraph('', cell_r), Paragraph('', cell_r),
            Paragraph(fmt(total_value), cell_br),
            Paragraph('', cell),
        ])

        cw = page_w / 11
        story.append(make_table(rows, [cw*1.6, cw*1.4, cw*0.9, cw*0.9,
                                       cw*0.7, cw*0.7, cw*0.8, cw*0.9,
                                       cw*0.9, cw, cw*0.8]))

    # ══════════════════════════════════════════════════════════════
    #  SALES REPORT
    # ══════════════════════════════════════════════════════════════
    elif report_type == "sales":
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc).date() - timedelta(days=REPORT_INTERVAL_DAYS)
        sales  = Sale.query.filter(Sale.date_sold >= cutoff).order_by(Sale.date_sold.desc()).all()
        orders = Order.query.filter(Order.date_created >= cutoff).all()

        total_revenue     = sum(s.revenue or 0 for s in sales)
        total_cost        = sum(s.cost    or 0 for s in sales)
        total_profit      = sum(s.profit  or 0 for s in sales)
        total_units       = sum(s.quantity_sold or 0 for s in sales)
        total_orders      = len(orders)
        total_amount_paid = sum(o.amount_paid or 0 for o in orders)
        overall_margin    = (total_profit / total_revenue * 100) if total_revenue else 0

        add_report_header("Sales Report", f"Period: Last {REPORT_INTERVAL_DAYS} days")

        # Summary cards
        story.append(make_summary_table(
            ['Total Revenue', 'Total Cost (COGS)', 'Gross Profit', 'Total Orders', 'Units Sold', 'Amount Collected'],
            [fmt(total_revenue), fmt(total_cost), fmt(total_profit),
             str(total_orders), str(total_units), fmt(total_amount_paid)],
            6
        ))
        story.append(Spacer(1, 14))

        # ── Product Performance ──
        story.append(Paragraph('Product Performance', section_st))

        product_map = {}
        for s in sales:
            batch   = Batch.query.get(s.batch_id)
            product = Product.query.get(batch.product_id) if batch else None
            pid     = product.id   if product else 'Unknown'
            pname   = product.name if product else 'Unknown'
            if pid not in product_map:
                product_map[pid] = {'name': pname, 'units': 0, 'revenue': 0,
                                    'cost': 0, 'profit': 0, 'orders': set()}
            product_map[pid]['units']   += s.quantity_sold or 0
            product_map[pid]['revenue'] += s.revenue       or 0
            product_map[pid]['cost']    += s.cost          or 0
            product_map[pid]['profit']  += s.profit        or 0
            product_map[pid]['orders'].add(s.order_id)

        prod_rows = [[
            Paragraph('Product',      header_cell),
            Paragraph('Orders',       header_cell),
            Paragraph('Units Sold',   header_cell),
            Paragraph('Revenue',      header_cell),
            Paragraph('Cost',         header_cell),
            Paragraph('Gross Profit', header_cell),
            Paragraph('Margin %',     header_cell),
        ]]
        for pid, p in sorted(product_map.items(), key=lambda x: -x[1]['profit']):
            margin_pct = (p['profit'] / p['revenue'] * 100) if p['revenue'] else 0
            prod_rows.append([
                Paragraph(p['name'],             cell_b),
                Paragraph(str(len(p['orders'])), cell_r),
                Paragraph(str(p['units']),        cell_r),
                Paragraph(fmt(p['revenue']),      cell_r),
                Paragraph(fmt(p['cost']),         cell_r),
                profit_para(p['profit']),
                Paragraph(f"{margin_pct:.1f}%",  cell_r),
            ])
        prod_rows.append([
            Paragraph('TOTAL',            cell_br),
            Paragraph(str(total_orders),  cell_br),
            Paragraph(str(total_units),   cell_br),
            Paragraph(fmt(total_revenue), cell_br),
            Paragraph(fmt(total_cost),    cell_br),
            profit_para(total_profit),
            Paragraph(f"{overall_margin:.1f}%", cell_br),
        ])
        cw7 = page_w / 7
        story.append(make_table(prod_rows, [cw7*1.8, cw7*0.7, cw7*0.8, cw7, cw7, cw7, cw7*0.7]))
        story.append(Spacer(1, 14))

        # ── Top Customers ──
        story.append(Paragraph('Top Customers', section_st))

        customer_map = {}
        for o in orders:
            cname = o.customer_name or 'Unknown'
            if cname not in customer_map:
                customer_map[cname] = {'orders': 0, 'revenue': 0, 'amount_paid': 0}
            customer_map[cname]['orders']      += 1
            customer_map[cname]['amount_paid'] += o.amount_paid or 0
            for s in sales:
                if s.order_id == o.id:
                    customer_map[cname]['revenue'] += s.revenue or 0

        cust_rows = [[
            Paragraph('Customer',    header_cell),
            Paragraph('Orders',      header_cell),
            Paragraph('Revenue',     header_cell),
            Paragraph('Amount Paid', header_cell),
            Paragraph('Balance',     header_cell),
        ]]
        for cname, c in sorted(customer_map.items(), key=lambda x: -x[1]['revenue'])[:15]:
            balance = c['revenue'] - c['amount_paid']
            cust_rows.append([
                Paragraph(cname,                 cell_b),
                Paragraph(str(c['orders']),      cell_r),
                Paragraph(fmt(c['revenue']),     cell_r),
                Paragraph(fmt(c['amount_paid']), cell_r),
                profit_para(-balance) if balance <= 0 else Paragraph(f"({fmt(balance)})", cell_br),
            ])
        # No totals row needed for customers — remove last TOTAL_BG style trick
        cw5 = page_w / 5
        cust_tbl = Table(cust_rows, colWidths=[cw5*1.5, cw5*0.6, cw5, cw5, cw5])
        cust_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,0),  HEADER_BG),
            ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white, ROW_ALT]),
            ('GRID',          (0,0), (-1,-1), 0.5, BORDER),
            ('TOPPADDING',    (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING',   (0,0), (-1,-1), 5),
            ('RIGHTPADDING',  (0,0), (-1,-1), 5),
            ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(cust_tbl)
        story.append(PageBreak())

        # ── All Sales Transactions ──
        story.append(Paragraph('All Sales Transactions', section_st))

        txn_rows = [[
            Paragraph('Date',       header_cell),
            Paragraph('Order ID',   header_cell),
            Paragraph('Customer',   header_cell),
            Paragraph('Product',    header_cell),
            Paragraph('Batch',      header_cell),
            Paragraph('Qty',        header_cell),
            Paragraph('Unit Price', header_cell),
            Paragraph('Cost/Unit',  header_cell),
            Paragraph('Revenue',    header_cell),
            Paragraph('Cost',       header_cell),
            Paragraph('Profit',     header_cell),
        ]]
        for s in sales:
            batch   = Batch.query.get(s.batch_id)
            product = Product.query.get(batch.product_id) if batch else None
            pname   = product.name if product else 'Unknown'
            txn_rows.append([
                Paragraph(s.date_sold.strftime('%d/%m/%Y') if s.date_sold else '-', cell),
                Paragraph(s.order_id or '-',      cell),
                Paragraph(s.customer_name or '-', cell),
                Paragraph(pname,                  cell_b),
                Paragraph(s.batch_id or '-',      cell),
                Paragraph(str(s.quantity_sold or 0),       cell_r),
                Paragraph(fmt(s.selling_price_used or 0),  cell_r),
                Paragraph(fmt(s.cost_price_used    or 0),  cell_r),
                Paragraph(fmt(s.revenue            or 0),  cell_r),
                Paragraph(fmt(s.cost               or 0),  cell_r),
                profit_para(s.profit or 0),
            ])

        cw11 = page_w / 11
        txn_tbl = Table(txn_rows, colWidths=[cw11*0.85, cw11*0.85, cw11*1.2,
                                              cw11*1.1,  cw11*1.1,  cw11*0.5,
                                              cw11,      cw11,      cw11, cw11, cw11])
        txn_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,0),  HEADER_BG),
            ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white, ROW_ALT]),
            ('GRID',          (0,0), (-1,-1), 0.5, BORDER),
            ('TOPPADDING',    (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING',   (0,0), (-1,-1), 4),
            ('RIGHTPADDING',  (0,0), (-1,-1), 4),
            ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
            ('FONTSIZE',      (0,0), (-1,-1), 7.5),
        ]))
        story.append(txn_tbl)

    # ── Footer ──
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width='100%', thickness=1, color=BORDER))
    story.append(Paragraph(
        f'Auto-generated by Affluence Global Inventory Portal · {now_str}. All figures in Nigerian Naira (NGN).',
        st('ft', fontSize=7, textColor=MUTED, alignment=TA_CENTER, spaceBefore=6)))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4),
                            rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm)

    PRIMARY = colors.HexColor('#2FB7A1')
    DARK = colors.HexColor('#0F172A')
    MUTED = colors.HexColor('#64748B')
    BORDER = colors.HexColor('#E3E8EF')
    LIGHT_BG = colors.HexColor('#F8FAFC')
    ROW_ALT = colors.HexColor('#F1F5F9')
    GREEN = colors.HexColor('#16A34A')
    RED = colors.HexColor('#DC2626')
    BLUE_BG = colors.HexColor('#EFF6FF')

    page_w = landscape(A4)[0] - 30*mm

    def st(name, **kw):
        return ParagraphStyle(name, **kw)

    header_cell  = st('H',   fontSize=8, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_CENTER)
    cell         = st('C',   fontSize=8, textColor=DARK,         fontName='Helvetica')
    cell_r       = st('CR',  fontSize=8, textColor=DARK,         fontName='Helvetica',      alignment=TA_RIGHT)
    cell_c       = st('CC',  fontSize=8, textColor=DARK,         fontName='Helvetica',      alignment=TA_CENTER)
    cell_b       = st('CB',  fontSize=8, textColor=DARK,         fontName='Helvetica-Bold')
    cell_br      = st('CBR', fontSize=8, textColor=DARK,         fontName='Helvetica-Bold', alignment=TA_RIGHT)
    cell_bc      = st('CBC', fontSize=8, textColor=DARK,         fontName='Helvetica-Bold', alignment=TA_CENTER)
    section_st   = st('SEC', fontSize=13, textColor=DARK,        fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=6)

    def fmt(n):
        return f"N{n:,.2f}"

    def profit_para(val):
        s = st('pp', fontSize=8, textColor=GREEN if val >= 0 else RED,
               fontName='Helvetica-Bold', alignment=TA_RIGHT)
        return Paragraph(fmt(val), s)

    story = []
    now_str = datetime.now().strftime('%B %d, %Y %I:%M %p')

    # ── Shared header ──────────────────────────────────────────────────────────
    def add_report_header(title, subtitle=""):
        hdr = Table([[
            Paragraph(title, st('T', fontSize=22, textColor=DARK, fontName='Helvetica-Bold')),
            Paragraph(f'Generated: {now_str}<br/>{subtitle}',
                      st('TR', fontSize=9, textColor=MUTED, fontName='Helvetica', alignment=TA_RIGHT))
        ]], colWidths=['60%', '40%'])
        hdr.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
        story.append(hdr)
        story.append(HRFlowable(width='100%', thickness=2, color=PRIMARY, spaceAfter=12))

    # ══════════════════════════════════════════════════════════════════════════
    #  INVENTORY REPORT
    # ══════════════════════════════════════════════════════════════════════════
    if report_type == "inventory":
        add_report_header("Inventory Report")

        products    = Product.query.all()
        total_value = 0
        total_units = 0
        low_count   = 0

        # ── Summary cards ──
        for product in products:
            batches = Batch.query.filter_by(product_id=product.id).all()
            qty     = sum(b.quantity_remaining for b in batches)
            latest  = max(batches, key=lambda b: b.date_added) if batches else None
            cost    = latest.cost_price if latest else 0
            total_value += qty * cost
            total_units += qty
            if qty < 50:
                low_count += 1

        col4 = page_w / 4
        card_labels = [
            Paragraph('Total Products',      st('l1', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Total Units in Stock', st('l2', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Inventory Value',     st('l3', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Low Stock Items',     st('l4', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
        ]
        card_vals = [
            Paragraph(str(len(products)),   st('v1', fontSize=14, textColor=DARK,    fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(str(total_units),     st('v2', fontSize=14, textColor=PRIMARY, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(fmt(total_value),     st('v3', fontSize=14, textColor=PRIMARY, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(str(low_count),       st('v4', fontSize=14, textColor=RED,     fontName='Helvetica-Bold', alignment=TA_CENTER)),
        ]
        summary_tbl = Table([card_labels, card_vals], colWidths=[col4]*4)
        summary_tbl.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,-1),LIGHT_BG),
            ('BOX',(0,0),(-1,-1),1,BORDER),
            ('INNERGRID',(0,0),(-1,-1),0.5,BORDER),
            ('TOPPADDING',(0,0),(-1,-1),8),
            ('BOTTOMPADDING',(0,0),(-1,-1),8),
        ]))
        story.append(summary_tbl)
        story.append(Spacer(1, 14))

        # ── Per-product batch table ──
        story.append(Paragraph('Stock by Product & Batch', section_st))

        header = [
            Paragraph('Product',          header_cell),
            Paragraph('Batch ID',         header_cell),
            Paragraph('Date Added',       header_cell),
            Paragraph('Supplier',         header_cell),
            Paragraph('Added',            header_cell),
            Paragraph('Sold',             header_cell),
            Paragraph('Remaining',        header_cell),
            Paragraph('Cost Price',       header_cell),
            Paragraph('Selling Price',    header_cell),
            Paragraph('Inventory Value',  header_cell),
            Paragraph('Status',           header_cell),
        ]
        rows = [header]

        for product in products:
            batches = Batch.query.filter_by(product_id=product.id).order_by(Batch.date_added.asc()).all()
            for i, batch in enumerate(batches):
                value  = batch.quantity_remaining * batch.cost_price
                is_low = batch.quantity_remaining < 50
                status_color = RED if is_low else GREEN
                status_txt   = "⚠ LOW STOCK" if is_low else "OK"
                rows.append([
                    Paragraph(product.name if i == 0 else '', cell_b),
                    Paragraph(batch.id,                                         cell),
                    Paragraph(batch.date_added.strftime('%d/%m/%Y') if batch.date_added else '-', cell_c),
                    Paragraph(batch.supplier or '-',                            cell),
                    Paragraph(str(batch.quantity_added),                        cell_r),
                    Paragraph(str(batch.quantity_sold),                         cell_r),
                    Paragraph(str(batch.quantity_remaining),                    cell_r),
                    Paragraph(fmt(batch.cost_price),                            cell_r),
                    Paragraph(fmt(batch.selling_price),                         cell_r),
                    Paragraph(fmt(value),                                       cell_br),
                    Paragraph(status_txt, st('st', fontSize=7,
                              textColor=status_color, fontName='Helvetica-Bold', alignment=TA_CENTER)),
                ])

        # Totals
        rows.append([
            Paragraph('TOTAL', cell_br),
            Paragraph('', cell), Paragraph('', cell), Paragraph('', cell),
            Paragraph('', cell_r), Paragraph('', cell_r),
            Paragraph(str(total_units), cell_br),
            Paragraph('', cell_r), Paragraph('', cell_r),
            Paragraph(fmt(total_value), cell_br),
            Paragraph('', cell),
        ])

        cw = page_w / 11
        tbl = Table(rows, colWidths=[cw*1.6, cw*1.4, cw*0.9, cw*0.9, cw*0.7, cw*0.7, cw*0.8, cw*0.9, cw*0.9, cw, cw*0.8])
        tbl.setStyle(TableStyle([
            ('BACKGROUND',  (0,0),  (-1,0),  PRIMARY),
            ('BACKGROUND',  (0,-1), (-1,-1), LIGHT_BG),
            ('ROWBACKGROUNDS',(0,1),(-1,-2), [colors.white, ROW_ALT]),
            ('GRID',        (0,0),  (-1,-1), 0.5, BORDER),
            ('TOPPADDING',  (0,0),  (-1,-1), 5),
            ('BOTTOMPADDING',(0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0),  (-1,-1), 4),
            ('RIGHTPADDING',(0,0),  (-1,-1), 4),
            ('VALIGN',      (0,0),  (-1,-1), 'MIDDLE'),
            ('LINEABOVE',   (0,-1), (-1,-1), 1.5, PRIMARY),
        ]))
        story.append(tbl)

        # ── Footer ──
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width='100%', thickness=1, color=BORDER))
        story.append(Paragraph(
            f'Auto-generated by Affluence Global Inventory Portal · {now_str}. All figures in Nigerian Naira (NGN).',
            st('ft', fontSize=7, textColor=MUTED, alignment=TA_CENTER, spaceBefore=6)))

    # ══════════════════════════════════════════════════════════════════════════
    #  SALES REPORT
    # ══════════════════════════════════════════════════════════════════════════
    elif report_type == "sales":
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc).date() - timedelta(days=REPORT_INTERVAL_DAYS)
        sales  = Sale.query.filter(Sale.date_sold >= cutoff).order_by(Sale.date_sold.desc()).all()
        orders = Order.query.filter(Order.date_created >= cutoff).all()

        total_revenue     = sum(s.revenue or 0 for s in sales)
        total_cost        = sum(s.cost    or 0 for s in sales)
        total_profit      = sum(s.profit  or 0 for s in sales)
        total_units       = sum(s.quantity_sold or 0 for s in sales)
        total_orders      = len(orders)
        total_amount_paid = sum(o.amount_paid or 0 for o in orders)

        add_report_header("Sales Report", f"Period: Last {REPORT_INTERVAL_DAYS} days")

        # ── Summary cards ──
        col6 = page_w / 6
        card_labels = [
            Paragraph('Total Revenue',      st('cl1', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Total Cost (COGS)',  st('cl2', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Gross Profit',       st('cl3', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Total Orders',       st('cl4', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Units Sold',         st('cl5', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
            Paragraph('Amount Collected',   st('cl6', fontSize=7, textColor=MUTED, fontName='Helvetica', alignment=TA_CENTER)),
        ]
        card_vals = [
            Paragraph(fmt(total_revenue),     st('cv1', fontSize=13, textColor=PRIMARY, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(fmt(total_cost),        st('cv2', fontSize=13, textColor=MUTED,   fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(fmt(total_profit),      st('cv3', fontSize=13, textColor=GREEN if total_profit >= 0 else RED, fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(str(total_orders),      st('cv4', fontSize=13, textColor=DARK,    fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(str(total_units),       st('cv5', fontSize=13, textColor=DARK,    fontName='Helvetica-Bold', alignment=TA_CENTER)),
            Paragraph(fmt(total_amount_paid), st('cv6', fontSize=13, textColor=PRIMARY, fontName='Helvetica-Bold', alignment=TA_CENTER)),
        ]
        summary_tbl = Table([card_labels, card_vals], colWidths=[col6]*6)
        summary_tbl.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,-1),LIGHT_BG),
            ('BOX',(0,0),(-1,-1),1,BORDER),
            ('INNERGRID',(0,0),(-1,-1),0.5,BORDER),
            ('TOPPADDING',(0,0),(-1,-1),8),
            ('BOTTOMPADDING',(0,0),(-1,-1),8),
        ]))
        story.append(summary_tbl)
        story.append(Spacer(1, 14))

        # ── Product Performance breakdown ──
        story.append(Paragraph('Product Performance', section_st))

        product_map = {}
        for s in sales:
            batch   = Batch.query.get(s.batch_id)
            product = Product.query.get(batch.product_id) if batch else None
            pid     = product.id   if product else 'Unknown'
            pname   = product.name if product else 'Unknown'
            if pid not in product_map:
                product_map[pid] = {'name': pname, 'units': 0, 'revenue': 0,
                                    'cost': 0, 'profit': 0, 'orders': set(), 'sales': []}
            product_map[pid]['units']   += s.quantity_sold or 0
            product_map[pid]['revenue'] += s.revenue       or 0
            product_map[pid]['cost']    += s.cost          or 0
            product_map[pid]['profit']  += s.profit        or 0
            product_map[pid]['orders'].add(s.order_id)
            product_map[pid]['sales'].append(s)

        prod_header = [
            Paragraph('Product',      header_cell),
            Paragraph('Orders',       header_cell),
            Paragraph('Units Sold',   header_cell),
            Paragraph('Revenue',      header_cell),
            Paragraph('Cost',         header_cell),
            Paragraph('Gross Profit', header_cell),
            Paragraph('Margin %',     header_cell),
        ]
        prod_rows = [prod_header]

        for pid, p in sorted(product_map.items(), key=lambda x: -x[1]['profit']):
            margin_pct = (p['profit'] / p['revenue'] * 100) if p['revenue'] else 0
            prod_rows.append([
                Paragraph(p['name'],           cell_b),
                Paragraph(str(len(p['orders'])), cell_r),
                Paragraph(str(p['units']),       cell_r),
                Paragraph(fmt(p['revenue']),     cell_r),
                Paragraph(fmt(p['cost']),        cell_r),
                profit_para(p['profit']),
                Paragraph(f"{margin_pct:.1f}%",
                          st('mp', fontSize=8, textColor=GREEN if margin_pct >= 0 else RED,
                             fontName='Helvetica-Bold', alignment=TA_RIGHT)),
            ])

        overall_margin = (total_profit / total_revenue * 100) if total_revenue else 0
        prod_rows.append([
            Paragraph('TOTAL',             cell_br),
            Paragraph(str(total_orders),   cell_br),
            Paragraph(str(total_units),    cell_br),
            Paragraph(fmt(total_revenue),  cell_br),
            Paragraph(fmt(total_cost),     cell_br),
            Paragraph(fmt(total_profit),   st('tp', fontSize=8, textColor=GREEN if total_profit >= 0 else RED,
                                              fontName='Helvetica-Bold', alignment=TA_RIGHT)),
            Paragraph(f"{overall_margin:.1f}%", cell_br),
        ])

        cw7 = page_w / 7
        prod_tbl = Table(prod_rows, colWidths=[cw7*1.8, cw7*0.7, cw7*0.8, cw7, cw7, cw7, cw7*0.7])
        prod_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0),  (-1,0),  PRIMARY),
            ('BACKGROUND',    (0,-1), (-1,-1), colors.HexColor('#E2F4F1')),
            ('ROWBACKGROUNDS',(0,1),  (-1,-2), [colors.white, ROW_ALT]),
            ('GRID',          (0,0),  (-1,-1), 0.5, BORDER),
            ('TOPPADDING',    (0,0),  (-1,-1), 6),
            ('BOTTOMPADDING', (0,0),  (-1,-1), 6),
            ('LEFTPADDING',   (0,0),  (-1,-1), 6),
            ('RIGHTPADDING',  (0,0),  (-1,-1), 6),
            ('VALIGN',        (0,0),  (-1,-1), 'MIDDLE'),
            ('LINEABOVE',     (0,-1), (-1,-1), 1.5, PRIMARY),
        ]))
        story.append(prod_tbl)
        story.append(Spacer(1, 14))

        # ── Top Customers ──
        story.append(Paragraph('Top Customers', section_st))

        customer_map = {}
        for o in orders:
            cname = o.customer_name or 'Unknown'
            if cname not in customer_map:
                customer_map[cname] = {'orders': 0, 'revenue': 0, 'amount_paid': 0}
            customer_map[cname]['orders']      += 1
            customer_map[cname]['amount_paid'] += o.amount_paid or 0
            for s in sales:
                if s.order_id == o.id:
                    customer_map[cname]['revenue'] += s.revenue or 0

        top_customers = sorted(customer_map.items(), key=lambda x: -x[1]['revenue'])[:15]

        cust_header = [
            Paragraph('Customer',     header_cell),
            Paragraph('Orders',       header_cell),
            Paragraph('Revenue',      header_cell),
            Paragraph('Amount Paid',  header_cell),
            Paragraph('Balance',      header_cell),
        ]
        cust_rows = [cust_header]
        for cname, c in top_customers:
            balance = c['revenue'] - c['amount_paid']
            cust_rows.append([
                Paragraph(cname,                cell_b),
                Paragraph(str(c['orders']),     cell_r),
                Paragraph(fmt(c['revenue']),    cell_r),
                Paragraph(fmt(c['amount_paid']), cell_r),
                Paragraph(fmt(balance),
                          st('bl', fontSize=8, textColor=RED if balance > 0 else GREEN,
                             fontName='Helvetica', alignment=TA_RIGHT)),
            ])

        cw5 = page_w / 5
        cust_tbl = Table(cust_rows, colWidths=[cw5*1.5, cw5*0.6, cw5, cw5, cw5])
        cust_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,0),  PRIMARY),
            ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white, ROW_ALT]),
            ('GRID',          (0,0), (-1,-1), 0.5, BORDER),
            ('TOPPADDING',    (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING',   (0,0), (-1,-1), 6),
            ('RIGHTPADDING',  (0,0), (-1,-1), 6),
            ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(cust_tbl)
        story.append(PageBreak())

        # ── All Sales Transactions ──
        story.append(Paragraph('All Sales Transactions', section_st))

        txn_header = [
            Paragraph('Date',       header_cell),
            Paragraph('Order ID',   header_cell),
            Paragraph('Customer',   header_cell),
            Paragraph('Product',    header_cell),
            Paragraph('Batch',      header_cell),
            Paragraph('Qty',        header_cell),
            Paragraph('Unit Price', header_cell),
            Paragraph('Cost/Unit',  header_cell),
            Paragraph('Revenue',    header_cell),
            Paragraph('Cost',       header_cell),
            Paragraph('Profit',     header_cell),
        ]
        txn_rows = [txn_header]

        for s in sales:
            batch   = Batch.query.get(s.batch_id)
            product = Product.query.get(batch.product_id) if batch else None
            pname   = product.name if product else 'Unknown'
            txn_rows.append([
                Paragraph(s.date_sold.strftime('%d/%m/%Y') if s.date_sold else '-', cell),
                Paragraph(s.order_id or '-',   cell),
                Paragraph(s.customer_name or '-', cell),
                Paragraph(pname,               cell_b),
                Paragraph(s.batch_id or '-',   cell),
                Paragraph(str(s.quantity_sold or 0),          cell_r),
                Paragraph(fmt(s.selling_price_used or 0),     cell_r),
                Paragraph(fmt(s.cost_price_used    or 0),     cell_r),
                Paragraph(fmt(s.revenue            or 0),     cell_r),
                Paragraph(fmt(s.cost               or 0),     cell_r),
                profit_para(s.profit or 0),
            ])

        cw11 = page_w / 11
        txn_tbl = Table(txn_rows, colWidths=[cw11*0.85, cw11*0.85, cw11*1.2, cw11*1.1,
                                              cw11*1.1, cw11*0.5, cw11, cw11, cw11, cw11, cw11])
        txn_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0), (-1,0),  PRIMARY),
            ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white, ROW_ALT]),
            ('GRID',          (0,0), (-1,-1), 0.5, BORDER),
            ('TOPPADDING',    (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING',   (0,0), (-1,-1), 4),
            ('RIGHTPADDING',  (0,0), (-1,-1), 4),
            ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
            ('FONTSIZE',      (0,0), (-1,-1), 7.5),
        ]))
        story.append(txn_tbl)

        # ── Footer ──
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width='100%', thickness=1, color=BORDER))
        story.append(Paragraph(
            f'Auto-generated by Affluence Global Inventory Portal · {now_str}. All figures in Nigerian Naira (NGN).',
            st('ft', fontSize=7, textColor=MUTED, alignment=TA_CENTER, spaceBefore=6)))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()


def generate_inventory_html():
    products = Product.query.all()
    rows = ""
    total_value = 0
    for product in products:
        batches = Batch.query.filter_by(product_id=product.id).all()
        qty = sum(b.quantity_remaining for b in batches)
        sold = sum(b.quantity_sold for b in batches)
        latest = max(batches, key=lambda b: b.date_added) if batches else None
        cost = latest.cost_price if latest else 0
        price = latest.selling_price if latest else 0
        value = qty * cost
        total_value += value
        low = "⚠️" if qty < 50 else ""
        rows += f"""
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:8px">{product.name}</td>
          <td style="padding:8px;text-align:center">{qty} {low}</td>
          <td style="padding:8px;text-align:center">{sold}</td>
          <td style="padding:8px;text-align:right">₦{cost:,.2f}</td>
          <td style="padding:8px;text-align:right">₦{price:,.2f}</td>
          <td style="padding:8px;text-align:right">₦{value:,.2f}</td>
        </tr>"""
    return rows, total_value, len(products)


def generate_sales_html():
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc).date() - timedelta(days=REPORT_INTERVAL_DAYS)
    sales = Sale.query.filter(Sale.date_sold >= cutoff).order_by(Sale.date_sold.desc()).all()
    total_revenue = sum(s.revenue or 0 for s in sales)
    total_cost = sum(s.cost or 0 for s in sales)
    total_profit = sum(s.profit or 0 for s in sales)
    total_units = sum(s.quantity_sold or 0 for s in sales)

    # Group sales by product
    product_map = {}
    for s in sales:
        batch = Batch.query.get(s.batch_id)
        product = Product.query.get(batch.product_id) if batch else None
        name = product.name if product else "Unknown"
        if name not in product_map:
            product_map[name] = {"units": 0, "revenue": 0, "profit": 0, "cost": 0, "sales": []}
        product_map[name]["units"] += s.quantity_sold or 0
        product_map[name]["revenue"] += s.revenue or 0
        product_map[name]["profit"] += s.profit or 0
        product_map[name]["cost"] += s.cost or 0
        product_map[name]["sales"].append({
            "date": s.date_sold.strftime("%b %d, %Y") if s.date_sold else "—",
            "qty": s.quantity_sold or 0,
            "revenue": s.revenue or 0,
            "cost": s.cost or 0,
            "profit": s.profit or 0,
            "batch": batch.batch_number if batch and hasattr(batch, 'batch_number') else (f"Batch #{batch.id}" if batch else "—"),
            "selling_price": batch.selling_price if batch else 0,
            "cost_price": batch.cost_price if batch else 0,
        })

    rows = ""
    for i, (name, d) in enumerate(sorted(product_map.items(), key=lambda x: -x[1]["revenue"])):
        margin = (d["profit"] / d["revenue"] * 100) if d["revenue"] else 0
        profit_color = "#16A34A" if d["profit"] >= 0 else "#DC2626"
        bg = "#FAFAFA" if i % 2 == 0 else "white"

        # Individual sale rows for this product
        detail_rows = ""
        for s in d["sales"]:
            s_profit_color = "#16A34A" if s["profit"] >= 0 else "#DC2626"
            detail_rows += f"""
            <tr style="background:#F0F9FF;font-size:12px;color:#475569">
              <td style="padding:6px 8px 6px 28px;border-bottom:1px solid #E2E8F0">↳ {s['date']}</td>
              <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #E2E8F0">{s['qty']} units</td>
              <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #E2E8F0">₦{s['cost_price']:,.2f} / unit</td>
              <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #E2E8F0">₦{s['selling_price']:,.2f} / unit</td>
              <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #E2E8F0">₦{s['revenue']:,.2f}</td>
              <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #E2E8F0;color:{s_profit_color};font-weight:600">₦{s['profit']:,.2f}</td>
              <td style="padding:6px 8px;text-align:center;border-bottom:1px solid #E2E8F0;color:#94A3B8">{s['batch']}</td>
            </tr>"""

        rows += f"""
        <tr style="background:{bg}">
          <td style="padding:10px 8px;font-weight:bold;color:#1F3A5F">📦 {name}</td>
          <td style="padding:10px 8px;text-align:center;font-weight:bold">{d['units']}</td>
          <td style="padding:10px 8px;text-align:right">—</td>
          <td style="padding:10px 8px;text-align:right">—</td>
          <td style="padding:10px 8px;text-align:right;font-weight:bold">₦{d['revenue']:,.2f}</td>
          <td style="padding:10px 8px;text-align:right;font-weight:bold;color:{profit_color}">₦{d['profit']:,.2f}</td>
          <td style="padding:10px 8px;text-align:right;color:#64748B">{margin:.1f}%</td>
        </tr>
        {detail_rows}"""

    return rows, total_revenue, total_cost, total_profit, total_units


def send_scheduled_reports():
    with app.app_context():
        try:
            import base64
            now = datetime.now().strftime("%B %d, %Y")

            inv_pdf   = generate_pdf_report("inventory")
            sales_pdf = generate_pdf_report("sales")       # ← was missing / using wrong var

            settings = load_report_settings()
            recipient_email = settings.get('email', REPORT_EMAIL)

            inv_b64   = base64.b64encode(inv_pdf).decode()
            sales_b64 = base64.b64encode(sales_pdf).decode()

            resend.Emails.send({
                "from": "Affluence Global <onboarding@resend.dev>",
                "to": recipient_email,   # <-- use dynamic email
                "subject": f"📦 Inventory Report — {now}",
                "html": f"<p>Please find attached the inventory report for <strong>{now}</strong>.</p>",
                "attachments": [{
                    "filename": f"inventory_report_{datetime.now().strftime('%Y%m%d')}.pdf",
                    "content": inv_b64,
                }]
            })

            resend.Emails.send({
                "from": "Affluence Global <onboarding@resend.dev>",
                "to": recipient_email,   # <-- use dynamic email
                "subject": f"📊 Sales Report — {now}",
                "html": f"<p>Please find attached the sales report for the last <strong>{REPORT_INTERVAL_DAYS} days</strong> ({now}).</p>",
                "attachments": [{
                    "filename": f"sales_report_{datetime.now().strftime('%Y%m%d')}.pdf",
                    "content": sales_b64,   # ← was incorrectly inv_b64 before
                }]
            })

            print(f"[Scheduler] PDF reports sent successfully at {now}")

        except Exception as e:
            import traceback
            print(f"[Scheduler] Error sending reports: {traceback.format_exc()}")

# Start scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(
    send_scheduled_reports,
    trigger=IntervalTrigger(days=REPORT_INTERVAL_DAYS),
    id='send_reports',           # <-- add this
    replace_existing=True        # <-- add this
)

scheduler.start()
atexit.register(lambda: scheduler.shutdown())
if __name__ == '__main__':
    print("=" * 60)
    print("Flask Backend Starting...")
    print(f"API Base URL: http://localhost:5000/api")
    print(f"CORS: Enabled for all origins")
    print("=" * 60)
   # app.run(debug=True, port=5000, host='0.0.0.0')
