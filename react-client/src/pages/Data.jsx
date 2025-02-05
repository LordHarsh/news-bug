import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import NewspaperDetailsTable from "../components/NewspaperDetailsTable";

const Data = () => {
  const [newspapers, setNewspapers] = useState([]);
  const [selectedNewspaper, setSelectedNewspaper] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const ISODate = (date) => {
    const d = new Date(date);
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return d.toLocaleDateString(undefined, options);
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const backend_url = import.meta.env.VITE_BACKEND_URL;
        if (!backend_url) {
          throw new Error("REACT_APP_BACKEND_URL is not defined");
        }
        const response = await fetch(`${backend_url}/data/names`);
        if (!response.ok) {
          throw new Error("Server is down. Can't fetch respone"); // Replace with more specific handling if needed
        }
        const data = await response.json();
        setNewspapers(data);
      } catch (error) {
        setError(error.message); // Set the error message
      } finally {
        setIsLoading(false); // Set loading state to false in any case
      }
    };

    fetchData();
  }, []);

  const handleNewspaperClick = (newspaper) => {
    setSelectedNewspaper(newspaper);
  };

  return (
    <div className="">
      <div className="row">
        {" "}
        {/* Added row for layout */}
        <div className="col-md-3 sidebar tw-w-1/5">
          {/* ... your sidebar code ... */}
          <h3 className="tw-p-4">Newspapers</h3>
          
          {isLoading && (
            <div className="tw-flex-col tw-pl-4 justify-content-center tw-align-middle">
              <h5 className="">Fetching newspapers...</h5>
              <div className="spinner-border tw-justify-center" role="status">
                <span className="sr-only"></span>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-danger">
              Error loading data: {error}
            </div>
          )}

          {!isLoading && !error && (
            <ul className="list-group" id="newspaperList">
            {newspapers.map((newspaper) => (
              <li
                key={newspaper._id} // Assume newspapers have IDs
                className="list-group-item"
                onClick={() => handleNewspaperClick(newspaper)}
              >
                {newspaper.name} - {ISODate(newspaper.date)} <br />
                {newspaper.status}
              </li>
            ))}
          </ul>
          )}
        </div>
        <div className="col-md-9 main-content tw-w-4/5">
          {" "}
          {/* Main content area */}
          {selectedNewspaper && (
            <NewspaperDetailsTable newspaper={selectedNewspaper} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Data;
