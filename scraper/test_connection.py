import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(DB_URL)
    print("✅ Conexão bem-sucedida!")
    conn.close()
except Exception as e:
    print("❌ Erro na conexão:", e)
