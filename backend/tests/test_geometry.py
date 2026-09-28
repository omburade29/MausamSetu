from app.geospatial.geometry import filter_features_by_bbox, polygon_rect


def test_bbox_filter_keeps_overlapping_cells():
    near = {"type": "Feature", "geometry": polygon_rect(73.8, 18.4, 73.85, 18.45), "properties": {}}
    far = {"type": "Feature", "geometry": polygon_rect(80.0, 22.0, 80.1, 22.1), "properties": {}}
    kept = filter_features_by_bbox([near, far], 73.7, 18.3, 74.0, 18.6)
    assert kept == [near]
