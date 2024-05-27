// src/KeywordMap.js

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Container, Row, Col } from 'react-bootstrap';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import PropTypes from 'prop-types';


// Fixing the default icon issue with Leaflet and React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});


const KeywordMap = ({ data }) => {
  return (
    <Container>
      <Row>
        <Col>
          <MapContainer center={[20, 0]} zoom={2} style={{ height: '600px', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {data.map((item, index) => (
              <Marker key={index} position={[item.latitude, item.longitude]}>
                <Popup>
                  <strong>Keyword:</strong> {item.keyword}<br />
                  <strong>Address:</strong> {item.address}<br />
                  <strong>Page:</strong> {item.page}<br />
                  <strong>Paragraph:</strong> {item.paragraph}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Col>
      </Row>
    </Container>
  );
};

KeywordMap.propTypes = {
    data: PropTypes.arrayOf(PropTypes.shape({
      keyword: PropTypes.string.isRequired,
      address: PropTypes.string,
      latitude: PropTypes.number,
      longitude: PropTypes.number,
      page: PropTypes.string,
      paragraph: PropTypes.string,
    })),
  };

export default KeywordMap;
