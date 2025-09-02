from bson import ObjectId
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime

class UserBase(BaseModel):
    hospital_name: str
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

class ManufacturerBase(BaseModel):
    manufacturer_name: str
    email: str

class ManufacturerCreate(ManufacturerBase):
    password: str

class Manufacturer(ManufacturerBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class DeviceRiskData(BaseModel):
    device_name: str
    manufacturer_name: str
    risk_class: str
    risk_percent: float
    suggested_alternatives: List[str]
    source: str
    notes: Optional[str] = None
    created_at: datetime = None

class ReportFailureRequest(BaseModel):
    device_id: str
    notes: str
    source: str
    suggested_alternatives: List[str]
    action_summary: str
    action_level: str
    action_classification: str
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
    created_at: Optional[str] = None

class ManufacturerResponse(BaseModel):
    manufacturer_name: str
    email: str
    is_active: bool
    created_at: Optional[str] = None

class DashboardStats(BaseModel):
    total_predictions: int
    total_feedback: int
    risk_distribution: Dict[str, int]
    recent_devices: List[Dict]

class ActivationRequest(BaseModel):
    email: str
    is_active: bool

class DeviceResponse(BaseModel):
    id: str
    device_name: str
    manufacturer_name: str
    risk_class: str
    risk_percent: float
    suggested_alternatives: List[str]
    source: str
    notes: Optional[str] = None
    username: str
    created_at: str

    class Config:
        json_encoders = {
            ObjectId: str
        }

class FailureReportBase(BaseModel):
    device_id: str
    device_name: str
    manufacturer_name: str
    suggested_alternatives: List[str]
    notes: str
    source: str
    action_summary: str
    action_level: str
    action_classification: str
    country: Optional[str] = None

class FailureReportCreate(FailureReportBase):
    pass

class FailureReport(FailureReportBase):
    id: str
    reported_by: str
    report_date: str
    event_id: str
    created_at: str

    class Config:
        from_attributes = True