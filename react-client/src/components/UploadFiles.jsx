import React, { useState } from "react";

function UploadFiles() {
  const [file, setFile] = useState(null); // State to manage the uploaded file
  const [newspaperName, setNewspaperName] = useState(""); // State to manage the newspaper name
  const [date, setDate] = useState(""); // State to manage the date
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', or null
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("newspaper_name", newspaperName);
    formData.append("date", date);

    // Use fetch to make the POST request (same logic as in HTML script)
    try {
      // Wrap in try-catch for error handling
      setUploadStatus("pending");

      const backend_url = import.meta.env.VITE_BACKEND_URL;
      if (!backend_url) {
        throw new Error("REACT_APP_SERVER_URL is not defined");
      }
      const response = await fetch(`${backend_url}/upload_pdf`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        setUploadStatus("success");
        setErrorMessage(null); // Reset error if previous failure
      } else {
        setUploadStatus("error");
        setErrorMessage("Upload failed. Please try again."); // Set a generic message
        // Optionally: Handle specific error codes from the backend
      }
    } catch (error) {
      setUploadStatus("error");
      setErrorMessage("Upload failed: " + error.message); // Set error message
    }
  };

  return (
    <div className="container tw-mt-10">
      <form
        id="uploadForm"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
      >
        <h2>Upload PDF</h2>
        <div className="mb-3">
          <label htmlFor="file" className="form-label">
            PDF File
          </label>
          <input
            type="file"
            className="form-control"
            id="file"
            name="file"
            required
            onChange={(event) => setFile(event.target.files[0])}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="newspaper_name" className="form-label">
            Newspaper Name
          </label>
          <input
            type="text"
            className="form-control"
            id="newspaper_name"
            name="newspaper_name"
            required
            onChange={(event) => setNewspaperName(event.target.value)}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="date" className="form-label">
            Date
          </label>
          <input
            type="date"
            className="form-control"
            id="date"
            name="date"
            required
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        {/* ... (Form Controls here) */}
        {uploadStatus === 'pending' && (
          <div className="alert alert-info">Uploading...</div>
        )}
        {uploadStatus === 'success' && (
          <div className="alert alert-success">File uploaded successfully!</div>
        )}
        {uploadStatus === 'error' && (
          <div className="alert alert-danger">
            {errorMessage}
          </div>
        )}
        <button type="submit" className="btn btn-primary">
          Upload and Process
        </button>
      </form>
    </div>
  );
}

export default UploadFiles;
