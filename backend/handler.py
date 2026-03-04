"""
AWS Lambda Handler for Jan-Sahayak.
Wraps the FastAPI app using Mangum for serverless deployment.

Deploy: Package this with all dependencies and upload to AWS Lambda.
Handler: handler.handler
"""

from mangum import Mangum
from main import app

handler = Mangum(app, lifespan="off")
