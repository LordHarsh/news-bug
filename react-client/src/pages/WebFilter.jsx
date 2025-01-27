import React, { useState, useEffect } from "react";
import KeywordMap from "../components/KeywordMap";

const WebFilter = () => {
  const [data, setData] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDraggableMarker, setShowDraggableMarker] = useState(false);
  const [position, setPosition] = useState({ lat: 51.505, lng: -0.09 });

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const backend_url = import.meta.env.VITE_BACKEND_URL;
      if (!backend_url) {
        throw new Error("REACT_APP_BACKEND_URL is not defined");
      }
      const bodyData = {};
      if (keywords.length) {
        bodyData.keywords = keywords;
      }
      if (startDate) {
        bodyData.start_date = startDate;
      }
      if (endDate) {
        bodyData.end_date = endDate;
      }
      if (latitude) {
        bodyData.latitude = latitude;
      }
      if (longitude) {
        bodyData.longitude = longitude;
      }
      if (radius) {
        bodyData.radius = radius;
      }
      console.log(bodyData);
      const response = await fetch(`${backend_url}/webfilter`, {
        method: "POST",
        body: JSON.stringify(bodyData),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Server is down. Can't fetch response");
      }
      const data = await response.json();
      console.log(data)
      setData(data);
    } catch (error) {
      setError("Error fetching data.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeywordChange = (e) => {
    const { value } = e.target;
    setKeywords(value.split(",").map((kw) => kw.trim()));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSetMarker = () => {
    setShowDraggableMarker(() => !showDraggableMarker);
  };

  const handlePositionChange = (pos) => {
    setLatitude(pos.lat);
    setLongitude(pos.lng);
  };

  return (
    <div className="container mt-5">
      <h1 className="mb-4">Newspaper Articles</h1>
      <div className="card mb-4">
        <div className="card-body">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchData();
            }}
          >
            <div className="row mb-3">
              <div className="col">
                <label htmlFor="keywords" className="form-label">
                  Keywords (comma separated)
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="keywords"
                  onChange={handleKeywordChange}
                />
              </div>
              <div className="col">
                <label htmlFor="startDate" className="form-label">
                  Start Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="col">
                <label htmlFor="endDate" className="form-label">
                  End Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="row mb-3">
              <div className="col">
              <label htmlFor="latitude" className="tw-flex tw-flex-col">
                  Set Marker on Map
                </label>
                <button
                  type="button"
                  className="btn btn-secondary tw-w-full"
                  onClick={handleSetMarker}
                >
                  Toggle
                </button>
              </div>
              <div className="col">
                <label htmlFor="latitude" className="form-label">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  id="latitude"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </div>
              <div className="col">
                <label htmlFor="longitude" className="form-label">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  id="longitude"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </div>
              <div className="col">
                <label htmlFor="radius" className="form-label">
                  Radius (km)
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  id="radius"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary mb-2">
              Filter
            </button>
          </form>
        </div>
      </div>
      {loading && (
        <div className="d-flex justify-content-center mb-4">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {data && (
        <div className="card">
          <KeywordMap data={data} showDraggableMarker={showDraggableMarker} position={position} setPosition={setPosition} handlePositionChange={handlePositionChange} />
          <div className="card-body">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Address</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th className="tw-w-2/12">Date (dd-mm-yyyy)</th>
                  <th>Paragraph</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={index}>
                    <td>{item.keyword}</td>
                    <td>{item.address}</td>
                    <td>{item.latitude}</td>
                    <td>{item.longitude}</td>
                    <td>{item.date}</td>
                    <td>{item.paragraph}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebFilter;
