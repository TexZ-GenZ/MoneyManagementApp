from importlib import reload


def test_jwt_secret_override_isolated(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "TEMP_SECRET_123")
    from app.core import config as cfg

    reload(cfg)
    from app.core.config import settings

    assert settings.JWT_SECRET == "TEMP_SECRET_123"


def test_jwt_secret_reverts_after_previous(monkeypatch):
    from app.core import config as cfg

    reload(cfg)
    from app.core.config import settings

    assert settings.JWT_SECRET != "TEMP_SECRET_123"
