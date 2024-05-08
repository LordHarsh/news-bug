import React from "react";
import PropTypes from "prop-types";
import MapComponent from "./MapContainer";
import MyMapComponent from "./MyMapComponent";
import MapView from "./MapView";


const NewspaperDetailsTable = ({ newspaper }) => {
  const ISODate = (date) => {
    const d = new Date(date);
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return d.toLocaleDateString(undefined, options);
  };

  return (
    <div className="tw-mt-6">
      <h2>{newspaper.name} Details</h2>
      <p>{ISODate(newspaper.date)}</p>
      <p>Uploaded on: {ISODate(newspaper.upload_time)}</p>
      <p>Status: {newspaper.status}</p>
      {/* <MapComponent data={newspaper.data} /> */}
      <MapView data={newspaper.data} />
      
      {/* <MyMapComponent locations={newspaper.data} /> */}
      {/* <MapView locations={newspaper.data} /> */}
      <h4>Details:</h4>
      <table className="table table-striped">
        <thead>
          <tr>
            <th>Matched Keyword</th>
            <th>Text</th>
            <th>Geographic Location</th>
            <th>Latitude</th>
            <th>Longitude</th>
            <th>Page</th>
          </tr>
        </thead>
        <tbody>
          {newspaper.data.map((detail, index) => (
            <tr key={index}>
              <td>{detail.keyword}</td>
              <td className="">{detail.paragraph}</td>
              <td>{detail.address}</td>
              <td>{detail.latitude}</td>
              <td>{detail.longitude}</td>
              <td>{detail.page}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
NewspaperDetailsTable.propTypes = {
  newspaper: PropTypes.shape({
    name: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    upload_time: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    page: PropTypes.string,
    data: PropTypes.arrayOf(
      PropTypes.shape({
        keyword: PropTypes.string.isRequired,
        address: PropTypes.string.isRequired,
        latitude: PropTypes.number.isRequired,
        longitude: PropTypes.number.isRequired,
        paragraph: PropTypes.string.isRequired,
      })
    ).isRequired,
  }).isRequired,
};

export default NewspaperDetailsTable;
