import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";

const UploadTabs = () => {
  const [file, setFile] = useState(null);
  const [newspaperName, setNewspaperName] = useState("");
  const [date, setDate] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("Unknown");
  const [uploadStatus, setUploadStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const platforms = ["CNN", "Indian Express",  "Times of India", "BBC", "Al Jazeera", "Unknown"];

  const extractPlatform = (url) => {
    if (url.includes("cnn.com")) return "CNN";
    if (url.includes("indianexpress.com")) return "Indian Express";
    if (url.includes("timesofindia.indiatimes.com")) return "Times of India";
    if (url.includes("bbc.com")) return "BBC";
    if (url.includes("aljazeera.com")) return "Al Jazeera";
    return "Unknown";
  };

  useEffect(() => {
    if (url) {
      const detectedPlatform = extractPlatform(url);
      setPlatform(detectedPlatform);
    }
  }, [url]);

  console.log("Platform detected: ", platform);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    try {
      if (!file || !newspaperName || !date) {
        throw new Error("Please fill in all the fields");
      }
      formData.append("file", file);
      formData.append("newspaper_name", newspaperName);
      formData.append("date", date);
      console.log(formData);
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
        setErrorMessage(null);
      } else {
        setUploadStatus("error");
        setErrorMessage("Upload failed. Please try again.");
      }
    } catch (error) {
      setUploadStatus("error");
      console.log(error);
      toast.error(error.message);
      setErrorMessage("Upload failed: " + error.message);
    }
  };

  const handleSubmitURL = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    try {
      if (url === "" || !url || platform === "Unknown") {
        throw new Error("URL field empty");
      }
      formData.append("url", url);
      formData.append("platform", platform);
      setUploadStatus("pending");
      const backend_url = import.meta.env.VITE_BACKEND_URL;
      if (!backend_url) {
        throw new Error("REACT_APP_SERVER_URL is not defined");
      }
      console.log(formData);
      const response = await fetch(`${backend_url}/submit_url`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        setUploadStatus("success");
        setErrorMessage(null);
        toast.success(`URL submitted: ${url} (Platform: ${platform})`);
        setUrl("");
        setPlatform("Unknown");
      } else {
        setUploadStatus("error");
        setErrorMessage("Upload failed. Please try again.");
      }
    } catch (error) {
      setUploadStatus("error");
      console.log(error);
      toast.error(error.message);
      setErrorMessage("Upload failed: " + error.message);
    }
  };

  return (
    <Tabs
      defaultValue="Upload"
      className="tw-mt-10 lg:tw-min-w-[900px] sm:tw-w-[500px] tw-w-[350px]"
    >
      <TabsList className="tw-grid tw-w-full tw-grid-cols-2">
        <TabsTrigger value="pdfs">pdfs</TabsTrigger>
        <TabsTrigger value="urls">urls</TabsTrigger>
      </TabsList>
      <TabsContent value="pdfs">
        <Card>
          <CardHeader>
            <CardTitle>Upload PDFs</CardTitle>
            <CardDescription>
              Upload the pdfs you want to upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="tw-space-y-2">
            <div className="tw-space-y-3">
              <Label htmlFor="file">PDF file</Label>
              <Input
                type="file"
                id="file"
                name="file"
                required
                onChange={(event) => setFile(event.target.files[0])}
              />
            </div>
            <div className="tw-space-y-3">
              <Label htmlFor="newspaper_name">Newspaper Name</Label>
              <Input
                type="text"
                id="newspaper_name"
                value={newspaperName}
                name="newspaper_name"
                required
                onChange={(event) => setNewspaperName(event.target.value)}
              />
            </div>
            <div className="tw-space-y-3">
              <Label htmlFor="date">Date</Label>
              <Input
                type="date"
                id="date"
                name="date"
                value={date}
                required
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="tw-flex tw-flex-col tw-justify-start">
            {uploadStatus === "pending" && (
              <div className="alert alert-info">Uploading...</div>
            )}
            {uploadStatus === "success" && (
              <div className="alert alert-success">
                File uploaded successfully!
              </div>
            )}
            {uploadStatus === "error" && (
              <div className="alert alert-danger">{errorMessage}</div>
            )}
            <Button onClick={handleSubmit}>Upload and Process</Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value="urls">
        <Card>
          <CardHeader>
            <CardTitle>Submit URLs</CardTitle>
            <CardDescription>Submit the URLs to process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="url">URL</Label>
              <Input
                type="url"
                id="url"
                value={url}
                name="url"
                required
                onChange={(event) => {
                  setUrl(event.target.value);
                }}
              />
            </div>
            <div className="tw-space-y-1">
              <Label htmlFor="platform">Platform</Label>
              <Select onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue>{platform || "Select platform"}</SelectValue>
                </SelectTrigger>
                <SelectContent defaultValue="unknown">
                  {platforms.map((p) => (
                    <SelectItem defaultValue={"unknown"} key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSubmitURL}>Submit</Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default UploadTabs;
