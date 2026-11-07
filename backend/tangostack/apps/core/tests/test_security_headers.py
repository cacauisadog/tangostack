LOGIN = "/admin/login/"


def test_pages_carry_the_basic_security_headers(client, db):
    response = client.get(LOGIN)

    assert response["X-Content-Type-Options"] == "nosniff"
    assert response["Referrer-Policy"] == "same-origin"
    assert response["X-Frame-Options"] == "DENY"
    assert response["Cross-Origin-Opener-Policy"] == "same-origin"


def test_hsts_is_off_unless_configured_and_only_sent_over_https(settings, client, db):
    assert "Strict-Transport-Security" not in client.get(LOGIN, secure=True)

    settings.SECURE_HSTS_SECONDS = 15552000
    # SecurityMiddleware reads the setting when it loads: a new client loads it again
    client = type(client)()
    secure = client.get(LOGIN, secure=True)
    plain = client.get(LOGIN)

    assert secure["Strict-Transport-Security"] == "max-age=15552000"
    assert "Strict-Transport-Security" not in plain


def test_the_csp_is_report_only_by_default(client, db):
    response = client.get(LOGIN)

    assert "Content-Security-Policy" not in response
    policy = response["Content-Security-Policy-Report-Only"]
    assert "default-src 'self'" in policy
    assert "frame-ancestors 'none'" in policy


def test_enforce_mode_blocks_instead_of_reporting(settings, client, db):
    settings.SECURE_CSP = settings.SECURE_CSP_REPORT_ONLY
    settings.SECURE_CSP_REPORT_ONLY = {}

    response = client.get(LOGIN)

    assert "default-src 'self'" in response["Content-Security-Policy"]
    assert "Content-Security-Policy-Report-Only" not in response


def test_the_docs_page_allows_what_swagger_loads(client, db):
    response = client.get("/api/docs")

    policy = response["Content-Security-Policy"]
    assert "https://cdn.jsdelivr.net" in policy
    assert "Content-Security-Policy-Report-Only" not in response
