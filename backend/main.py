import uuid
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
import joblib
import pandas as pd
from pathlib import Path
from typing import Optional, List, Dict
from datetime import timedelta, datetime
from auth import UserDB, authenticate_manufacturer, authenticate_user

from typing import Optional
from config import MODEL_PATH, ALT_INDEX_PATH, ACCESS_TOKEN_EXPIRE_MINUTES
from utils import suggest_alternatives, normalize_text
from auth import authenticate_user, create_access_token, get_current_user, get_password_hash, get_db, get_super_admin_user, create_manufacturer_user, get_user_by_email, get_manufacturer
# Remove the missing imports
from mongo_utils import get_all_failure_reports, get_failure_reports_by_manufacturer, get_failure_reports_collection, store_device_risk_data, query_similar_devices, get_all_devices, store_failure_report, update_device_risk_data, get_device_with_feedback, get_devices_by_username, get_dashboard_stats, manufacturers_collection, users_collection, devices_collection
from sqlalchemy.orm import Session
from bson import ObjectId
from mongo_utils import get_all_failure_reports, get_failure_reports_by_manufacturer, get_failure_reports_collection, store_device_risk_data, query_similar_devices, get_all_devices, store_failure_report, update_device_risk_data, get_device_with_feedback, get_devices_by_username, get_dashboard_stats, manufacturers_collection, users_collection, devices_collection
app = FastAPI(title="Hospital Device Risk API", version="2.0")

# Add the missing Pydantic models
class UserCreate(BaseModel):
    hospital_name: str
    email: str
    password: str

class ManufacturerCreate(BaseModel):
    manufacturer_name: str
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class PredictIn(BaseModel):
    device_name: str
    manufacturer_name: str
    country: Optional[str] = None

class PredictOut(BaseModel):
    risk_percent: float
    risk_class: str
    details: Dict
    alternatives: List[Dict]
    device_id: str

class ReportFailureRequest(BaseModel):
    device_id: str
    suggested_alternatives: List[str]
    notes: Optional[str] = None
    source: Optional[str] = None
    action_summary: Optional[str] = None
    action_level: Optional[str] = None
    action_classification: Optional[str] = None
    country: Optional[str] = None

class ContinuousLearningRequest(BaseModel):
    device_name: str
    manufacturer_name: str
    risk_class: str
    risk_percent: float
    suggested_alternatives: List[str]
    source: str
    notes: Optional[str] = None
    action_summary: Optional[str] = None
    action_level: Optional[str] = None
    action_classification: Optional[str] = None
    country: Optional[str] = None

class UserResponse(BaseModel):
    hospital_name: str
    email: str
    is_active: bool
    role: str
    created_at: str

class ManufacturerResponse(BaseModel):
    manufacturer_name: str
    email: str
    is_active: bool
    role: str
    created_at: str

class ActivationRequest(BaseModel):
    email: str
    is_active: bool

def _class_to_label(c: int) -> str:
    return ["Low Risk", "Medium Risk", "High Risk"][int(c)]

def _probas_to_percent_and_label(probas):
    best_idx = int(probas.argmax())
    risk_percent = float(probas[best_idx] * 100.0)
    label = _class_to_label(best_idx)
    return risk_percent, label

# Role-based authorization dependencies
def get_manufacturer_user(current_user: UserDB = Depends(get_current_user)):
    """Dependency to ensure user is a manufacturer"""
    if current_user.role != "manufacturer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only manufacturers can access this endpoint"
        )
    return current_user

def get_admin_user(current_user: UserDB = Depends(get_current_user)):
    """Dependency to ensure user is an admin"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access this endpoint"
        )
    return current_user

# Load model and alternatives index
try:
    model = joblib.load(MODEL_PATH)
except:
    model = None
    print("Warning: Model not found. Please run train.py first.")

alt_index = None
if Path(ALT_INDEX_PATH).exists():
    alt_index = pd.read_parquet(ALT_INDEX_PATH)

# Authentication endpoints
@app.post("/api/register", response_model=Dict)
async def register(user: UserCreate):
    from auth import users_collection, UserDB, get_password_hash
    
    existing_user = users_collection.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    hashed_password = get_password_hash(user.password)
    db_user = {
        "hospital_name": user.hospital_name,
        "email": user.email,
        "hashed_password": hashed_password,
        "is_active": False,  # Default to inactive until activated by superadmin
        "role": "user",
        "created_at": datetime.now().isoformat()
    }
    
    users_collection.insert_one(db_user)
    
    return {"message": "User created successfully. Waiting for activation by Superadmin."}

@app.post("/api/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Manufacturer registration and login
@app.post("/api/register/manufacturer", response_model=Dict)
async def register_manufacturer(manufacturer: ManufacturerCreate):
    success, message = create_manufacturer_user(
        manufacturer.manufacturer_name,
        manufacturer.email,
        manufacturer.password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )
    
    return {"message": "Manufacturer account created successfully. Waiting for activation by Superadmin."}

@app.post("/api/login/manufacturer", response_model=Token)
async def login_manufacturer(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_manufacturer(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

# Prediction endpoint
@app.post("/api/risk/check", response_model=PredictOut)
async def predict(payload: PredictIn, current_user: dict = Depends(get_current_user)):
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not trained yet. Please run train.py first."
        )
    
    row = {
        "manufacturer_name": normalize_text(payload.manufacturer_name),
        "device_name": normalize_text(payload.device_name),
    }
    X = pd.DataFrame([row])
    
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)[0]
    else:
        pred = int(model.predict(X)[0])
        probs = [0.2, 0.3, 0.5] if pred == 2 else [0.3, 0.5, 0.2] if pred == 1 else [0.7, 0.2, 0.1]
    
    risk_percent, risk_class = _probas_to_percent_and_label(pd.Series(probs))
    
    details = {
        "probabilities": {
            "Low": float(probs[0] * 100.0),
            "Medium": float(probs[1] * 100.0),
            "High": float(probs[2] * 100.0),
        },
        "justification": "Risk estimated from historical recall patterns for manufacturer & device similarity (character n-grams).",
        "feature_contribution_hint": "Character-level matches in device/manufacturer names influenced the score."
    }
    
    alternatives = []
    if alt_index is not None:
        alternatives = suggest_alternatives(alt_index, payload.manufacturer_name, payload.device_name, top_k=5)
    
    # Store prediction in MongoDB
    device_data = {
        "device_name": payload.device_name,
        "manufacturer_name": payload.manufacturer_name,
        "risk_class": risk_class,
        "risk_percent": risk_percent,
        "suggested_alternatives": [f"{alt['manufacturer_name']} | {alt['device_name']}" for alt in alternatives],
        "source": "prediction",
        "username": current_user.email,
        "created_at": datetime.now().isoformat()
    }
    
    device_id = store_device_risk_data(device_data)
    return {
        "risk_percent": risk_percent,
        "risk_class": risk_class,
        "details": details,
        "alternatives": alternatives,
        "device_id": device_id 
    }

# Report device failure endpoint
@app.post("/api/report_failure")
async def report_failure(payload: ReportFailureRequest, current_user: dict = Depends(get_current_user)):
    """
    Hospitals report device failures or adverse events - stores in separate collection
    """
    from bson import ObjectId
    
    # Get device from database to validate it exists and get device details
    try:
        device_object_id = ObjectId(payload.device_id)
        device = devices_collection.find_one({"_id": device_object_id})
    except:
        device = None
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    # Check if any alternative contains the manufacturer name
    manufacturer_name_lower = device["manufacturer_name"].lower()
    for alternative in payload.suggested_alternatives:
        if manufacturer_name_lower in alternative.lower():
            return None
    
    # Store in separate failure_reports collection
    failure_data = {
        "device_id": payload.device_id,
        "device_name": device.get("device_name", ""),
        "manufacturer_name": device.get("manufacturer_name", ""),
        "suggested_alternatives": payload.suggested_alternatives,
        "notes": payload.notes,
        "source": payload.source,
        "action_summary": payload.action_summary,
        "action_level": payload.action_level,
        "action_classification": payload.action_classification,
        "country": payload.country,
        "reported_by": current_user.email,
        "event_id": str(uuid.uuid4()),
        "report_date": datetime.now().isoformat()
    }
    
    report_id = store_failure_report(failure_data)
    
    return {
        "message": "Device failure reported successfully",
        "report_id": report_id,
        "device_id": payload.device_id
    }# Continuous learning endpoint
@app.post("/api/continuous_learning")
async def continuous_learning(payload: ContinuousLearningRequest):
    """
    Hospitals submit feedback about devices for ongoing safety and performance improvements
    """
    # Check if any alternative contains the manufacturer name (case-insensitive)
    manufacturer_name_lower = payload.manufacturer_name.lower()
    for alternative in payload.suggested_alternatives:
        if manufacturer_name_lower in alternative.lower():
            return None  # Return null as per checkpoint condition
    
    # Store in MongoDB
    device_data = {
        "device_name": payload.device_name,
        "manufacturer_name": payload.manufacturer_name,
        "risk_class": payload.risk_class,
        "risk_percent": payload.risk_percent,
        "suggested_alternatives": payload.suggested_alternatives,
        "source": payload.source,
        "notes": payload.notes,
        "action_summary": payload.action_summary,
        "action_level": payload.action_level,
        "action_classification": payload.action_classification,
        "country": payload.country,
        "created_at": datetime.now().isoformat(),
        "event_id": str(uuid.uuid4()),
        "date": datetime.now().isoformat()
    }
    
    device_id = store_device_risk_data(device_data)
    
    return {
        "message": "Device data added to knowledge base for continuous learning",
        "id": device_id,
        "device_name": payload.device_name,
        "manufacturer_name": payload.manufacturer_name,
        "risk_class": payload.risk_class
    }

# Super Admin endpoints
@app.get("/api/admin/users", response_model=List[UserResponse])
async def get_all_users(current_user: UserDB = Depends(get_super_admin_user)):
    """
    Get all users (Super Admin only)
    """
    users = list(users_collection.find({}, {"_id": 0, "hashed_password": 0}))
    
    # Transform the MongoDB documents to match UserResponse model
    transformed_users = []
    for user in users:
        transformed_users.append({
            "hospital_name": user.get("hospital_name", user.get("username", "")),
            "email": user.get("email", ""),
            "is_active": user.get("is_active", False),
            "role": user.get("role", "user"),
            "created_at": user.get("created_at", "")
        })
    
    return transformed_users

@app.get("/api/admin/manufacturers", response_model=List[ManufacturerResponse])
async def get_all_manufacturers(current_user: UserDB = Depends(get_super_admin_user)):
    """
    Get all manufacturers (Super Admin only)
    """
    manufacturers = list(manufacturers_collection.find({}, {"_id": 0, "hashed_password": 0}))
    
    # Transform the MongoDB documents to match ManufacturerResponse model
    transformed_manufacturers = []
    for manufacturer in manufacturers:
        transformed_manufacturers.append({
            "manufacturer_name": manufacturer.get("manufacturer_name", ""),
            "email": manufacturer.get("email", ""),
            "is_active": manufacturer.get("is_active", False),
            "role": manufacturer.get("role", "manufacturer"),
            "created_at": manufacturer.get("created_at", "")
        })
    
    return transformed_manufacturers

@app.get("/api/manufacturer/devices", response_model=List[Dict])
async def get_manufacturer_devices(current_user: UserDB = Depends(get_manufacturer_user)):
    """
    Get all devices for the logged-in manufacturer
    """
    # Get manufacturer details to get the company name
    manufacturer = manufacturers_collection.find_one({"email": current_user.email})
    if not manufacturer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manufacturer not found"
        )
    
    manufacturer_name = manufacturer.get("manufacturer_name", "")
    
    # Get devices by manufacturer name
    devices = list(devices_collection.find({"manufacturer_name": manufacturer_name}))
    
    # Convert ObjectId to string for JSON serialization
    for device in devices:
        device["_id"] = str(device["_id"])
        # Convert any other ObjectId fields if needed
        if "username" in device and isinstance(device["username"], ObjectId):
            device["username"] = str(device["username"])
    
    return devices
@app.post("/api/admin/activate_user")
async def activate_user(
    payload: ActivationRequest,
    current_user: UserDB = Depends(get_super_admin_user)
):
    """
    Activate/deactivate user (Super Admin only)
    """
    result = users_collection.update_one(
        {"email": payload.email},
        {"$set": {"is_active": payload.is_active}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    status_text = "activated" if payload.is_active else "deactivated"
    return {"message": f"User {payload.email} {status_text} successfully"}

@app.post("/api/admin/activate_manufacturer")
async def activate_manufacturer(
    payload: ActivationRequest,
    current_user: UserDB = Depends(get_super_admin_user)
):
    """
    Activate/deactivate manufacturer (Super Admin only)
    """
    result = manufacturers_collection.update_one(
        {"email": payload.email},
        {"$set": {"is_active": payload.is_active}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manufacturer not found"
        )
    
    status_text = "activated" if payload.is_active else "deactivated"
    return {"message": f"Manufacturer {payload.email} {status_text} successfully"}

@app.delete("/api/admin/delete_user/{email}")
async def delete_user(
    email: str,
    current_user: UserDB = Depends(get_super_admin_user)
):
    """
    Delete user (Super Admin only)
    """
    result = users_collection.delete_one({"email": email})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": f"User {email} deleted successfully"}

@app.delete("/api/admin/delete_manufacturer/{email}")
async def delete_manufacturer(
    email: str,
    current_user: UserDB = Depends(get_super_admin_user)
):
    """
    Delete manufacturer (Super Admin only)
    """
    result = manufacturers_collection.delete_one({"email": email})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manufacturer not found"
        )
    
    return {"message": f"Manufacturer {email} deleted successfully"}

# Health endpoint
@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Get all devices
@app.get("/api/devices")
async def get_devices(current_user: dict = Depends(get_current_user)):
    devices = get_all_devices()
    return {"devices": devices}

@app.get("/api/manufacturer/failure-reports", response_model=List[Dict])
async def get_manufacturer_failure_reports(current_user: UserDB = Depends(get_manufacturer_user)):
    """
    Get failure reports for the logged-in manufacturer
    """
    # Get manufacturer details to get the company name
    manufacturer = manufacturers_collection.find_one({"email": current_user.email})
    if not manufacturer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Manufacturer not found"
        )
    
    manufacturer_name = manufacturer.get("manufacturer_name", "")
    
    # Get failure reports by manufacturer name
    failure_reports = get_failure_reports_by_manufacturer(manufacturer_name)
    
    return failure_reports

@app.get("/api/admin/failure-reports", response_model=List[Dict])
async def get_all_failure_reports_admin(current_user: UserDB = Depends(get_super_admin_user)):
    """
    Get all failure reports (Super Admin only)
    """
    failure_reports = get_all_failure_reports()
    return failure_reports

@app.get("/api/failure-reports/{device_id}", response_model=List[Dict])
async def get_failure_reports_for_device(device_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get failure reports for a specific device
    """
    failure_collection = get_failure_reports_collection()
    
    # Get reports for this device
    reports = list(failure_collection.find({"device_id": device_id}))
    
    for report in reports:
        report["_id"] = str(report["_id"])
    
    return reports


# Add this endpoint in main.py after the existing endpoints
@app.get("/api/admin/failure-reports/all", response_model=Dict)
async def get_all_failure_reports_admin(
    page: int = 1,
    limit: int = 20,
    manufacturer: Optional[str] = None,
    device_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: UserDB = Depends(get_super_admin_user)
):
    """
    Get all failure reports with filtering and pagination (Super Admin only)
    """
    failure_collection = get_failure_reports_collection()
    
    # Build query
    query = {}
    
    if manufacturer:
        query["manufacturer_name"] = {"$regex": manufacturer, "$options": "i"}
    
    if device_name:
        query["device_name"] = {"$regex": device_name, "$options": "i"}
    
    if start_date and end_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query["created_at"] = {
                "$gte": start_dt.isoformat(),
                "$lte": end_dt.isoformat()
            }
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use ISO format (e.g., 2024-01-01T00:00:00Z)"
            )
    
    # Get total count
    total_reports = failure_collection.count_documents(query)
    
    # Calculate pagination
    skip = (page - 1) * limit
    total_pages = (total_reports + limit - 1) // limit
    
    # Get paginated results
    reports = list(
        failure_collection.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    
    # Convert ObjectId to string and format dates
    for report in reports:
        report["_id"] = str(report["_id"])
        # Format date for better readability
        if "created_at" in report:
            try:
                report_date = datetime.fromisoformat(report["created_at"].replace('Z', '+00:00'))
                report["formatted_date"] = report_date.strftime("%Y-%m-%d %H:%M:%S")
            except:
                report["formatted_date"] = report["created_at"]
    
    return {
        "reports": reports,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_reports": total_reports,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        },
        "filters": {
            "manufacturer": manufacturer,
            "device_name": device_name,
            "start_date": start_date,
            "end_date": end_date
        }
    }