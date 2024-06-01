import React, {Link} from 'react';
import { Button } from 'react-bootstrap';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';

export default function Header ()  {
    return (
        <Navbar g="dark" data-bs-theme="dark" expand="lg" className="bg-body-tertiary justify-content-between">
          <Container className=''>
            <Navbar.Brand href="/">NewsBug</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse id="basic-navbar-nav" className='tw-justify-end'>
              {/* <Nav className="me-auto">
              </Nav> */}
                <Button variant="outline-primary" className='tw-mr-4' href='/view'>View</Button>
                <Button variant="outline-primary" href='/data'>Data</Button>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      );
    // return (
    //     <nav className="navbar navbar-expand-lg navbar-dark bg-dark" style={{ marginBottom: '50px' }}>
    //         <a className="navbar-brand" href="#">NewBug</a>
    //         {/* ... (Navbar Toggler, Links. Refer to the HTML) */}
    //         <div className="collapse navbar-collapse" id="navbarNav">
    //             <ul className="navbar-nav ml-auto">
    //                 <li className="nav-item">
    //                     <button className="btn btn-outline-light my-2 my-sm-0" onClick={() => window.location.href='/data'}>View Data</button>
    //                 </li>
    //             </ul>
    //         </div>
    //     </nav>
    // );
}

