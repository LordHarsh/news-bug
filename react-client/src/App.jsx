import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Home from "./pages/Home";
import Data from "./pages/Data";
import View from "./pages/View";

import { BrowserRouter, Route, Routes } from "react-router-dom";
import './App.css'
import Header from './components/Header';
import { Toaster } from 'sonner';
import WebData from './pages/WebData';
import WebFilter from './pages/WebFilter';

function App() {
  
  return (
    <>
    <Header />
      <BrowserRouter>
        <Toaster className='tw-mr-4' richColors/>
        <Routes>
          <Route path="/" element={<Home />} /> 
          <Route path="/data" element={<Data />} /> 
          <Route path="/webdata" element={<WebData />} /> 
          <Route path="/view" element={<View />} /> 
          <Route path="/webfilter" element={<WebFilter />} /> 
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
