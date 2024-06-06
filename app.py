from flask import Flask, request, jsonify, render_template, send_file
import os
from docx import Document
from docx.shared import Inches, RGBColor
from datetime import datetime
import sqlite3
import matplotlib.pyplot as plt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION_START, WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import requests
import random
import string
import psutil
import json
from langchain.vectorstores import FAISS
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import CharacterTextSplitter
from langchain.docstore.document import Document as LangchainDocument
from textwrap import fill

## CHAT WITH RTX SERVER
port = 12594
fn_index = 100
appdata_folder = os.path.dirname(os.getenv('APPDATA')).replace('\\', '/')
cert_path = appdata_folder + "/Local/NVIDIA/ChatRTX/RAG/trt-llm-rag-windows-ChatRTX_0.3/certs/servercert.pem"
key_path = appdata_folder + "/Local/NVIDIA/ChatRTX/RAG/trt-llm-rag-windows-ChatRTX_0.3/certs/serverkey.pem"
ca_bundle = appdata_folder + "/Local/NVIDIA/ChatRTX/env_nvd_rag/Library/ssl/cacert.pem"

app = Flask(__name__)

# Database configuration
DATABASE = 'vulnerabilities.db'

def init_db():
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS vulnerabilities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                risk TEXT,
                priority TEXT,
                complexity TEXT,
                service TEXT,
                assets TEXT,
                description TEXT,
                impact TEXT,
                recommendations TEXT,
                references_web TEXT,
                client TEXT,
                audit_date TEXT
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client TEXT,
                num_vulnerabilities INTEGER,
                generation_date TEXT,
                report_path TEXT
            )
        ''')
        conn.commit()

def migrate_db():
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute('PRAGMA table_info(vulnerabilities)')
        columns = [column[1] for column in cursor.fetchall()]
        if 'client' not in columns:
            cursor.execute('ALTER TABLE vulnerabilities ADD COLUMN client TEXT')
        if 'audit_date' not in columns:
            cursor.execute('ALTER TABLE vulnerabilities ADD COLUMN audit_date TEXT')
        if 'references_web' not in columns and 'references' in columns:
            cursor.execute('ALTER TABLE vulnerabilities RENAME COLUMN references TO references_web')

        cursor.execute('PRAGMA table_info(reports)')
        columns = [column[1] for column in cursor.fetchall()]
        if 'report_path' not in columns:
            cursor.execute('ALTER TABLE reports ADD COLUMN report_path TEXT')

        conn.commit()

def join_queue(session_hash, set_fn_index, port, chatdata):
    #fn_indexes are some gradio generated indexes from rag/trt/ui/user_interface.py
    python_object = {
        "data": chatdata,
        "event_data": None,
        "fn_index": set_fn_index,
        "session_hash": session_hash
    }
    json_string = json.dumps(python_object)

    url = f"https://127.0.0.1:{port}/queue/join"
    response = requests.post(url, data=json_string, cert=(cert_path, key_path), verify=ca_bundle)
    # print("Join Queue Response:", response)

def listen_for_updates(session_hash, port):
    url = f"https://127.0.0.1:{port}/queue/data?session_hash={session_hash}"

    response = requests.get(url, stream=True, cert=(cert_path, key_path), verify=ca_bundle)
    # print("Listen Response:", response)
    try:
        for line in response.iter_lines():
            if line:
                    data = json.loads(line[5:])
                    # if data['msg'] == 'process_generating':
                    #     print(data['output']['data'][0][0][1])
                    if data['msg'] == 'process_completed':
                        return data['output']['data'][0][0][1]
    except Exception as e:
        pass
    return ""

def ask_IA(message):
    global fn_index

    session_hash = ''.join(random.choices(string.ascii_letters + string.digits, k=10))

    chatdata = [[[message, None]], None]
    join_queue(session_hash, fn_index, port, chatdata)
    return listen_for_updates(session_hash, port)

def add_formatted_paragraph(document, text):
    parts = text.split('**')
    for i, part in enumerate(parts):
        if i % 2 == 0:
            subparts = part.split('*')
            for j, subpart in enumerate(subparts):
                if j % 2 == 0:
                    if subpart.strip():
                        document.add_paragraph(subpart.strip())
                else:
                    if subpart.strip():
                        document.add_paragraph(subpart.strip(), style='ListBullet')
        else:
            p = document.add_paragraph()
            p.add_run(part.strip()).bold = True

def add_table_with_headers(document, headers, data):
    table = document.add_table(rows=1, cols=len(headers))
    table.style = 'Table Grid'
    hdr_cells = table.rows[0].cells
    for i, header in enumerate(headers):
        hdr_cells[i].text = header

    row_cells = table.add_row().cells
    for i, item in enumerate(data):
        row_cells[i].text = item

def add_footer(document, image_path):
    section = document.sections[-1]
    footer = section.footer
    paragraph = footer.paragraphs[0]
    run = paragraph.add_run()
    run.add_picture(image_path, width=Inches(6))

def generate_risk_density_chart(vulnerabilities, output_path):
    risk_levels = ['Critical', 'High', 'Medium', 'Low']
    risk_counts = {level: 0 for level in risk_levels}

    for vuln in vulnerabilities:
        if vuln['risk'] in risk_counts:
            risk_counts[vuln['risk']] += 1

    risk_values = [risk_counts[level] for level in risk_levels]

    plt.figure(figsize=(10, 6))
    plt.bar(risk_levels, risk_values, color=['red', 'orange', 'yellow', 'green'])
    plt.xlabel('Risk Level')
    plt.ylabel('Number of Vulnerabilities')
    plt.title('Vulnerability Risk Density')
    plt.savefig(output_path)
    plt.close()

def generate_priority_chart(vulnerabilities, output_path):
    priority_levels = ['Critical', 'High', 'Medium', 'Low']
    priority_counts = {level: 0 for level in priority_levels}

    for vuln in vulnerabilities:
        if vuln['priority'] in priority_counts:
            priority_counts[vuln['priority']] += 1

    priority_values = [priority_counts[level] for level in priority_levels]

    plt.figure(figsize=(10, 6))
    plt.bar(priority_levels, priority_values, color=['red', 'orange', 'yellow', 'green'])
    plt.xlabel('Priority Level')
    plt.ylabel('Number of Vulnerabilities')
    plt.title('Vulnerability Priority Density')
    plt.savefig(output_path)
    plt.close()

def generate_complexity_chart(vulnerabilities, output_path):
    complexity_levels = ['Critical', 'High', 'Medium', 'Low']
    complexity_counts = {level: 0 for level in complexity_levels}

    for vuln in vulnerabilities:
        if vuln['complexity'] in complexity_counts:
            complexity_counts[vuln['complexity']] += 1

    complexity_values = [complexity_counts[level] for level in complexity_levels]

    plt.figure(figsize=(10, 6))
    plt.bar(complexity_levels, complexity_values, color=['red', 'orange', 'yellow', 'green'])
    plt.xlabel('Remediation Complexity Level')
    plt.ylabel('Number of Vulnerabilities')
    plt.title('Vulnerability Remediation Complexity Density')
    plt.savefig(output_path)
    plt.close()

def generate_risk_analysis_paragraph(vulnerabilities):
    risk_levels = ['Critical', 'High', 'Medium', 'Low']
    risk_counts = {level: 0 for level in risk_levels}

    for vuln in vulnerabilities:
        if vuln['risk'] in risk_counts:
            risk_counts[vuln['risk']] += 1

    risk_summary = ", ".join([f"{count} {level}" for level, count in risk_counts.items()])
    prompt = f"Analyze the following risk density data: {risk_summary}. Provide an explanation of the distribution and significance of these results. Don't include titles or lists. Write in two paragraphs."
    
    analysis = ask_IA(prompt)
    return analysis

def generate_priority_analysis_paragraph(vulnerabilities):
    priority_levels = ['Critical', 'High', 'Medium', 'Low']
    priority_counts = {level: 0 for level in priority_levels}

    for vuln in vulnerabilities:
        if vuln['priority'] in priority_counts:
            priority_counts[vuln['priority']] += 1

    priority_summary = ", ".join([f"{count} {level}" for level, count in priority_counts.items()])
    prompt = f"Analyze the following priority density data: {priority_summary}. Provide an explanation of the distribution and significance of these results. Don't include titles or lists. Write in two paragraphs."
    
    analysis = ask_IA(prompt)
    return analysis

def generate_complexity_analysis_paragraph(vulnerabilities):
    complexity_levels = ['Critical', 'High', 'Medium', 'Low']
    complexity_counts = {level: 0 for level in complexity_levels}

    for vuln in vulnerabilities:
        if vuln['complexity'] in complexity_counts:
            complexity_counts[vuln['complexity']] += 1

    complexity_summary = ", ".join([f"{count} {level}" for level, count in complexity_counts.items()])
    prompt = f"Analyze the following remediation complexity density data: {complexity_summary}. Provide an explanation of the distribution and significance of these results. Don't include titles or lists. Write in two paragraphs."
    
    analysis = ask_IA(prompt)
    return analysis

def add_colored_heading(document, text, level=1, color=RGBColor(118, 185, 0)):
    heading = document.add_heading(level=level)
    run = heading.add_run(text)
    run.font.color.rgb = color

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/historical_analysis')
def historical_analysis():
    return render_template('historical_analysis.html')

@app.route('/ask', methods=['POST'])
def ask():
    try:
        data = request.get_json()
        num_vulns = int(data.get('num-vulns', 0))
        vulnerabilities = data['vulnData']
        client = data['client']
        audit_date = data['audit_date']
        
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            for vulnerability in vulnerabilities:
                cursor.execute('''
                    INSERT INTO vulnerabilities (name, risk, priority, complexity, service, assets, description, impact, recommendations, references_web, client, audit_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    vulnerability['name'],
                    vulnerability['risk'],
                    vulnerability['priority'],
                    vulnerability['complexity'],
                    vulnerability['service'],
                    vulnerability['assets'],
                    vulnerability['description'],
                    vulnerability['impact'],
                    vulnerability['recommendations'],
                    vulnerability['references'],
                    client,
                    audit_date
                ))
            
            conn.commit()

        response = f"Received and saved {len(vulnerabilities)} vulnerabilities."
        return jsonify({'response': response})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/generate_report', methods=['POST'])
def generate_report():
    try:
        data = request.get_json()
        num_vulns = int(data.get('num-vulns', 0))
        vulnerabilities = data['vulnData']
        client = data['client']
        audit_date = data['audit_date']
        
        # Create Reports folder if it doesn't exist
        reports_dir = os.path.join(os.path.dirname(__file__), 'Reports')
        os.makedirs(reports_dir, exist_ok=True)
        
        # Generate file name
        current_date = datetime.now().strftime("%Y-%m-%d")
        file_name = f"{client.upper()}_{current_date}.docx"
        file_path = os.path.join(reports_dir, file_name)

        document = Document()
        
        # Set margins to 0 for cover page
        section = document.sections[0]
        section.top_margin = Inches(0)
        section.bottom_margin = Inches(0)
        section.left_margin = Inches(0)
        section.right_margin = Inches(0)

        # Add cover page
        document.add_picture('static/portada.png', width=Inches(8.5))
        last_paragraph = document.paragraphs[-1]
        last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Add new section with default margins
        section = document.add_section(WD_SECTION_START.NEW_PAGE)
        section.orientation = WD_ORIENT.PORTRAIT
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

        # Get the names of the vulnerabilities
        vuln_names = ', '.join([v['name'] for v in vulnerabilities])

        # Generate introduction section
        introduction = ask_IA(f"Generate an introduction about the vulnerability report in minimun 3 paragraphs, Include the cliente name: {client} and the audit date: {audit_date} . Never use titles, subtitles, everything should be paragraphs.")
        add_colored_heading(document, 'INTRODUCTION', level=1)
        add_formatted_paragraph(document, introduction)
        document.add_page_break()

        # Generate executive summary
        executive_summary_prompt = f"Generate an executive summary for a security audit for a non technical audience with this: {vuln_names} for the company: {client} and include the audit date: {audit_date}. summarize the results of these vulnerabilities in maximum 3 paragraphs. Never use titles, subtitles, everything should be paragraphs."
        executive_summary = ask_IA(executive_summary_prompt)
        add_colored_heading(document, 'EXECUTIVE SUMMARY', level=1)
        add_formatted_paragraph(document, executive_summary)
        document.add_page_break()

        # Generate technical summary
        technical_summary_prompt = f"Generate a technical summary for a security audit with these vulnerabilities: {vuln_names} for the company: {client} and include the audit date: {audit_date}. summarize the results of these vulnerabilities in maximum 3 paragraphs. don't include titles, subtitles."
        technical_summary = ask_IA(technical_summary_prompt)
        add_colored_heading(document, 'TECHNICAL SUMMARY', level=1)
        add_formatted_paragraph(document, technical_summary)
        document.add_page_break()

        # Generate and insert risk density chart
        add_colored_heading(document, 'RISK ANALYSIS', level=1)
        paragraph = document.add_paragraph("The chart illustrates the distribution of identified vulnerabilities across different risk levels: critical, high, medium, and low. Each bar's height corresponds to the number of vulnerabilities within its respective risk category. This analysis provides a clear overview of the security posture, highlighting the concentration of vulnerabilities by severity and aiding in prioritizing remediation efforts.")
        risk_chart_path = os.path.join(reports_dir, 'risk_density_chart.png')
        generate_risk_density_chart(vulnerabilities, risk_chart_path)
        document.add_picture(risk_chart_path, width=Inches(6))
        
        # Generate risk analysis paragraph
        risk_analysis_paragraph = generate_risk_analysis_paragraph(vulnerabilities)
        document.add_paragraph(risk_analysis_paragraph)
        document.add_page_break()

        # Generate and insert priority density chart
        add_colored_heading(document, 'PRIORITY ANALYSIS', level=1)
        paragraph = document.add_paragraph("The chart depicts the density of vulnerabilities based on their priority levels: critical, high, medium, and low. The height of each bar represents the number of vulnerabilities identified within each priority category. This analysis aids in understanding the prioritization of vulnerabilities, which is crucial for efficient resource allocation and effective remediation strategies.")
        priority_chart_path = os.path.join(reports_dir, 'priority_density_chart.png')
        generate_priority_chart(vulnerabilities, priority_chart_path)
        document.add_picture(priority_chart_path, width=Inches(6))

        # Generate priority analysis paragraph
        priority_analysis_paragraph = generate_priority_analysis_paragraph(vulnerabilities)
        document.add_paragraph(priority_analysis_paragraph)
        document.add_page_break()

        # Generate and insert complexity density chart
        add_colored_heading(document, 'Remediation Complexity', level=1)
        paragraph = document.add_paragraph("The chart illustrates the density of vulnerabilities categorized by their remediation complexity levels: critical, high, medium, and low. The height of each bar indicates the number of vulnerabilities within each complexity level. This analysis helps in understanding the distribution of vulnerabilities based on the effort required for remediation, enabling better planning and allocation of resources for effective vulnerability management.")
        complexity_chart_path = os.path.join(reports_dir, 'complexity_density_chart.png')
        generate_complexity_chart(vulnerabilities, complexity_chart_path)
        document.add_picture(complexity_chart_path, width=Inches(6))

        # Generate complexity analysis paragraph
        complexity_analysis_paragraph = generate_complexity_analysis_paragraph(vulnerabilities)
        document.add_paragraph(complexity_analysis_paragraph)
        document.add_page_break()

        for vulnerability in vulnerabilities:
            add_colored_heading(document, f"Vulnerability: {vulnerability['name']}", level=1)

            headers = ['Risk', 'Priority', 'Remediation Complexity', 'Affected Service', 'Affected Assets']
            data = [
                vulnerability['risk'],
                vulnerability['priority'],
                vulnerability['complexity'],
                vulnerability['service'],
                vulnerability['assets']
            ]
            add_table_with_headers(document, headers, data)

            add_colored_heading(document, 'Description', level=2)
            technical_description_prompt = f"Analyze this text {vulnerability['description']}, improve its readability, expand general technical details and highlight the most relevant information. This is only the description of the vulnerability. Never use titles, subtitles, everything should be paragraphs."
            technical_description = ask_IA(technical_description_prompt)
            add_formatted_paragraph(document, technical_description)

            add_colored_heading(document, 'Impact', level=2)
            technical_impact_prompt = f"Analyze this text {vulnerability['impact']}, improve its readability, expand general technical details and highlight the most relevant information. This is only the impact of the vulnerability. Never use titles, subtitles, everything should be paragraphs."
            technical_impact = ask_IA(technical_impact_prompt)
            add_formatted_paragraph(document, technical_impact)

            add_colored_heading(document, 'Recommendations', level=2)
            technical_recommendations_prompt = f"Analyze this text {vulnerability['recommendations']}, improve its readability, create lists of punctual actions. This is only the recommendation of the vulnerability. Never use titles, subtitles, everything should be paragraphs."
            technical_recommendations = ask_IA(technical_recommendations_prompt)
            add_formatted_paragraph(document, technical_recommendations)

            add_colored_heading(document, 'References', level=2)
            technical_references_prompt = f"create list of links of reference including: {vulnerability['references']}, don't add additional text, just links."
            technical_references = ask_IA(technical_references_prompt)
            add_formatted_paragraph(document, technical_references)
            document.add_page_break()

        # Add footer with NVIDIA logo
        add_colored_heading(document, 'ABOUT THIS PROYECT', level=2)
        document.add_picture('static/END.png', width=Inches(6))
        paragraph = document.add_paragraph("The RGS (Report Generative Security Tool) project has been developed for the Generative AI Agents Developer Contest organized by NVIDIA and LangChain. This project is created by Miguel Zabala (Nullsector), leverages open source software, built from scratch, to streamline the generation of comprehensive security audit reports. RGS harnesses the power of generative AI to provide detailed analyses and actionable recommendations for security vulnerabilities. The goal is to make it easier for users to produce professional-grade security reports with minimal effort. The RGS project encourages anyone to use the code for their personal projects and contribute to its improvement.")
        paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        add_footer(document, 'static/footer.png')
        
        document.save(file_path)

        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO reports (client, num_vulnerabilities, generation_date, report_path)
                VALUES (?, ?, ?, ?)
            ''', (
                client,
                num_vulns,
                audit_date,
                file_path  # Ensure this path is correctly stored
            ))
            conn.commit()

        return jsonify({'message': 'Report generated successfully', 'report_path': file_path})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/submit_vulnerabilities', methods=['POST'])
def submit_vulnerabilities():
    try:
        data = request.get_json()
        num_vulns = int(data.get('num-vulns', 0))
        vulnerabilities = data['vulnData']
        client = data['client']
        audit_date = data['audit_date']

        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            for vulnerability in vulnerabilities:
                cursor.execute('''
                    INSERT INTO vulnerabilities (name, risk, priority, complexity, service, assets, description, impact, recommendations, references_web, client, audit_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    vulnerability['name'],
                    vulnerability['risk'],
                    vulnerability['priority'],
                    vulnerability['complexity'],
                    vulnerability['service'],
                    vulnerability['assets'],
                    vulnerability['description'],
                    vulnerability['impact'],
                    vulnerability['recommendations'],
                    vulnerability['references'],
                    client,
                    audit_date
                ))
            conn.commit()

        response = f"Received and saved {len(vulnerabilities)} vulnerabilities."
        return jsonify({'response': response})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/list_vulnerabilities', methods=['GET'])
def list_vulnerabilities():
    try:
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT name, MAX(id) AS id, risk 
                FROM vulnerabilities 
                GROUP BY name 
                HAVING COUNT(name) = 1
                UNION ALL
                SELECT name, MAX(id) AS id, risk 
                FROM vulnerabilities 
                WHERE name IN (
                    SELECT name 
                    FROM vulnerabilities 
                    GROUP BY name 
                    HAVING COUNT(name) > 1
                )
                GROUP BY name
                ORDER BY name
            ''')
            rows = cursor.fetchall()

        vulnerabilities = [{'id': row[1], 'name': row[0], 'risk': row[2]} for row in rows]
        return jsonify({'vulnerabilities': vulnerabilities})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/delete_vulnerability', methods=['POST'])
def delete_vulnerability():
    try:
        data = request.get_json()
        vuln_id = data.get('id')
        
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM vulnerabilities WHERE id = ?', (vuln_id,))
            conn.commit()

        return jsonify({'message': 'Vulnerability deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/list_reports', methods=['GET'])
def list_reports():
    try:
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, client, num_vulnerabilities, generation_date, report_path FROM reports')
            rows = cursor.fetchall()

        reports = [{'id': row[0], 'client': row[1], 'num_vulnerabilities': row[2], 'generation_date': row[3], 'report_path': row[4]} for row in rows]
        return jsonify({'reports': reports})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/delete_report', methods=['POST'])
def delete_report():
    try:
        data = request.get_json()
        report_id = data.get('id')
        
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM reports WHERE id = ?', (report_id,))
            conn.commit()

        return jsonify({'message': 'Report deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/download_report/<path:filename>', methods=['GET'])
def download_report(filename):
    try:
        file_path = os.path.join(reports_dir, filename.replace("/", os.path.sep))
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True, download_name=os.path.basename(file_path))
        else:
            return jsonify({'error': 'Report not found or path is empty'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/suggest_vulnerabilities', methods=['GET'])
def suggest_vulnerabilities():
    query = request.args.get('query', '')
    try:
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT name 
                FROM (
                    SELECT name, MAX(id) AS id 
                    FROM vulnerabilities 
                    GROUP BY name 
                    HAVING COUNT(name) = 1
                    UNION ALL
                    SELECT name, MAX(id) AS id 
                    FROM vulnerabilities 
                    WHERE name IN (
                        SELECT name 
                        FROM vulnerabilities 
                        GROUP BY name 
                        HAVING COUNT(name) > 1
                    )
                    GROUP BY name
                ) 
                WHERE name LIKE ? 
                ORDER BY name
            """, ('%' + query + '%',))
            rows = cursor.fetchall()
        
        suggestions = [row[0] for row in rows]
        return jsonify({'suggestions': suggestions})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/search_vulnerability', methods=['POST'])
def search_vulnerability():
    data = request.get_json()
    name = data.get('name', '')
    try:
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT name, risk, priority, complexity, service, assets, description, impact, recommendations, references_web 
                FROM vulnerabilities 
                WHERE name = ? 
                ORDER BY id DESC 
                LIMIT 1
            ''', (name,))
            row = cursor.fetchone()

        if row:
            vulnerability = {
                'name': row[0],
                'risk': row[1],
                'priority': row[2],
                'complexity': row[3],
                'service': row[4],
                'assets': row[5],
                'description': row[6],
                'impact': row[7],
                'recommendations': row[8],
                'references_web': row[9]
            }
            return jsonify({'vulnerability': vulnerability})
        else:
            return jsonify({'vulnerability': None})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/get_vulnerability/<int:vuln_id>', methods=['GET'])
def get_vulnerability(vuln_id):
    try:
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT name, risk, priority, complexity, service, assets, description, impact, recommendations, references_web 
                FROM vulnerabilities WHERE id = ?
            ''', (vuln_id,))
            row = cursor.fetchone()

        if row:
            vulnerability = {
                'name': row[0],
                'risk': row[1],
                'priority': row[2],
                'complexity': row[3],
                'service': row[4],
                'assets': row[5],
                'description': row[6],
                'impact': row[7],
                'recommendations': row[8],
                'references_web': row[9]
            }
            return jsonify({'vulnerability': vulnerability})
        else:
            return jsonify({'vulnerability': None})
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    
@app.route('/unique_clients', methods=['GET'])
def unique_clients():
    try:
        with sqlite3.connect(DATABASE) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT DISTINCT client FROM vulnerabilities')
            rows = cursor.fetchall()
        clients = [row[0] for row in rows]
        return jsonify({'clients': clients})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

## RAG ANALYSIS

# Configuración de la carpeta y archivo
reports_dir = os.path.join(os.path.dirname(__file__), 'Reports')
os.makedirs(reports_dir, exist_ok=True)

# Función para extraer texto de archivos .docx
def extract_text_from_docx(file_path):
    doc = Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    return '\n'.join(full_text)

# Función para justificar texto
def justify_text(text, width=80):
    return "\n".join([fill(line, width=width) for line in text.split("\n")])

# Función para buscar en los documentos y enviar la pregunta a ChatRTX
def ask_IA_in_documents(question):
    # Crear una lista de documentos Langchain
    documents = []
    for filename in os.listdir(reports_dir):
        if filename.endswith(".docx"):
            file_path = os.path.join(reports_dir, filename)
            text = extract_text_from_docx(file_path)
            documents.append(LangchainDocument(page_content=text, metadata={"source": filename}))

    # Procesar los documentos para Langchain
    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=250)
    texts = text_splitter.split_documents(documents)

    # Crear un vector store con LangChain usando FAISS y embeddings
    embeddings = HuggingFaceEmbeddings()
    vector_store = FAISS.from_documents(texts, embeddings)
    
    # Buscamos documentos relevantes
    relevant_docs = vector_store.similarity_search(question)
    combined_text = ""
    sources = set()
    for doc in relevant_docs:
        source = doc.metadata['source']
        combined_text += f"Fuente: {source}\n{doc.page_content}\n\n"
        sources.add(source)
    
    # Formatear texto justificado
    justified_text = justify_text(combined_text)
    
    # Preguntamos a la IA de ChatRTX con el texto combinado de los documentos relevantes
    response = ask_IA(justified_text + "\nGive me the most concrete answer possible, avoid being redundant: " + question)
    if sources:
        response += "\n\n<br>Source: " + ", ".join([f"<a href='/download_report/{src.replace(os.path.sep, '%5C')}'>{src}</a>" for src in sources])
        
    return response

@app.route('/ask_in_documents', methods=['POST'])
def ask_in_documents():
    try:
        data = request.get_json()
        question = data.get('question')
        if not question:
            return jsonify({'error': 'No question provided'}), 400
        
        response = ask_IA_in_documents(question)
        return jsonify({'response': response})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    init_db()
    migrate_db()
    app.run(debug=True)
