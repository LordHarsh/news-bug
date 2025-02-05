import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css';


const apiKey = 'YOUR_API_KEY'; // Replace with your actual API key

window.google = {
  maps: {
    ApiaryKey: apiKey,
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
