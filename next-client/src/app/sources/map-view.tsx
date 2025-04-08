import React, { useEffect, useRef, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { KeywordDetails } from '@/lib/types/keyword';

interface Props {
    keywords: KeywordDetails[];
}

const MapView = ({ keywords }: Props) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    // Convert keywords to GeoJSON format
    const geojsonData = useMemo(() => {
        return {
            type: 'FeatureCollection',
            features: keywords.map(keyword => ({
                type: 'Feature',
                properties: {
                    id: keyword._id,
                    keyword: keyword.keyword,
                    caseCount: keyword.caseCount,
                    location: keyword.location,
                    articleId: keyword.articleId,
                    sourceId: keyword.sourceId
                },
                geometry: {
                    type: 'Point',
                    coordinates: [keyword.longitude, keyword.latitude]
                }
            }))
        } as GeoJSON.FeatureCollection;
    }, [keywords]);

    useEffect(() => {
        if (!mapContainerRef.current || keywords.length === 0) return;

        mapboxgl.accessToken = 'pk.eyJ1IjoibG9yZGhhcnNoIiwiYSI6ImNtN3Q1a3o2MjB5aDIybHNiZjdvOWt0NnMifQ.D4T6wdU-3fMIwdJUIwyLoA';

        // Calculate the center point based on the average of all coordinates
        const centerLat = keywords.reduce((sum, k) => sum + k.latitude, 0) / keywords.length;
        const centerLng = keywords.reduce((sum, k) => sum + k.longitude, 0) / keywords.length;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            // Change from dark-v11 to a colored style
            style: 'mapbox://styles/mapbox/streets-v12', // Colorful street map style
            // Other options include:
            // 'mapbox://styles/mapbox/outdoors-v12' - Terrain-focused map with natural features
            // 'mapbox://styles/mapbox/light-v11' - Light colored map
            // 'mapbox://styles/mapbox/satellite-streets-v12' - Satellite imagery with street overlays
            center: [centerLng, centerLat],
            zoom: 3
        });

        mapRef.current = map;

        map.on('load', () => {
            if (!map) return;

            // When adding the source:
            map.addSource('keywords', {
                type: 'geojson',
                data: geojsonData,
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 50,
                clusterProperties: {
                    // Sum all caseCount values in the cluster
                    sumCaseCount: ['+', ['get', 'caseCount']]
                }
            });

            // Then modify the cluster layer to use sumCaseCount instead of point_count:
            map.addLayer({
                id: 'clusters',
                type: 'circle',
                source: 'keywords',
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': [
                        'step',
                        ['get', 'sumCaseCount'],  // Use sumCaseCount instead of point_count
                        '#51bbd6',
                        100,
                        '#f1f075',
                        500,
                        '#f28cb1'
                    ],
                    'circle-radius': [
                        'step',
                        ['get', 'sumCaseCount'],  // Use sumCaseCount instead of point_count
                        20,
                        100,
                        30,
                        500,
                        40
                    ]
                }
            });

            // Add cluster count text
            map.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: 'keywords',
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': ['get', 'sumCaseCount'],  // Display sumCaseCount instead
                    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 12
                }
            });

            // Add individual keyword points
            map.addLayer({
                id: 'unclustered-point',
                type: 'circle',
                source: 'keywords',
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': [
                        'interpolate',
                        ['linear'],
                        ['get', 'caseCount'],
                        1, '#11b4da',    // Low case count
                        50, '#e67e22',   // Medium case count
                        100, '#e74c3c'   // High case count
                    ],
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['get', 'caseCount'],
                        1, 4,            // Small radius for low count
                        50, 8,           // Medium radius
                        100, 12          // Large radius for high count
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#fff'
                }
            });

            // Handle cluster click - zoom in
            map.on('click', 'clusters', (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
                if (!map || !e.features || e.features.length === 0) return;

                const clusterId = e.features[0].properties?.cluster_id;
                if (!clusterId) return;

                const source = map.getSource('keywords');
                if (source && 'getClusterExpansionZoom' in source) {
                    (source as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
                        clusterId,
                        (error: Error | null | undefined, zoom: number | null | undefined) => {
                            if (error || zoom === null || zoom === undefined) return;
                            map.easeTo({
                                center: (e && e.lngLat)
                                    ? ([e.lngLat.lng, e.lngLat.lat] as [number, number])
                                    : [centerLng, centerLat],
                                zoom: zoom
                            });
                        }
                    );
                }
            });

            // Handle individual keyword point click - show popup
            map.on('click', 'unclustered-point', (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
                if (!map || !e.features || e.features.length === 0) return;

                if (e.features[0].geometry.type !== 'Point') return;

                const coordinates = [...(e.features[0].geometry.coordinates as [number, number])];
                const properties = e.features[0].properties;

                if (!properties) return;

                // Extract and format data for popup
                const keyword = properties.keyword;
                const caseCount = properties.caseCount;
                // In the cluster click handler, you could add:
                const pointCount = e.features[0].properties?.point_count;
                const sumCaseCount = e.features[0].properties?.sumCaseCount;

                // And use these values in your popup if you add one for clusters
                const location = Array.isArray(properties.location)
                    ? properties.location.join(', ')
                    : properties.location;

                // Ensure that if the map is zoomed out such that
                // multiple copies of the feature are visible, the
                // popup appears over the copy being pointed to.
                while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                }

                new mapboxgl.Popup()
                    .setLngLat(coordinates as [number, number])
                    .setHTML(`
                        <div style="color: #333333;">
                        <h3>Keyword: ${keyword}</h3>
                        <p>Case Count: ${caseCount}</p>
                        <p>Location: ${location}</p>
                        <p>Articles: ${properties.articleId?.length || 0}</p>
                        <p>Sources: ${properties.sourceId?.length || 0}</p>
                        </div>
                    `)
                    .addTo(map);
            });

            // Change cursor to pointer when over clusters or points
            map.on('mouseenter', 'clusters', () => {
                if (map.getCanvas()) {
                    map.getCanvas().style.cursor = 'pointer';
                }
            });

            map.on('mouseleave', 'clusters', () => {
                if (map.getCanvas()) {
                    map.getCanvas().style.cursor = '';
                }
            });

            map.on('mouseenter', 'unclustered-point', () => {
                if (map.getCanvas()) {
                    map.getCanvas().style.cursor = 'pointer';
                }
            });

            map.on('mouseleave', 'unclustered-point', () => {
                if (map.getCanvas()) {
                    map.getCanvas().style.cursor = '';
                }
            });
        });

        return () => {
            if (map) map.remove();
        };
    }, [keywords, geojsonData]);

    return <div id="map" ref={mapContainerRef} style={{ height: '100vh' }}></div>;
};

export default MapView;