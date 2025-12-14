from fastapi import FastAPI

app = FastAPI(
    title="DiaConnect Family API",
    version="1.0.0"
)


@app.get("/")
def read_root():
    return {
        "message": "DiaConnect Family API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
