import sys
sys.path.append('.')
from app import app
from utils.token_utils import generate_token

# Let's mock a user database entry for admin
admin_user = {
    "user_id": 1,
    "email": "admin@test.com",
    "role": "admin",
    "password": "Admin@123",
    "name": "Admin"
}

token = generate_token(admin_user)

client = app.test_client()
response = client.get('/api/admin/users-list', headers={"Authorization": f"Bearer {token}"})
print("Response status code:", response.status_code)
print("Response data:", response.get_json())
