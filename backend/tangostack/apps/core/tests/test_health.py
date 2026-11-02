from unittest.mock import patch

from django.db import OperationalError


def test_health_is_ok_when_the_database_answers(client, db):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response["Cache-Control"] == "no-store"


def test_health_answers_for_any_host(client, db):
    # a container probe asks for localhost or the container IP, not an allowed host
    response = client.get("/api/health", headers={"host": "10.0.0.7:8000"})

    assert response.status_code == 200


def test_health_is_unavailable_when_the_database_is_down(client, db):
    with patch("django.db.connection.cursor", side_effect=OperationalError("down")):
        response = client.get("/api/health")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
