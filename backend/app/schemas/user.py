from pydantic import BaseModel, Field
from typing import Optional
from typing import List


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = Field(pattern="^(admin|accountant|executive)$")
    area: Optional[str] = None
    mobile: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    area: Optional[str] = None
    mobile: Optional[str] = None

    class Config:
        from_attributes = True


class UserList(BaseModel):
    items: List[UserOut]
    total: int
