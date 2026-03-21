try:
    import sqlalchemy
    from sqlalchemy.orm import declarative_base, sessionmaker
    print(f"SQLAlchemy version: {sqlalchemy.__version__}")
    print("Imports successful!")
except ImportError as e:
    print(f"Import Error: {e}")
