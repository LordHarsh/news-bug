import React from 'react';
import MapGL, { Marker, Popup } from 'react-map-gl';

const MapView = ({ data }) => {
  const [viewport, setViewport] = React.useState({
    latitude: 37.78,
    longitude: -122.41,
    zoom: 11,
    bearing: 0,
    pitch: 0
  });

  const [selectedLocation, setSelectedLocation] = React.useState(null);

  return (
    <MapGL
      {...viewport}
      width="100vw"
      height="100vh"
      mapStyle="mapbox://styles/mapbox/streets-v11"
      onViewportChange={nextViewport => setViewport(nextViewport)}
      mapboxApiAccessToken={import.meta.env.VITE_MAPBOX_TOKEN} // Ensure your token is stored in environment variables
    >
      {data.map((location, index) => (
        <Marker key={index} latitude={location.latitude} longitude={location.longitude}>
          <button
            className="marker-btn"
            onClick={(e) => {
              e.preventDefault();
              setSelectedLocation(location);
            }}
          >
            <img src="/marker-icon.png" alt="Marker" />
          </button>
        </Marker>
      ))}

      {selectedLocation && (
        <Popup
          latitude={selectedLocation.latitude}
          longitude={selectedLocation.longitude}
          onClose={() => setSelectedLocation(null)}
        >
          <div>
            <h2>{selectedLocation.keyword}</h2>
            <p>{selectedLocation.address}</p>
          </div>
        </Popup>
      )}
    </MapGL>
  );
};

export default MapView;
