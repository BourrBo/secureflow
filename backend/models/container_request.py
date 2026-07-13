from pydantic import BaseModel


class ContainerScanRequest(BaseModel):
    image_name: str