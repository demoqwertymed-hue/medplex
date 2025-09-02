# auth.py - Updated with Super Admin functionality and new authentication system
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from models import TokenData
from pymongo import MongoClient
import os
from config import MONGODB_URI, MONGODB_DB_NAME, SECRET_KEY, ALGORITHM

# Password hashing - handle bcrypt version issue
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
except:
    # Fallback if bcrypt has issues
    pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]
users_collection = db["users"]
manufacturers_collection = db["manufacturers"]
SUPER_ADMIN_USERNAME = "admin"  # Default super admin username

# Initialize super admin if not exists
def init_super_admin():
    super_admin = users_collection.find_one({"username": SUPER_ADMIN_USERNAME})
    if not super_admin:
        hashed_password = get_password_hash("admin123")  # Default password
        users_collection.insert_one({
            "username": SUPER_ADMIN_USERNAME,
            "email": "admin@hospital-device-risk.com",
            "hashed_password": hashed_password,
            "is_active": True,
            "role": "super_admin",
            "created_at": datetime.now().isoformat()
        })
        print("Super admin user created")

# User model (MongoDB document)

class UserDB:
    def __init__(self, email: str, hashed_password: str, username: Optional[str] = None, 
                 is_active: bool = True, role: str = "user", **kwargs):
        # Use email as username if username is not provided
        self.username = username or email
        self.email = email
        self.hashed_password = hashed_password
        self.is_active = is_active
        self.role = role

    def to_dict(self):
        return {
            "username": self.username,
            "email": self.email,
            "hashed_password": self.hashed_password,
            "is_active": self.is_active,
            "role": self.role
        }

# Database dependency
def get_db():
    try:
        yield db
    finally:
        pass

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_user(username: str):
    user_data = users_collection.find_one({"username": username})
    if user_data:
        user_data_without_id = {k: v for k, v in user_data.items() if k != '_id'}
        return UserDB(**user_data_without_id)
    return None

def get_user_by_email(email: str):
    user_data = users_collection.find_one({"email": email})
    if user_data:
        user_data_without_id = {k: v for k, v in user_data.items() if k != '_id'}
        return UserDB(**user_data_without_id)
    return None

def get_manufacturer(email: str):
    manufacturer_data = manufacturers_collection.find_one({"email": email})
    if manufacturer_data:
        return {
            "email": manufacturer_data["email"],
            "manufacturer_name": manufacturer_data.get("manufacturer_name", ""),  # Use get with default
            "hashed_password": manufacturer_data["hashed_password"],
            "is_active": manufacturer_data.get("is_active", True),
            "role": "manufacturer"
        }
    return None

def authenticate_user(email: str, password: str):
    user = get_user_by_email(email)
    if not user:
        return False
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not activated by Superadmin"
        )
    
    if not verify_password(password, user.hashed_password):
        return False
    return user

def authenticate_manufacturer(email: str, password: str):
    manufacturer = get_manufacturer(email)
    if not manufacturer:
        return False
    
    if not manufacturer.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not activated by Superadmin"
        )
    
    if not verify_password(password, manufacturer["hashed_password"]):
        return False
    
    # Create UserDB object for compatibility
    return UserDB(
        email=manufacturer["email"],
        hashed_password=manufacturer["hashed_password"],
        username=manufacturer["email"],  # Using email as username
        is_active=manufacturer.get("is_active", True),
        role=manufacturer.get("role", "manufacturer")
    )

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role", "user")
        if email is None:
            raise credentials_exception
        token_data = TokenData(username=email, role=role)
    except JWTError:
        raise credentials_exception
        
    # Check both regular users and manufacturers collections
    user = get_user_by_email(email=token_data.username)
    if user is None:
        manufacturer = get_manufacturer(email=token_data.username)
        if manufacturer:
            user = UserDB(
                email=manufacturer["email"],
                hashed_password=manufacturer["hashed_password"],
                username=manufacturer["email"],
                is_active=manufacturer.get("is_active", True),
                role=manufacturer.get("role", "manufacturer")
            )
    
    if user is None or not user.is_active:
        raise credentials_exception
    if user is None:
        manufacturer = get_manufacturer(email=token_data.username)
        if manufacturer:
            user = UserDB(
                email=manufacturer["email"],
                hashed_password=manufacturer.get("hashed_password", ""),  # Use get with default
                username=manufacturer["email"],
                is_active=manufacturer.get("is_active", True),
                role=manufacturer.get("role", "manufacturer")
            )
    
    user.role = role
    return user

def get_super_admin_user(current_user: UserDB = Depends(get_current_user)):
    """Dependency to ensure user is a super admin"""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can access this endpoint"
        )
    return current_user

def create_manufacturer_user(manufacturer_name: str, email: str, password: str):
    """
    Create a manufacturer user with separate storage
    """
    # Check if user already exists
    existing_user = manufacturers_collection.find_one({"email": email})
    if existing_user:
        return False, "Email already registered"
    
    # Create manufacturer user
    hashed_password = get_password_hash(password)
    manufacturer_data = {
        "manufacturer_name": manufacturer_name,
        "email": email,
        "hashed_password": hashed_password,
        "is_active": False,  # Default to inactive until activated by superadmin
        "role": "manufacturer",
        "created_at": datetime.now().isoformat()
    }
    
    result = manufacturers_collection.insert_one(manufacturer_data)
    return True, str(result.inserted_id)


# Initialize super admin on import
init_super_admin()