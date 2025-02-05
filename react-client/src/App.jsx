import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Home from "./pages/Home";
import Data from "./pages/Data";
import View from "./pages/View";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import './App.css'
import Header from './components/Header';

function App() {
  
  return (
    <>
    <Header />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} /> 
          <Route path="/data" element={<Data />} /> 
          <Route path="/view" element={<View />} /> 
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
