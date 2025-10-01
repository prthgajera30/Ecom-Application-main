from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Iterable, List, Optional

import pandas as pd
from flask import Flask, jsonify, request
from sklearn.metrics.pairwise import cosine_similarity

EVENT_WEIGHTS = {
    'view': 1.0,
    'add_to_cart': 2.0,
    'purchase': 3.0,
}


@dataclass
class RecommendationRequest:
    user_id: Optional[str]
    product_id: Optional[str]
    k: int


class RecommendationEngine:
    def __init__(self) -> None:
        self._lock = Lock()
        self._events = self._empty_frame()

    @staticmethod
    def _empty_frame() -> pd.DataFrame:
        return pd.DataFrame({
            'userId': pd.Series(dtype='string'),
            'productId': pd.Series(dtype='string'),
            'weight': pd.Series(dtype='float64'),
            'timestamp': pd.Series(dtype='object'),
        })

    def reset(self) -> None:
        with self._lock:
            self._events = self._empty_frame()

    def ingest(self, events: Iterable[dict]) -> int:
        rows = []
        for raw in events:
            user_id = raw.get('userId')
            product_id = raw.get('productId')
            event_type = (raw.get('eventType') or '').lower()
            if not user_id or not product_id:
                continue
            weight = EVENT_WEIGHTS.get(event_type)
            if weight is None:
                continue
            timestamp = raw.get('ts') or raw.get('timestamp')
            rows.append({'userId': str(user_id), 'productId': str(product_id), 'weight': float(weight), 'timestamp': timestamp})

        if not rows:
            return 0

        new_events = pd.DataFrame(rows)
        with self._lock:
            self._events = pd.concat([self._events, new_events], ignore_index=True)
        return len(rows)

    def recommend(self, req: RecommendationRequest) -> List[dict]:
        with self._lock:
            events = self._events.copy()

        if events.empty:
            return []

        matrix = events.pivot_table(
            index='userId',
            columns='productId',
            values='weight',
            aggfunc='sum',
            fill_value=0.0,
        )
        if matrix.empty:
            return []

        popularity = events.groupby('productId')['weight'].sum().sort_values(ascending=False)
        scores = pd.Series(dtype=float)

        if matrix.shape[1] > 1:
            similarity = cosine_similarity(matrix.T)
            sim_df = pd.DataFrame(similarity, index=matrix.columns, columns=matrix.columns)
        else:
            sim_df = pd.DataFrame(0.0, index=matrix.columns, columns=matrix.columns)

        if req.user_id and req.user_id in matrix.index:
            user_vector = matrix.loc[req.user_id]
            interacted = user_vector[user_vector > 0.0]
            for product_id, weight in interacted.items():
                scores = scores.add(sim_df[product_id] * weight, fill_value=0.0)
            scores = scores.drop(interacted.index, errors='ignore')

        if req.product_id and req.product_id in matrix.columns:
            scores = scores.add(sim_df[req.product_id], fill_value=0.0)
            scores = scores.drop(req.product_id, errors='ignore')

        scores = scores[scores > 0]

        if scores.empty:
            fallback = popularity.drop(index=[req.product_id] if req.product_id else [], errors='ignore')
            if req.user_id and req.user_id in matrix.index:
                seen = matrix.loc[req.user_id]
                fallback = fallback.drop(index=seen[seen > 0].index, errors='ignore')
            top = fallback.head(req.k)
            if top.empty:
                return []
            max_pop = top.iloc[0]
            return [
                {'productId': product_id, 'score': float(rank) / float(max_pop) if max_pop > 0 else 0.0}
                for product_id, rank in top.items()
            ]

        top_scores = scores.sort_values(ascending=False).head(req.k)
        max_score = top_scores.iloc[0] if not top_scores.empty else 0.0
        normalised = top_scores / max_score if max_score > 0 else top_scores
        return [
            {'productId': product_id, 'score': float(score)}
            for product_id, score in normalised.items()
        ]


engine = RecommendationEngine()
app = Flask(__name__)


@app.get('/health')
def health():
    return jsonify({'ok': True})


@app.post('/ingest/events')
def ingest_events():
    payload = request.get_json(force=True, silent=True)
    if not isinstance(payload, list):
        return jsonify({'received': 0})
    received = engine.ingest(payload)
    return jsonify({'received': received})


@app.get('/recommendations')
def recommendations():
    user_id = request.args.get('userId')
    product_id = request.args.get('productId')
    try:
        k = int(request.args.get('k', '8'))
    except (TypeError, ValueError):
        k = 8
    k = max(1, min(k, 50))

    items = engine.recommend(RecommendationRequest(user_id=user_id, product_id=product_id, k=k))
    return jsonify({'items': items})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
