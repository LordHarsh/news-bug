import React, { useState, useEffect } from "react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";

const libraries = ["places", "marker"]; // For optional place details

const MapComponent = ({ data }) => {
  // Load the map
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Initial map settings
  const mapContainerStyle = {
    width: "85%",
    height: "500px",
  };
  const defaultCenter = {
    lat: 20.5937, // Replace with an appropriate default latitude
    lng: 78.9629, // Replace with an appropriate default longitude
  };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={8} // Adjust initial zoom level
        center={defaultCenter}
      >
        {/* Display markers for each item in your data */}
        {data.map((item) => {
          console.log(item);
          console.log(item.latitude);
          console.log(item.longitude);
          return (
            <Marker
              key={item.keyword + item.latitude + item.longitude} // Create a somewhat unique key
              position={{
                lat: parseFloat(item.latitude),
                lng: parseFloat(item.longitude),
              }}
              title={item.keyword}
              // You can add an info window or custom label if desired
            />
          );
        })}
      </GoogleMap>
    </div>
  );
};

export default MapComponent;
