"""
Encode credentials.json and token.pickle to base64 for production deployment.
Run this after you have both files in the project root.
"""

import base64
import os
import sys

def encode_file(filename):
    """Encode a file to base64 and save to .b64 file"""
    if not os.path.exists(filename):
        print(f"❌ Error: {filename} not found!")
        print(f"   Place {filename} in project root first")
        return False
    
    try:
        with open(filename, "rb") as f:
            file_content = f.read()
        
        base64_content = base64.b64encode(file_content).decode('utf-8')
        
        output_file = f"{filename}.b64"
        with open(output_file, "w") as f:
            f.write(base64_content)
        
        print(f"✅ Encoded {filename}")
        print(f"   Output: {output_file}")
        print(f"   Size: {len(base64_content)} characters")
        print()
        return True
    except Exception as e:
        print(f"❌ Error encoding {filename}: {e}")
        return False

def main():
    print("=" * 60)
    print("Google Drive OAuth2 Base64 Encoder")
    print("=" * 60)
    print()
    
    files_to_encode = ["credentials.json", "token.pickle"]
    success_count = 0
    
    for filename in files_to_encode:
        if encode_file(filename):
            success_count += 1
    
    print()
    if success_count == 2:
        print("✅ All files encoded successfully!")
        print()
        print("📝 Next steps:")
        print("   1. Open credentials.json.b64 and copy entire content")
        print("   2. On Render → Environment → Add variable:")
        print("      Name: GOOGLE_CREDENTIALS_JSON_B64")
        print("      Value: <paste entire content>")
        print()
        print("   3. Open token.pickle.b64 and copy entire content")
        print("   4. On Render → Environment → Add variable:")
        print("      Name: GOOGLE_TOKEN_PICKLE_B64")
        print("      Value: <paste entire content>")
        print()
        print("   5. Add GOOGLE_DRIVE_FOLDER_ID if not already set")
        print("   6. Deploy → Backend will auto-decode ✅")
    else:
        print(f"❌ Only {success_count}/2 files encoded")
        print()
        print("⚠️  Make sure both files exist:")
        for filename in files_to_encode:
            exists = "✅" if os.path.exists(filename) else "❌"
            print(f"   {exists} {filename}")
    
    print()

if __name__ == "__main__":
    main()
