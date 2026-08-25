# utils/token_utils.py

import jwt
import datetime
import datetime as dt
from config import SECRET_KEY

def generate_token(user):
    token = jwt.encode({
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "password": user["password"],
        "exp": dt.datetime.utcnow() + dt.timedelta(days=1)
    }, SECRET_KEY, algorithm="HS256")

    return token