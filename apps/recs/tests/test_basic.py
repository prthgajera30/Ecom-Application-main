import json
import pytest

from apps.recs.app import app, engine


@pytest.fixture(autouse=True)
def reset_engine():
    engine.reset()
    yield
    engine.reset()


@pytest.fixture
def client():
    return app.test_client()


def seed_events(client):
    events = [
        {"userId": "u1", "productId": "p1", "eventType": "view"},
        {"userId": "u1", "productId": "p2", "eventType": "add_to_cart"},
        {"userId": "u2", "productId": "p2", "eventType": "view"},
        {"userId": "u2", "productId": "p3", "eventType": "purchase"},
        {"userId": "u3", "productId": "p3", "eventType": "view"},
    ]
    resp = client.post('/ingest/events', data=json.dumps(events), content_type='application/json')
    assert resp.status_code == 200
    assert resp.get_json()['received'] == len(events)


def test_health(client):
    resp = client.get('/health')
    assert resp.status_code == 200
    assert resp.get_json().get('ok') is True


def test_ingest_events_filters_invalid(client):
    payload = [
        {"userId": "u1", "productId": "p1", "eventType": "view"},
        {"userId": "u1", "productId": "", "eventType": "view"},
        {"userId": "", "productId": "p2", "eventType": "purchase"},
        {"userId": "u2", "productId": "p2", "eventType": "unknown"},
    ]
    resp = client.post('/ingest/events', data=json.dumps(payload), content_type='application/json')
    assert resp.status_code == 200
    # Only the first row should be ingested
    assert resp.get_json()['received'] == 1


def test_recommendations_for_known_user(client):
    seed_events(client)
    resp = client.get('/recommendations?userId=u1&k=3')
    assert resp.status_code == 200
    items = resp.get_json()['items']
    # User u1 has interacted with p1 and p2 so we should not recommend those
    product_ids = [item['productId'] for item in items]
    assert 'p1' not in product_ids and 'p2' not in product_ids
    assert 'p3' in product_ids


def test_recommendations_similar_products(client):
    seed_events(client)
    resp = client.get('/recommendations?productId=p2&k=2')
    assert resp.status_code == 200
    product_ids = [item['productId'] for item in resp.get_json()['items']]
    assert 'p2' not in product_ids
    assert 'p3' in product_ids


def test_recommendations_cold_start(client):
    seed_events(client)
    resp = client.get('/recommendations?k=2')
    assert resp.status_code == 200
    product_ids = [item['productId'] for item in resp.get_json()['items']]
    assert 'p3' in product_ids


def test_recommendations_no_events_returns_empty(client):
    resp = client.get('/recommendations')
    assert resp.status_code == 200
    assert resp.get_json()['items'] == []

