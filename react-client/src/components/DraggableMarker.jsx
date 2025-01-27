import React, { useState, useCallback, useRef, useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import PropTypes from 'prop-types';


const DraggableMarker = ({position, setPosition, handlePositionChange}) => {
  const markerRef = useRef(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          setPosition(marker.getLatLng());
          handlePositionChange(marker.getLatLng());
        }
      },
    }),
    []
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    >
      <Popup minWidth={90}>
        <span>
          {`Lat: ${position.lat.toFixed(4)}, Lon: ${position.lng.toFixed(4)}`}
        </span>
      </Popup>
    </Marker>
  );
}

DraggableMarker.propTypes = {
  position: PropTypes.shape({
    lat: PropTypes.number,
    lng: PropTypes.number,
  }).isRequired,
}

export default DraggableMarker;