# mongo_utils.py - Updated with manufacturer-specific queries
from bson import ObjectId
import certifi
from pymongo import MongoClient
from datetime import datetime
from typing import List, Dict, Optional
from config import MONGODB_URI, MONGODB_DB_NAME
import uuid

# Initialize connection variables
client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
devices_collection = db["devices"]
manufacturers_collection = db["manufacturers"]
users_collection = db["users"]

def init_mongo_connection():
    """Initialize MongoDB connection"""
    global client, db, devices_collection, manufacturers_collection, users_collection
    
    try:
        client = MongoClient(
            MONGODB_URI,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            serverSelectionTimeoutMS=30000,
            tls=True,
            tlsCAFile=certifi.where()
        )
        client.admin.command('ping')
        print("✅ MongoDB connection successful!")
        
        db = client[MONGODB_DB_NAME]
        devices_collection = db["devices"]
        manufacturers_collection = db["manufacturers"]
        users_collection = db["users"]
        
        # Create indexes
        devices_collection.create_index([
            ("device_name", "text"),
            ("manufacturer_name", "text")
        ], name="device_manufacturer_text")
        
        devices_collection.create_index("manufacturer_name")
        devices_collection.create_index("username")
        
        return True
        
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False

# Initialize connection on import
init_mongo_connection()

def get_mongo_collections():
    """Get MongoDB collections with connection check"""
    if None in [client, db, devices_collection]:
        if not init_mongo_connection():
            raise Exception("MongoDB connection not available")
    
    return devices_collection, manufacturers_collection, users_collection

def store_device_risk_data(device_data: dict):
    """
    Store device risk data in MongoDB
    """
    device_data["created_at"] = datetime.now().isoformat()
    result = devices_collection.insert_one(device_data)
    return str(result.inserted_id)

def update_device_risk_data(device_id: str, update_data: dict):
    """
    Update device risk data
    """
    try:
        # Convert string device_id to ObjectId
        query_id = ObjectId(device_id)
            
        result = devices_collection.update_one(
            {"_id": query_id},
            {"$set": update_data}
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error updating device: {e}")
        return False

def query_similar_devices(device_name: str, manufacturer_name: str, n_results: int = 5):
    """Query similar devices from MongoDB using text search"""
    devices_coll, _, _ = get_mongo_collections()
    
    # Search for similar devices
    results = devices_coll.find(
        {"$text": {"$search": f"{device_name} {manufacturer_name}"}},
        {"score": {"$meta": "textScore"}}
    ).sort([("score", {"$meta": "textScore"})]).limit(n_results)
    
    # Process results
    devices = []
    for result in results:
        device_info = {
            "id": result["_id"],
            "device_name": result["device_name"],
            "manufacturer_name": result["manufacturer_name"],
            "risk_class": result["risk_class"],
            "risk_percent": result["risk_percent"],
            "suggested_alternatives": result["suggested_alternatives"],
            "source": result.get("source", "unknown"),
            "username": result.get("username", "unknown"),
            "created_at": result.get("created_at", ""),
            "score": result.get("score", 0)
        }
        devices.append(device_info)
    
    return devices

def get_all_devices():
    """
    Get all devices from MongoDB
    """
    devices = list(devices_collection.find())
    # Convert ObjectId to string for JSON serialization
    for device in devices:
        device["_id"] = str(device["_id"])
    return devices

def get_devices_by_manufacturer(manufacturer_name: str):
    """
    Get devices by manufacturer name
    """
    devices = list(devices_collection.find({"manufacturer_name": manufacturer_name}))
    for device in devices:
        device["_id"] = str(device["_id"])
    return devices

def get_devices_by_username(username: str):
    """
    Get devices by username (for manufacturer dashboard)
    """
    # First get manufacturer details to get company name
    manufacturer = manufacturers_collection.find_one({"email": username})
    if manufacturer:
        manufacturer_name = manufacturer.get("manufacturer_name", "")
        # Get devices by manufacturer name
        devices = list(devices_collection.find({"manufacturer_name": manufacturer_name}))
        for device in devices:
            device["_id"] = str(device["_id"])
        return devices
    return []

def get_device_with_feedback(device_id: str):
    """
    Get a device with its feedback
    """
    try:
        device = devices_collection.find_one({"_id": ObjectId(device_id)})
        return device
    except:
        return None

def get_dashboard_stats(manufacturer_name: str = None):
    """
    Get dashboard statistics
    """
    query = {}
    if manufacturer_name:
        query = {"manufacturer_name": manufacturer_name}
    
    total_predictions = devices_collection.count_documents(query)
    
    # Get risk distribution
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$risk_class", "count": {"$sum": 1}}}
    ]
    risk_distribution = list(devices_collection.aggregate(pipeline))
    
    # Convert to dictionary
    risk_dist_dict = {}
    for item in risk_distribution:
        risk_dist_dict[item["_id"]] = item["count"]
    
    # Get recent devices
    recent_devices = list(devices_collection.find(query).sort("created_at", -1).limit(5))
    for device in recent_devices:
        device["_id"] = str(device["_id"])
    
    return {
        "total_predictions": total_predictions,
        "risk_distribution": risk_dist_dict,
        "recent_devices": recent_devices
    }
def add_feedback_to_device(device_id: str, feedback_data: dict):
    """
    Add feedback to a device
    """
    try:
        result = devices_collection.update_one(
            {"_id": ObjectId(device_id)},
            {"$push": {"feedback": feedback_data}}
        )
        return result.modified_count > 0
    except:
        return False
def get_all_feedback():
    """
    Get all feedback from all devices
    """
    devices = list(devices_collection.find({"feedback": {"$exists": True, "$ne": []}}))
    feedback_list = []
    
    for device in devices:
        device_id = str(device["_id"])
        for feedback in device.get("feedback", []):
            feedback["device_id"] = device_id
            feedback["device_name"] = device.get("device_name", "")
            feedback["manufacturer_name"] = device.get("manufacturer_name", "")
            feedback_list.append(feedback)
    
    return feedback_list

def store_failure_report(failure_data: dict):
    """
    Store device failure report in a separate collection
    """
    failure_collection = db["failure_reports"]
    failure_data["created_at"] = datetime.now().isoformat()
    failure_data["report_id"] = str(uuid.uuid4())
    result = failure_collection.insert_one(failure_data)
    return str(result.inserted_id)

# Add this to mongo_utils.py
def get_failure_reports_collection():
    """Get failure reports collection"""
    return db["failure_reports"]

def store_failure_report(failure_data: dict):
    """
    Store device failure report in a separate collection
    """
    failure_collection = get_failure_reports_collection()
    failure_data["created_at"] = datetime.now().isoformat()
    failure_data["report_id"] = str(uuid.uuid4())
    result = failure_collection.insert_one(failure_data)
    return str(result.inserted_id)

def get_failure_reports_by_manufacturer(manufacturer_name: str):
    """
    Get all failure reports for a specific manufacturer
    """
    failure_collection = get_failure_reports_collection()
    reports = list(failure_collection.find({"manufacturer_name": manufacturer_name}))
    
    # Convert ObjectId to string for JSON serialization
    for report in reports:
        report["_id"] = str(report["_id"])
    
    return reports

def get_all_failure_reports():
    """
    Get all failure reports (for admin/super admin)
    """
    failure_collection = get_failure_reports_collection()
    reports = list(failure_collection.find())
    
    for report in reports:
        report["_id"] = str(report["_id"])
    
    return reports