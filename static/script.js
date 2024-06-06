let currentVuln = 0;
let numVulns = 0;
let vulnData = [];

function generateVulnFields() {
    numVulns = document.getElementById('num-vulns').value;
    if (numVulns <= 0) {
        alert("The number of vulnerabilities must be greater than zero.");
        return;
    }

    vulnData = [];
    for (let i = 0; i < numVulns; i++) {
        vulnData.push({});
    }

    document.getElementById('vuln-modals').innerHTML = '';
    for (let i = 0; i < numVulns; i++) {
        document.getElementById('vuln-modals').innerHTML += `
            <button type="button" class="btn btn-secondary btn-block mt-2" onclick="openModal(${i})">Edit Vulnerability ${i + 1}</button>
        `;
    }

    document.getElementById('action-buttons').style.display = 'flex';
}

function openModal(index) {
    currentVuln = index;
    $('#modal-container').modal('show');
    populateVulnFields(index);
}

function closeModal() {
    $('#modal-container').modal('hide');
}

function closeViewModal() {
    $('#view-modal-container').modal('hide');
}

function populateVulnFields(index) {
    const vuln = vulnData[index];
    document.getElementById('vuln-fields').innerHTML = `
    <div class="form-row">
        <div class="form-group col-md-12 ">
            <label>Name:</label>
            <input type="text" class="form-control" name="name" value="${vuln.name || ''}" oninput="suggestVulnerabilities(this.value)" required>
            <div id="suggestions" class="list-group"></div>
        </div>
    </div>    
    <div class="form-row">    
        <div class="form-group col-md-3">
            <label>Risk:</label>
            <select class="form-control" name="risk" required>
                <option value="">Select...</option>
                <option value="Critical" ${vuln.risk === 'Critical' ? 'selected' : ''}>Critical</option>
                <option value="High" ${vuln.risk === 'High' ? 'selected' : ''}>High</option>
                <option value="Medium" ${vuln.risk === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Low" ${vuln.risk === 'Low' ? 'selected' : ''}>Low</option>
            </select>
        </div>
        <div class="form-group col-md-3">
            <label>Priority:</label>
            <select class="form-control" name="priority" required>
                <option value="">Select...</option>
                <option value="High" ${vuln.priority === 'High' ? 'selected' : ''}>High</option>
                <option value="Medium" ${vuln.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Low" ${vuln.priority === 'Low' ? 'selected' : ''}>Low</option>
            </select>
        </div>
        <div class="form-group col-md-6">
            <label>Remediation Complexity:</label>
            <select class="form-control" name="complexity" required>
                <option value="">Select...</option>
                <option value="High" ${vuln.complexity === 'High' ? 'selected' : ''}>High</option>
                <option value="Medium" ${vuln.complexity === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Low" ${vuln.complexity === 'Low' ? 'selected' : ''}>Low</option>
            </select>
        </div>
    </div>
    <div class="form-row">      
        <div class="form-group col-md-4">
            <label>Service:</label>
            <select class="form-control" name="service" required>
                <option value="">Select...</option>
                <option value="Web">Web</option>
                <option value="Infrastructure" >Infrastructure</option>
            </select>
        </div>
        <div class="form-group col-md-8">
            <label>Hosts affected:</label>
            <input type="text" class="form-control" name="assets" value="${vuln.assets || ''}" required>
        </div>
    </div>
        <div class="form-group">
            <label>Description:</label>
            <textarea class="form-control" name="description" required>${vuln.description || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Impact:</label>
            <textarea class="form-control" name="impact" required>${vuln.impact || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Recommendations:</label>
            <textarea class="form-control" name="recommendations" required>${vuln.recommendations || ''}</textarea>
        </div>
        <div class="form-group">
            <label>References:</label>
            <textarea class="form-control" name="references" required>${vuln.references_web || ''}</textarea>
        </div>
    `;
}

function saveVuln() {
    const formData = new FormData(document.getElementById('vuln-form'));
    const vuln = {};
    formData.forEach((value, key) => {
        vuln[key] = value;
    });
    vulnData[currentVuln] = vuln;
    closeModal();
}

function submitAllVulns() {
    document.getElementById('loading').style.display = 'block';
    const client = document.getElementById('client').value;
    const audit_date = document.getElementById('audit-date').value;

    fetch('/submit_vulnerabilities', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 'num-vulns': numVulns, 'vulnData': vulnData, 'client': client, 'audit_date': audit_date })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('loading').style.display = 'none';
        if (data.error) {
            document.getElementById('response').innerText = `Error: ${data.error}`;
        } else {
            document.getElementById('response').innerText = data.response;
            listVulnerabilities();
        }
    })
    .catch(error => {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('response').innerText = `Error: ${error}`;
    });
}

function generateReport() {
    document.getElementById('loading').style.display = 'block';
    const client = document.getElementById('client').value;
    const audit_date = document.getElementById('audit-date').value;

    fetch('/generate_report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 'num-vulns': numVulns, 'vulnData': vulnData, 'client': client, 'audit_date': audit_date })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('loading').style.display = 'none';
        if (data.error) {
            document.getElementById('response').innerText = `Error: ${data.error}`;
        } else {
            document.getElementById('response').innerText = data.message;
            listReports();
        }
    })
    .catch(error => {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('response').innerText = `Error: ${error}`;
    });
}

function suggestVulnerabilities(query) {
    if (!query) {
        document.getElementById('suggestions').innerHTML = '';
        return;
    }

    fetch(`/suggest_vulnerabilities?query=${query}`)
        .then(response => response.json())
        .then(data => {
            const suggestions = data.suggestions;
            const suggestionsContainer = document.getElementById('suggestions');
            suggestionsContainer.innerHTML = '';
            suggestions.forEach(suggestion => {
                const suggestionItem = document.createElement('a');
                suggestionItem.href = '#';
                suggestionItem.className = 'list-group-item list-group-item-action';
                suggestionItem.innerText = suggestion;
                suggestionItem.onclick = () => {
                    document.getElementsByName('name')[0].value = suggestion;
                    loadVulnerability(suggestion);
                    suggestionsContainer.innerHTML = '';
                };
                suggestionsContainer.appendChild(suggestionItem);
            });
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function loadVulnerability(name) {
    fetch('/search_vulnerability', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
    })
    .then(response => response.json())
    .then(data => {
        if (data.vulnerability) {
            const vuln = data.vulnerability;
            document.getElementsByName('name')[0].value = vuln.name;
            document.getElementsByName('risk')[0].value = vuln.risk;
            document.getElementsByName('priority')[0].value = vuln.priority;
            document.getElementsByName('complexity')[0].value = vuln.complexity;
            document.getElementsByName('service')[0].value = vuln.service;
            document.getElementsByName('assets')[0].value = vuln.assets;
            document.getElementsByName('description')[0].value = vuln.description;
            document.getElementsByName('impact')[0].value = vuln.impact;
            document.getElementsByName('recommendations')[0].value = vuln.recommendations;
            document.getElementsByName('references')[0].value = vuln.references_web;
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function listVulnerabilities() {
    fetch('/list_vulnerabilities')
        .then(response => response.json())
        .then(data => {
            const vulnerabilities = data.vulnerabilities;
            const vulnList = document.getElementById('vuln-list');
            vulnList.innerHTML = '';
            if ($.fn.DataTable.isDataTable('#vulnerabilities-table')) {
                $('#vulnerabilities-table').DataTable().clear().destroy();
            }
            vulnerabilities.forEach(vuln => {
                const vulnItem = document.createElement('tr');
                vulnItem.innerHTML = `
                    <td>${vuln.id}</td>
                    <td>${vuln.name}</td>
                    <td>${vuln.risk}</td>
                    <td>
                        <div style="display: flex;">
                            <button class="btn btn-sm btn-block" onclick="viewVulnerability(${vuln.id})"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-sm btn-block-gray" onclick="deleteVulnerability(${vuln.id})"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </td>
                `;
                vulnList.appendChild(vulnItem);
            });
            $('#vulnerabilities-table').DataTable({
                "lengthChange": false,
                "pageLength": 5
            });
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function viewVulnerability(id) {
    fetch(`/get_vulnerability/${id}`)
        .then(response => response.json())
        .then(data => {
            const vuln = data.vulnerability;
            if (vuln) {
                document.getElementById('view-vuln-content').innerHTML = `
                    <p><strong>Name:</strong> ${vuln.name}</p>
                    <p><strong>Risk:</strong> ${vuln.risk}</p>
                    <p><strong>Priority:</strong> ${vuln.priority}</p>
                    <p><strong>Remediation Complexity:</strong> ${vuln.complexity}</p>
                    <p><strong>Affected Service:</strong> ${vuln.service}</p>
                    <p><strong>Affected Assets:</strong> ${vuln.assets}</p>
                    <p><strong>Description:</strong> ${vuln.description}</p>
                    <p><strong>Impact:</strong> ${vuln.impact}</p>
                    <p><strong>Recommendations:</strong> ${vuln.recommendations}</p>
                    <p><strong>References:</strong> ${vuln.references}</p>
                `;
                $('#view-modal-container').modal('show');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function deleteVulnerability(id) {
    fetch('/delete_vulnerability', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            listVulnerabilities();
        } else if (data.error) {
            alert(`Error: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function listReports() {
    fetch('/list_reports')
        .then(response => response.json())
        .then(data => {
            const reportsList = document.getElementById('reports-list');
            reportsList.innerHTML = '';
            if ($.fn.DataTable.isDataTable('#reports-table')) {
                $('#reports-table').DataTable().clear().destroy();
            }
            data.reports.forEach(report => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${report.id}</td>
                    <td>${report.client}</td>
                    <td>${report.num_vulnerabilities}</td>
                    <td>${report.generation_date}</td>
                    <td>
                        <div style="display: flex;">
                            <button class="btn btn-sm btn-block" onclick="window.location.href='/download_report/${report.id}'"><i class="fas fa-download"></i></button>
                            <button class="btn btn-sm btn-block-gray" onclick="deleteReport(${report.id})"><i class="fas fa-trash-alt"></i></button>
                        </div>    
                    </td>
                `;
                reportsList.appendChild(row);
            });
            
            $('#reports-table').DataTable({
                "lengthChange": false,
                "pageLength": 5
            });
        })
        .catch(error => console.error('Error:', error));
}

function deleteReport(id) {
    fetch('/delete_report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            listReports();
        } else if (data.error) {
            alert(`Error: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function populateClientDropdown() {
    $.get('/unique_clients', function(data) {
        const clientSelect = $('#client-select');
        clientSelect.empty();
        data.clients.forEach(client => {
            clientSelect.append(new Option(client, client));
        });
    });
}

document.getElementById('chat-send').addEventListener('click', function() {
    var chatInput = document.getElementById('chat-input').value;
    if (chatInput.trim() !== "") {
        // Show loading animation
        document.getElementById('loading-container').style.display = 'flex';

        fetch('/ask_in_documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: chatInput })
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading animation
            document.getElementById('loading-container').style.display = 'none';

            if (data.error) {
                console.error('Error:', data.error);
            } else {
                var chatBox = document.getElementById('chat-box');
                var responseElement = document.createElement('p');
                responseElement.innerHTML = data.response; // Use innerHTML to render HTML content
                chatBox.appendChild(responseElement);
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        })
        .catch((error) => {
            // Hide loading animation
            document.getElementById('loading-container').style.display = 'none';
            console.error('Error:', error);
        });
    }
});

document.getElementById('chat-clear').addEventListener('click', function() {
    var chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = '';
});