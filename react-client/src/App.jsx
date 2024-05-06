import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Home from "./pages/Home";
import Data from "./pages/Data";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import './App.css'

function App() {
  
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} /> 
          <Route path="/data" element={<Data />} /> 
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
