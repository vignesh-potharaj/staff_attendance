"""
Test error handling when token.pickle is missing (simulating Render without token)
"""

import os
import sys
sys.path.insert(0, '/c/projects/staff_attendance')

# Keep credentials and folder ID, but clear token
if 'GOOGLE_TOKEN_PICKLE_B64' in os.environ:
    del os.environ['GOOGLE_TOKEN_PICKLE_B64']

# Ensure folder ID is set
os.environ['GOOGLE_DRIVE_FOLDER_ID'] = '1GbTLJI1Ys1cG42R8Mh9KqJzRPQ6p8Uxu'

print("=" * 80)
print("Testing Error Handling (Missing Token)")
print("=" * 80)
print()

from backend.services.google_drive import get_google_drive_manager

try:
    print("Initializing with credentials but NO token.pickle...")
    manager = get_google_drive_manager()
    if manager.service is None:
        print("[OK] Service correctly disabled when token missing")
    else:
        print("[ERROR] Service should be None when token missing")
except Exception as e:
    print(f"[ERROR] {type(e).__name__}: {e}")

print()
print("=" * 80)
