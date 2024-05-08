import React from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '400px'
};

const center = {
  lat: 13.0827, 
  lng: 80.2707
};

function MyMapComponent({ locations }) {
  console.log(locations);
  return (
    <LoadScript
      googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
    >
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={10}
      >
        <Marker
        key={"hello"}
        position={{ lat: 12.823007055600739, lng: 80.04104074693981 }}
        />
        {/* {locations.map(location => (
          <Marker
            key={location.keyword + String(location.latitude) + String(location.longitude)} // Assuming keyword is unique
            position={{ lat: parseFloat(location.latitude), lng: parseFloat(location.longitude) }}
          />
        ))} */}
      </GoogleMap>
    </LoadScript>
  )
}

export default MyMapComponent;
