const initialFiles = [
    { id: 1, name: 'Report.docx', date: '2024-04-28' },
    { id: 2, name: 'Presentation.pptx', date: '2024-04-27' },
    { id: 3, name: 'Image.png', date: '2024-04-26' },
    { id: 4, name: 'Notes.txt', date: '2024-04-25' }
];

function Sidebar() {
    const [files, setFiles] = React.useState(initialFiles);

    // Function to handle clicking on a file
    const handleFileClick = (file) => {
        console.log("Clicked File:", file.name);
        // You can perform other actions here based on the file clicked
    };

    return (
        <div className='bg-red-300' class='bg-red-300' style={{ width: '250px', height: '100vh', padding: '20px' }}>
            <div class="col-md-3 sidebar">
                <button class="btn btn-primary d-block d-md-none mb-3" type="button" data-toggle="collapse" data-target="#sidebarCollapse" aria-expanded="false" aria-controls="sidebarCollapse">
                    Toggle Sidebar
                </button>
                <h4>Files</h4>
                <div class="collapse d-md-block" id="sidebarCollapse">
                    <h5>Newspaper List</h5>
                    <ul class="list-group" id="newspaperList">
                    </ul>
                </div>
            </div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {files.map(file => (
                    <li key={file.id}
                        style={{ padding: '10px', cursor: 'pointer' }}
                        onClick={() => handleFileClick(file)}>
                        <strong>{file.name}</strong> - <small>{file.date}</small>
                    </li>
                ))}
            </ul>
        </div>
    );
}

ReactDOM.render(<Sidebar />, document.getElementById('sidebar'));
