let currentVuln = 0;
let numVulns = 0;
let vulnData = [];
let csrfToken = '';

/* ============================================================
   CSRF TOKEN MANAGEMENT
   ============================================================ */

/**
 * Fetch CSRF token from server on page load.
 */
function fetchCSRFToken() {
    fetch('/csrf-token')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            csrfToken = data.csrf_token || '';
        })
        .catch(function(error) {
            console.error('Failed to fetch CSRF token:', error);
        });
}

/**
 * Get standard fetch headers with CSRF token for POST/DELETE requests.
 */
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
    };
}

/* ============================================================
   SAFE DOM UTILITIES — replaces all innerHTML usage
   ============================================================ */

/**
 * Clear a container by removing all child nodes (safe alternative to innerHTML='').
 */
function clearElement(container) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
}

/**
 * Sanitize HTML that may contain only <a href="http..."> links.
 * Strips every other tag and attribute. Used for RAG source links.
 */
function sanitizeHTML(html) {
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
}

/**
 * Build a paragraph that contains plain text segments and safe <a> links.
 * Accepts a string that may contain <a href="...">...</a> tags.
 * Only allows http/https hrefs; everything else is escaped.
 */
function buildSafeParagraph(htmlString, container) {
    const p = document.createElement('p');

    // Walk the string looking for <a href="...">...</a> patterns
    const linkRegex = /<a\s+href="(https?:[^"]*)">([^<]*)<\/a>/gi;
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(htmlString)) !== null) {
        // Text before the link
        if (match.index > lastIndex) {
            const textNode = document.createTextNode(
                htmlString.substring(lastIndex, match.index)
            );
            p.appendChild(textNode);
        }
        // The link itself
        const a = document.createElement('a');
        a.href = match[1];
        a.textContent = match[2];
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        p.appendChild(a);
        lastIndex = match.index + match[0].length;
    }

    // Remaining text after the last link
    if (lastIndex < htmlString.length) {
        const textNode = document.createTextNode(
            htmlString.substring(lastIndex)
        );
        p.appendChild(textNode);
    }

    container.appendChild(p);
}

/**
 * Create a <select> element with options.
 */
function createSelect(name, options, selectedValue) {
    const select = document.createElement('select');
    select.className = 'form-control';
    select.name = name;
    select.required = true;

    options.forEach(function(opt) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === selectedValue) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    return select;
}

/**
 * Create a labelled form group (wrapper div with label + input/select/textarea).
 */
function createFormGroup(labelText, element) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = labelText;
    group.appendChild(label);
    group.appendChild(element);

    return group;
}

/**
 * Create a form-row with a column wrapper.
 */
function createFormRowColumn(colClass, child) {
    const row = document.createElement('div');
    row.className = 'form-row';

    const col = document.createElement('div');
    col.className = colClass;
    col.appendChild(child);
    row.appendChild(col);

    return row;
}

/* ============================================================
   GENERATE VULNERABILITY FIELD BUTTONS (safe)
   ============================================================ */

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

    const container = document.getElementById('vuln-modals');
    clearElement(container);

    for (let i = 0; i < numVulns; i++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-secondary btn-block mt-2';
        button.textContent = 'Edit Vulnerability ' + (i + 1);
        (function(index) {
            button.addEventListener('click', function() {
                openModal(index);
            });
        })(i);
        container.appendChild(button);
    }

    document.getElementById('action-buttons').style.display = 'flex';
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */

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

/* ============================================================
   POPULATE VULNERABILITY FORM FIELDS (safe — no innerHTML)
   ============================================================ */

function populateVulnFields(index) {
    const vuln = vulnData[index];
    const container = document.getElementById('vuln-fields');
    clearElement(container);

    /* --- Row 1: Name input + suggestions --- */
    (function() {
        const row = document.createElement('div');
        row.className = 'form-row';

        const col = document.createElement('div');
        col.className = 'form-group col-md-12';

        const label = document.createElement('label');
        label.textContent = 'Name:';
        col.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.name = 'name';
        input.value = vuln.name || '';
        input.required = true;
        input.addEventListener('input', function() {
            suggestVulnerabilities(this.value);
        });
        col.appendChild(input);

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'suggestions';
        suggestionsDiv.className = 'list-group';
        col.appendChild(suggestionsDiv);

        row.appendChild(col);
        container.appendChild(row);
    })();

    /* --- Row 2: Risk, Priority, Complexity selects --- */
    (function() {
        const row = document.createElement('div');
        row.className = 'form-row';

        const riskOpts = [
            { value: '', label: 'Select...' },
            { value: 'Critical', label: 'Critical' },
            { value: 'High', label: 'High' },
            { value: 'Medium', label: 'Medium' },
            { value: 'Low', label: 'Low' }
        ];
        const riskCol = document.createElement('div');
        riskCol.className = 'form-group col-md-3';
        riskCol.appendChild(createFormGroup('Risk:', createSelect('risk', riskOpts, vuln.risk || '')));
        row.appendChild(riskCol);

        const priorityOpts = [
            { value: '', label: 'Select...' },
            { value: 'High', label: 'High' },
            { value: 'Medium', label: 'Medium' },
            { value: 'Low', label: 'Low' }
        ];
        const priorityCol = document.createElement('div');
        priorityCol.className = 'form-group col-md-3';
        priorityCol.appendChild(createFormGroup('Priority:', createSelect('priority', priorityOpts, vuln.priority || '')));
        row.appendChild(priorityCol);

        const complexityOpts = [
            { value: '', label: 'Select...' },
            { value: 'High', label: 'High' },
            { value: 'Medium', label: 'Medium' },
            { value: 'Low', label: 'Low' }
        ];
        const complexityCol = document.createElement('div');
        complexityCol.className = 'form-group col-md-6';
        complexityCol.appendChild(createFormGroup('Remediation Complexity:', createSelect('complexity', complexityOpts, vuln.complexity || '')));
        row.appendChild(complexityCol);

        container.appendChild(row);
    })();

    /* --- Row 3: Service select + Assets input --- */
    (function() {
        const row = document.createElement('div');
        row.className = 'form-row';

        const serviceOpts = [
            { value: '', label: 'Select...' },
            { value: 'Web', label: 'Web' },
            { value: 'Infrastructure', label: 'Infrastructure' }
        ];
        const serviceCol = document.createElement('div');
        serviceCol.className = 'form-group col-md-4';
        serviceCol.appendChild(createFormGroup('Service:', createSelect('service', serviceOpts, vuln.service || '')));
        row.appendChild(serviceCol);

        const assetsCol = document.createElement('div');
        assetsCol.className = 'form-group col-md-8';

        const assetsLabel = document.createElement('label');
        assetsLabel.textContent = 'Hosts affected:';
        assetsCol.appendChild(assetsLabel);

        const assetsInput = document.createElement('input');
        assetsInput.type = 'text';
        assetsInput.className = 'form-control';
        assetsInput.name = 'assets';
        assetsInput.value = vuln.assets || '';
        assetsInput.required = true;
        assetsCol.appendChild(assetsInput);

        row.appendChild(assetsCol);
        container.appendChild(row);
    })();

    /* --- Textareas: Description, Impact, Recommendations, References --- */
    var textareaFields = [
        { name: 'description', label: 'Description:', value: vuln.description || '' },
        { name: 'impact', label: 'Impact:', value: vuln.impact || '' },
        { name: 'recommendations', label: 'Recommendations:', value: vuln.recommendations || '' },
        { name: 'references', label: 'References:', value: vuln.references_web || '' }
    ];

    textareaFields.forEach(function(field) {
        const label = document.createElement('label');
        label.textContent = field.label;

        const textarea = document.createElement('textarea');
        textarea.className = 'form-control';
        textarea.name = field.name;
        textarea.required = true;
        textarea.textContent = field.value;

        const group = document.createElement('div');
        group.className = 'form-group';
        group.appendChild(label);
        group.appendChild(textarea);

        container.appendChild(group);
    });
}

/* ============================================================
   SAVE VULNERABILITY
   ============================================================ */

function saveVuln() {
    const formData = new FormData(document.getElementById('vuln-form'));
    const vuln = {};
    formData.forEach((value, key) => {
        vuln[key] = value;
    });
    vulnData[currentVuln] = vuln;
    closeModal();
}

/* ============================================================
   SUBMIT ALL VULNERABILITIES
   ============================================================ */

function submitAllVulns() {
    document.getElementById('loading').style.display = 'block';
    const client = document.getElementById('client').value;
    const audit_date = document.getElementById('audit-date').value;

    fetch('/submit_vulnerabilities', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 'num-vulns': numVulns, 'vulnData': vulnData, 'client': client, 'audit_date': audit_date })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('loading').style.display = 'none';
        if (data.error) {
            document.getElementById('response').textContent = 'Error: ' + data.error;
        } else {
            document.getElementById('response').textContent = data.response;
            listVulnerabilities();
        }
    })
    .catch(error => {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('response').textContent = 'Error: ' + error;
    });
}

/* ============================================================
   GENERATE REPORT
   ============================================================ */

function generateReport() {
    document.getElementById('loading').style.display = 'block';
    const client = document.getElementById('client').value;
    const audit_date = document.getElementById('audit-date').value;

    fetch('/generate_report', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 'num-vulns': numVulns, 'vulnData': vulnData, 'client': client, 'audit_date': audit_date })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('loading').style.display = 'none';
        if (data.error) {
            document.getElementById('response').textContent = 'Error: ' + data.error;
        } else {
            document.getElementById('response').textContent = data.message;
            listReports();
        }
    })
    .catch(error => {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('response').textContent = 'Error: ' + error;
    });
}

/* ============================================================
   SUGGEST VULNERABILITIES (safe — createElement + textContent)
   ============================================================ */

function suggestVulnerabilities(query) {
    if (!query) {
        var suggestionsContainer = document.getElementById('suggestions');
        if (suggestionsContainer) {
            clearElement(suggestionsContainer);
        }
        return;
    }

    fetch('/suggest_vulnerabilities?query=' + encodeURIComponent(query))
        .then(response => response.json())
        .then(data => {
            var suggestions = data.suggestions;
            var suggestionsContainer = document.getElementById('suggestions');
            clearElement(suggestionsContainer);
            suggestions.forEach(function(suggestion) {
                var suggestionItem = document.createElement('a');
                suggestionItem.href = '#';
                suggestionItem.className = 'list-group-item list-group-item-action';
                suggestionItem.textContent = suggestion;
                suggestionItem.addEventListener('click', function() {
                    document.getElementsByName('name')[0].value = suggestion;
                    loadVulnerability(suggestion);
                    clearElement(suggestionsContainer);
                });
                suggestionsContainer.appendChild(suggestionItem);
            });
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

/* ============================================================
   LOAD VULNERABILITY
   ============================================================ */

function loadVulnerability(name) {
    fetch('/search_vulnerability', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: name })
    })
    .then(response => response.json())
    .then(data => {
        if (data.vulnerability) {
            var vuln = data.vulnerability;
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

/* ============================================================
   LIST VULNERABILITIES (safe — createElement + textContent)
   ============================================================ */

function listVulnerabilities() {
    fetch('/list_vulnerabilities')
        .then(response => response.json())
        .then(data => {
            var vulnerabilities = data.vulnerabilities;
            var vulnList = document.getElementById('vuln-list');
            clearElement(vulnList);
            if ($.fn.DataTable.isDataTable('#vulnerabilities-table')) {
                $('#vulnerabilities-table').DataTable().clear().destroy();
            }
            vulnerabilities.forEach(function(vuln) {
                var vulnItem = document.createElement('tr');

                // ID cell
                var tdId = document.createElement('td');
                tdId.textContent = vuln.id;
                vulnItem.appendChild(tdId);

                // Name cell
                var tdName = document.createElement('td');
                tdName.textContent = vuln.name;
                vulnItem.appendChild(tdName);

                // Risk cell
                var tdRisk = document.createElement('td');
                tdRisk.textContent = vuln.risk;
                vulnItem.appendChild(tdRisk);

                // Actions cell
                var tdActions = document.createElement('td');
                var actionsDiv = document.createElement('div');
                actionsDiv.style.display = 'flex';

                var viewBtn = document.createElement('button');
                viewBtn.className = 'btn btn-sm btn-block';
                (function(vulnId) {
                    viewBtn.addEventListener('click', function() {
                        viewVulnerability(vulnId);
                    });
                })(vuln.id);
                var viewIcon = document.createElement('i');
                viewIcon.className = 'fas fa-eye';
                viewBtn.appendChild(viewIcon);
                actionsDiv.appendChild(viewBtn);

                var deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-sm btn-block-gray';
                (function(vulnId) {
                    deleteBtn.addEventListener('click', function() {
                        deleteVulnerability(vulnId);
                    });
                })(vuln.id);
                var deleteIcon = document.createElement('i');
                deleteIcon.className = 'fas fa-trash-alt';
                deleteBtn.appendChild(deleteIcon);
                actionsDiv.appendChild(deleteBtn);

                tdActions.appendChild(actionsDiv);
                vulnItem.appendChild(tdActions);

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

/* ============================================================
   VIEW VULNERABILITY (safe — createElement + textContent)
   ============================================================ */

function viewVulnerability(id) {
    fetch('/get_vulnerability/' + id)
        .then(response => response.json())
        .then(data => {
            var vuln = data.vulnerability;
            if (vuln) {
                var content = document.getElementById('view-vuln-content');
                clearElement(content);

                var fields = [
                    { label: 'Name', value: vuln.name },
                    { label: 'Risk', value: vuln.risk },
                    { label: 'Priority', value: vuln.priority },
                    { label: 'Remediation Complexity', value: vuln.complexity },
                    { label: 'Affected Service', value: vuln.service },
                    { label: 'Affected Assets', value: vuln.assets },
                    { label: 'Description', value: vuln.description },
                    { label: 'Impact', value: vuln.impact },
                    { label: 'Recommendations', value: vuln.recommendations },
                    { label: 'References', value: vuln.references_web || '' }
                ];

                fields.forEach(function(field) {
                    var p = document.createElement('p');
                    var strong = document.createElement('strong');
                    strong.textContent = field.label + ': ';
                    p.appendChild(strong);
                    p.appendChild(document.createTextNode(field.value || ''));
                    content.appendChild(p);
                });

                $('#view-modal-container').modal('show');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

/* ============================================================
   DELETE VULNERABILITY
   ============================================================ */

function deleteVulnerability(id) {
    fetch('/delete_vulnerability', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: id })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            listVulnerabilities();
        } else if (data.error) {
            alert('Error: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

/* ============================================================
   LIST REPORTS (safe — createElement + textContent)
   ============================================================ */

function listReports() {
    fetch('/list_reports')
        .then(response => response.json())
        .then(data => {
            var reportsList = document.getElementById('reports-list');
            clearElement(reportsList);
            if ($.fn.DataTable.isDataTable('#reports-table')) {
                $('#reports-table').DataTable().clear().destroy();
            }
            data.reports.forEach(function(report) {
                var row = document.createElement('tr');

                // ID cell
                var tdId = document.createElement('td');
                tdId.textContent = report.id;
                row.appendChild(tdId);

                // Client cell
                var tdClient = document.createElement('td');
                tdClient.textContent = report.client;
                row.appendChild(tdClient);

                // Num vulnerabilities cell
                var tdNum = document.createElement('td');
                tdNum.textContent = report.num_vulnerabilities;
                row.appendChild(tdNum);

                // Generation date cell
                var tdDate = document.createElement('td');
                tdDate.textContent = report.generation_date;
                row.appendChild(tdDate);

                // Actions cell
                var tdActions = document.createElement('td');
                var actionsDiv = document.createElement('div');
                actionsDiv.style.display = 'flex';

                var downloadBtn = document.createElement('button');
                downloadBtn.className = 'btn btn-sm btn-block';
                (function(reportId) {
                    downloadBtn.addEventListener('click', function() {
                        window.location.href = '/download_report/' + reportId;
                    });
                })(report.id);
                var downloadIcon = document.createElement('i');
                downloadIcon.className = 'fas fa-download';
                downloadBtn.appendChild(downloadIcon);
                actionsDiv.appendChild(downloadBtn);

                var deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-sm btn-block-gray';
                (function(reportId) {
                    deleteBtn.addEventListener('click', function() {
                        deleteReport(reportId);
                    });
                })(report.id);
                var deleteIcon = document.createElement('i');
                deleteIcon.className = 'fas fa-trash-alt';
                deleteBtn.appendChild(deleteIcon);
                actionsDiv.appendChild(deleteBtn);

                tdActions.appendChild(actionsDiv);
                row.appendChild(tdActions);

                reportsList.appendChild(row);
            });

            $('#reports-table').DataTable({
                "lengthChange": false,
                "pageLength": 5
            });
        })
        .catch(error => console.error('Error:', error));
}

/* ============================================================
   DELETE REPORT
   ============================================================ */

function deleteReport(id) {
    fetch('/delete_report', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: id })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            listReports();
        } else if (data.error) {
            alert('Error: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

/* ============================================================
   POPULATE CLIENT DROPDOWN
   ============================================================ */

function populateClientDropdown() {
    $.get('/unique_clients', function(data) {
        var clientSelect = $('#client-select');
        clientSelect.empty();
        data.clients.forEach(function(client) {
            clientSelect.append(new Option(client, client));
        });
    });
}

/* ============================================================
   CHAT — RAG ANALYSIS (safe — textContent + safe link rendering)
   ============================================================ */

document.getElementById('chat-send').addEventListener('click', function() {
    var chatInput = document.getElementById('chat-input').value;
    if (chatInput.trim() !== "") {
        // Show loading animation
        document.getElementById('loading-container').style.display = 'flex';

        fetch('/ask_in_documents', {
            method: 'POST',
            headers: getAuthHeaders(),
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
                // Use safe paragraph builder that only allows <a> tags with http/https
                buildSafeParagraph(data.response, chatBox);
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        })
        .catch(function(error) {
            // Hide loading animation
            document.getElementById('loading-container').style.display = 'none';
            console.error('Error:', error);
        });
    }
});

document.getElementById('chat-clear').addEventListener('click', function() {
    var chatBox = document.getElementById('chat-box');
    clearElement(chatBox);
});

/* ============================================================
   AUTHENTICATION FUNCTIONS
   ============================================================ */

/**
 * Check authentication status on page load.
 * Shows/hides login form and app content accordingly.
 */
function checkAuth() {
    // Fetch CSRF token on every auth check
    fetchCSRFToken();

    fetch('/auth/status')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            var authSection = document.getElementById('auth-section');
            var appContent = document.getElementById('app-content');
            var logoutBtn = document.getElementById('logout-btn');
            if (data.authenticated) {
                if (authSection) authSection.style.display = 'none';
                if (appContent) appContent.style.display = 'block';
                if (logoutBtn) logoutBtn.style.display = 'inline-block';
            } else {
                if (authSection) authSection.style.display = 'block';
                if (appContent) appContent.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'none';
            }
        })
        .catch(function(error) {
            console.error('Auth check failed:', error);
        });
}

/**
 * Login with username and password.
 */
function doLogin() {
    var username = document.getElementById('login-username').value;
    var password = document.getElementById('login-password').value;
    var errorDiv = document.getElementById('login-error');
    errorDiv.textContent = '';

    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(function(response) { return response.json().then(function(data) { return { status: response.status, data: data }; }); })
    .then(function(result) {
        if (result.status === 200) {
            checkAuth();
            listVulnerabilities();
            listReports();
        } else {
            errorDiv.textContent = result.data.error || 'Login failed';
        }
    })
    .catch(function(error) {
        errorDiv.textContent = 'Connection error: ' + error;
    });
}

/**
 * Logout current user.
 */
function doLogout() {
    fetch('/logout', {
        method: 'POST',
        headers: getAuthHeaders()
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        checkAuth();
    })
    .catch(function(error) {
        console.error('Logout failed:', error);
    });
}

/**
 * Global fetch interceptor — handles 401 responses.
 */
var originalFetch = window.fetch;
window.fetch = function() {
    return originalFetch.apply(this, arguments).then(function(response) {
        if (response.status === 401) {
            response.json().then(function(data) {
                console.warn('Authentication required:', data.error);
            }).catch(function() {});
            var authSection = document.getElementById('auth-section');
            var appContent = document.getElementById('app-content');
            if (authSection) authSection.style.display = 'block';
            if (appContent) appContent.style.display = 'none';
        }
        return response;
    });
};

/**
 * Handle Enter key in login password field.
 */
document.addEventListener('DOMContentLoaded', function() {
    var passwordField = document.getElementById('login-password');
    if (passwordField) {
        passwordField.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                doLogin();
            }
        });
    }
});
