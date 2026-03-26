from fastapi import FastAPI
from routes import users, vms, provider

app = FastAPI()

app.include_router(users.router)
app.include_router(vms.router)
app.include_router(provider.router)

@app.get("/")
def root():
    return {"message": "Backend is running"}